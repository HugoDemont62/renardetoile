import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, RepeatWrapping, TextureLoader, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Obstacle {
  mesh: Mesh
  body: RigidBody

  constructor (world: World, position: Vector3, size: Vector3, texturePath?: string) {
    const geom = new BoxGeometry(size.x, size.y, size.z)

    // Material: si texturePath fourni on charge la texture, sinon fallback color
    let mat: MeshStandardMaterial

    if (texturePath) {
      const loader = new TextureLoader()
      const tex = loader.load(
        texturePath,
        (t) => {
          // Ajuste le wrapping et le repeat pour éviter l'étirement
          t.wrapS = RepeatWrapping
          t.wrapT = RepeatWrapping
          // Répète la texture selon la taille (ajuste le divisor pour l'échelle désirée)
          t.repeat.set(Math.max(1, size.x / 2), Math.max(1, size.y / 2))
        },
      )
      mat = new MeshStandardMaterial({map: tex})
      // Optionnel : améliorer l'apparence
      mat.roughness = 0.9
      mat.metalness = 0.0
    } else {
      mat = new MeshStandardMaterial({color: 0x808080, roughness: 0.9})
    }

    this.mesh = new Mesh(geom, mat)
    this.mesh.position.copy(position)
    this.mesh.name = 'Obstacle'

    // corps fixe
    this.body = world.createRigidBody(RigidBodyDesc.fixed())
    this.body.setTranslation({x: position.x, y: position.y, z: position.z}, true)
  }

  getAABB (): Box3 {
    return new Box3().setFromObject(this.mesh)
  }

  destroy (world: World) {
    try { world.removeRigidBody(this.body) } catch { /* empty */ }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}