import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Obstacle {
  mesh: Mesh
  body: RigidBody

  constructor (world: World, position: Vector3, size: Vector3) {
    const geom = new BoxGeometry(size.x, size.y, size.z)
    const mat = new MeshBasicMaterial({color: 0x884422})
    this.mesh = new Mesh(geom, mat)
    this.mesh.position.copy(position)
    this.mesh.name = 'Obstacle'

    // corps fixe
    this.body = world.createRigidBody(RigidBodyDesc.fixed())
    this.body.setTranslation({x: position.x, y: position.y, z: position.z}, true)
  }

  getAABB (): Box3 {
    const box = new Box3().setFromObject(this.mesh)
    return box
  }

  destroy (world: World) {
    try { world.removeRigidBody(this.body) } catch {}
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}