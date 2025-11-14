import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Starship {
  mesh: Mesh
  speed: number
  body: RigidBody
  destroyed = false
  private camera?: PerspectiveCamera
  private cameraOffset = new Vector3(0, 2, 6)

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

  update (deltaTime: number) {
    if (this.destroyed) return

    // avancer vers -z
    const t = this.body.translation()
    const newPos = {x: t.x, y: t.y, z: t.z - this.speed * deltaTime}
    this.body.setTranslation(newPos, true)

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
    try { world.removeRigidBody(this.body) } catch {}
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}