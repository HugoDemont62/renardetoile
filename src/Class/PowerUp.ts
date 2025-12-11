  import { Box3, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, IcosahedronGeometry } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export type PowerUpType = 'health' | 'rapidfire' | 'shield' | 'score'

export class PowerUp {
  mesh: Mesh
  body: RigidBody
  type: PowerUpType
  destroyed = false
  private rotationSpeed = 2
  private bobSpeed = 3
  private bobAmplitude = 0.3
  private initialY: number
  private time = 0

  private static colors: Record<PowerUpType, number> = {
    health: 0x00ff00,     // Vert
    rapidfire: 0xffff00,  // Jaune
    shield: 0x00ffff,     // Cyan
    score: 0xff00ff       // Magenta
  }

  private static emissive: Record<PowerUpType, number> = {
    health: 0x004400,
    rapidfire: 0x444400,
    shield: 0x004444,
    score: 0x440044
  }

  constructor(world: World, position: Vector3, type: PowerUpType) {
    this.type = type
    this.initialY = position.y

    // Géométrie différente selon le type
    let geom
    if (type === 'health') {
      geom = new SphereGeometry(0.5, 16, 16)
    } else if (type === 'shield') {
      geom = new IcosahedronGeometry(0.5, 0)
    } else {
      geom = new SphereGeometry(0.4, 8, 8)
    }

    const mat = new MeshStandardMaterial({
      color: PowerUp.colors[type],
      emissive: PowerUp.emissive[type],
      emissiveIntensity: 1.5,
      metalness: 0.8,
      roughness: 0.2
    })

    this.mesh = new Mesh(geom, mat)
    this.mesh.position.copy(position)
    this.mesh.name = `PowerUp_${type}`

    this.body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased())
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true)
  }

  update(deltaTime: number) {
    if (this.destroyed) return

    this.time += deltaTime

    // Rotation
    this.mesh.rotation.y += this.rotationSpeed * deltaTime
    this.mesh.rotation.x += this.rotationSpeed * 0.5 * deltaTime

    // Bob up and down
    const newY = this.initialY + Math.sin(this.time * this.bobSpeed) * this.bobAmplitude
    const t = this.body.translation()
    this.body.setTranslation({ x: t.x, y: newY, z: t.z }, true)
    this.mesh.position.set(t.x, newY, t.z)
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
    } catch { /* ignore */ }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}

