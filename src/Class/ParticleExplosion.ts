// typescript
import {
  Scene,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  Vector3,
  Color,
  Material
} from 'three'

export class ParticleExplosion {
  public mesh: Points
  private lifetime: number
  private age = 0

  constructor(scene: Scene, position: Vector3, intensity = 1, count = 60) {
    this.lifetime = 0.9 + 0.4 * intensity

    const geometry = new BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // random direction & speed baked into initial position offsets
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.random() * 0.6 * intensity

      const x = Math.sin(phi) * Math.cos(theta) * r
      const y = Math.sin(phi) * Math.sin(theta) * r
      const z = Math.cos(phi) * r

      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // warm color variation
      const c = new Color().setHSL(0.08 + Math.random() * 0.08, 1, 0.5)
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))

    const material = new PointsMaterial({
      size: 0.18 * intensity,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 1
    })

    this.mesh = new Points(geometry, material)
    this.mesh.position.copy(position)

    // Ne pas dépendre du caller : ajouter à la scène ici pour être sûr
    scene.add(this.mesh)
  }

  update(delta: number): boolean {
    this.age += delta

    const t = this.age / this.lifetime
    const mat = this.mesh.material as PointsMaterial
    mat.opacity = Math.max(0, 1 - t)

    // scale up for "explosion" feel
    const s = 1 + t * 3
    this.mesh.scale.setScalar(s)

    return this.age < this.lifetime
  }

  destroy(): void {
    // retirer du parent si présent
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)

    // disposer des ressources
    if (this.mesh.geometry) this.mesh.geometry.dispose()
    const m = this.mesh.material as Material
    if (m) m.dispose()
  }
}
