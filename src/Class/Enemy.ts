import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Enemy {
  mesh: Mesh
  body: RigidBody
  speed: number
  destroyed = false

  constructor(world: World, position: Vector3, speed: number) {
    this.speed = speed

    const geom = new BoxGeometry(1.5, 1.2, 2)
    const mat = new MeshBasicMaterial({ color: 0xff0066 })
    this.mesh = new Mesh(geom, mat)
    this.mesh.position.copy(position)
    this.mesh.name = 'Enemy'

    this.body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased())
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true)
  }

  update(deltaTime: number, targetPos?: Vector3) {
    if (this.destroyed) return

    const t = this.body.translation()
    let newX = t.x
    let newY = t.y

    if (targetPos && t.z > targetPos.z - 30) {
      const dx = targetPos.x - t.x
      const dy = targetPos.y - t.y
      newX += dx * 0.3 * deltaTime
      newY += dy * 0.3 * deltaTime
    }

    const newZ = t.z + this.speed * deltaTime

    this.body.setTranslation({ x: newX, y: newY, z: newZ }, true)
    this.mesh.position.set(newX, newY, newZ)
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone()
  }

  getAABB(): Box3 {
    return new Box3().setFromObject(this.mesh)
  }

  destroy(world: World) {
    if (this.destroyed) return
    this.destroyed = true
    try {
      world.removeRigidBody(this.body)
    } catch {}
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}