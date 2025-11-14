import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, Matrix4, Quaternion } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Starship {
  mesh: Mesh
  speed: number
  body: RigidBody
  destroyed = false
  private camera?: PerspectiveCamera
  private cameraOffset = new Vector3(0, 2, 6)

  // vitesse latérale / verticale (unit/s)
  private lateralSpeed = 6
  private verticalSpeed = 4

  // pour calculer la direction de déplacement
  private previousPosition = new Vector3()
  private minMoveEpsilon = 1e-4

  // lissage
  private rotationSmooth = 8 // plus grand = rotation plus rapide
  private cameraSmooth = 6 // lissage de la caméra

  constructor (world: World, speed: number) {
    this.speed = speed

    this.mesh = new Mesh(
      new BoxGeometry(1, 1, 3),
      new MeshBasicMaterial({ color: 0x00ff00 })
    )
    this.mesh.name = 'Starship'

    // corps cinématique pour contrôle manuel
    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased()
    )

    // position initiale
    this.body.setTranslation({ x: 0, y: 0, z: 0 }, true)
    this.syncMeshWithBody()
    this.previousPosition.copy(this.mesh.position)
  }

  attachCamera (camera: PerspectiveCamera, offset?: Vector3) {
    this.camera = camera
    if (offset) this.cameraOffset.copy(offset)
    this.updateCamera(1)
  }

  update (deltaTime: number, input?: Vector3) {
    if (this.destroyed) return

    const t = this.body.translation()

    // forward base
    const throttleFactor = 1 + (input?.z ?? 0) * 0.5 // throttle modifie la vitesse avant
    const forward = this.speed * throttleFactor * deltaTime
    const newX = t.x + (input?.x ?? 0) * this.lateralSpeed * deltaTime
    let newY = t.y + (input?.y ?? 0) * this.verticalSpeed * deltaTime
    const newZ = t.z - forward // avancer vers -z comme avant

    // limiter hauteur si besoin
    if (newY < 0) newY = 0

    this.body.setTranslation({ x: newX, y: newY, z: newZ }, true)

    this.syncMeshWithBody()

    // orientation vers la direction de déplacement (lissée)
    const newPos = this.mesh.position.clone()
    const moveVec = newPos.clone().sub(this.previousPosition)
    if (moveVec.lengthSq() > this.minMoveEpsilon) {
      const dir = moveVec.normalize()
      const targetPos = newPos.clone().add(dir)

      // quaternion cible via lookAt
      const m = new Matrix4().lookAt(newPos, targetPos, this.mesh.up)
      const targetQuat = new Quaternion().setFromRotationMatrix(m)

      // facteur framerate-indépendant : 1 - exp(-k * dt)
      const tSmooth = 1 - Math.exp(-this.rotationSmooth * deltaTime)
      this.mesh.quaternion.slerp(targetQuat, tSmooth)
    }
    this.previousPosition.copy(newPos)

    this.updateCamera(deltaTime)
  }

  private syncMeshWithBody () {
    const t = this.body.translation()
    // copier la position Rapier vers le mesh three
    this.mesh.position.set(t.x, t.y, t.z)
    // orientation gérée par le lissage ci‑dessus
  }

  private updateCamera (deltaTime = 0.016) {
    if (!this.camera) return

    // centre du vaisseau (origine du mesh)
    const target = this.mesh.position.clone()

    // calculer la position désirée de la caméra en tenant compte de la rotation du vaisseau
    const offset = this.cameraOffset.clone()
    offset.applyQuaternion(this.mesh.quaternion) // appliquer la rotation du vaisseau à l'offset
    const desiredCamPos = target.clone().add(offset)

    const tCam = deltaTime > 0 ? 1 - Math.exp(-this.cameraSmooth * deltaTime) : 1

    // lisser la position
    this.camera.position.lerp(desiredCamPos, tCam)

    // lisser l'orientation de la caméra vers regarder le centre du vaisseau
    const m = new Matrix4().lookAt(this.camera.position, target, this.camera.up)
    const targetQuat = new Quaternion().setFromRotationMatrix(m)
    this.camera.quaternion.slerp(targetQuat, tCam)

    this.camera.updateProjectionMatrix()
  }

  getPosition (): Vector3 {
    return this.mesh.position.clone()
  }

  destroy (world: World) {
    if (this.destroyed) return
    this.destroyed = true
    try {
      world.removeRigidBody(this.body)
    } catch (e) {
      console.warn('removeRigidBody failed', e)
    }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}