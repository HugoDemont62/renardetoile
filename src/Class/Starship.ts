import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
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

  constructor (world: World, speed: number) {
    this.speed = speed

    this.mesh = new Mesh(
      new BoxGeometry(1, 1, 3),
      new MeshBasicMaterial({color: 0x00ff00})
    )
    this.mesh.name = 'Starship'

    // corps cinématique pour contrôle manuel
    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased()
    )

    // position initiale
    this.body.setTranslation({x: 0, y: 0, z: 0}, true)
    this.syncMeshWithBody()
  }

  attachCamera (camera: PerspectiveCamera, offset?: Vector3) {
    this.camera = camera
    if (offset) this.cameraOffset.copy(offset)
    this.updateCamera()
  }

  // maintenant accepte un Vector3 input: x=strafe (-1..1), y=lift, z=throttle (-1..1)
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
    this.updateCamera()
  }

  private syncMeshWithBody () {
    const t = this.body.translation()
    // copier la position Rapier vers le mesh three
    this.mesh.position.set(t.x, t.y, t.z)
    // vous pouvez aussi synchroniser orientation si besoin
  }

  private updateCamera () {
    if (!this.camera) return
    // positionner la caméra derrière le vaisseau
    const target = this.mesh.position.clone()
    const camPos = target.clone().add(this.cameraOffset)
    this.camera.position.copy(camPos)
    this.camera.lookAt(target)
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