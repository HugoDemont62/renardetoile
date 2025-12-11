import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class EnemyLaser {
  mesh: Mesh
  body: RigidBody
  velocity: Vector3
  lifetime = 4

  constructor(world: World, position: Vector3, direction: Vector3, speed: number) {
    const geom = new BoxGeometry(0.12, 0.12, 0.6)
    // Rouge pour les lasers ennemis
    const mat = new MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff0000,
      emissiveIntensity: 2,
      metalness: 0.9,
      roughness: 0.1
    })
    this.mesh = new Mesh(geom, mat)
    this.mesh.position.copy(position)
    this.mesh.name = 'EnemyLaser'

    // Orienter le laser vers sa direction
    const target = position.clone().add(direction)
    this.mesh.lookAt(target)

    this.body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased())
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true)

    this.velocity = direction.clone().normalize().multiplyScalar(speed)
  }

  update(deltaTime: number) {
    const t = this.body.translation()
    const newPos = new Vector3(t.x, t.y, t.z).add(
      this.velocity.clone().multiplyScalar(deltaTime)
    )
    this.body.setTranslation({ x: newPos.x, y: newPos.y, z: newPos.z }, true)
    this.mesh.position.copy(newPos)

    this.lifetime -= deltaTime
    return this.lifetime > 0
  }

  getAABB(): Box3 {
    return new Box3().setFromObject(this.mesh)
  }

  destroy(world: World) {
    try {
      world.removeRigidBody(this.body)
    } catch { /* ignore */ }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}

