import {
  Scene as ThreeScene,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  Vector3,
  Color,
  Material
} from 'three'

export class EngineTrail {
  public mesh: Points
  private positions: Float32Array
  private velocities: Float32Array
  private ages: Float32Array
  private maxAge = 0.5
  private particleCount: number
  private nextParticle = 0
  private spawnTimer = 0
  private spawnRate = 0.01 // spawn every 0.01s

  constructor(scene: ThreeScene, count = 50) {
    this.particleCount = count
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.ages = new Float32Array(count).fill(this.maxAge + 1) // all expired initially

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))

    const material = new PointsMaterial({
      size: 0.15,
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    })

    this.mesh = new Points(geometry, material)
    scene.add(this.mesh)
  }

  emit(position: Vector3, forward: Vector3) {
    const i = this.nextParticle
    const idx = i * 3

    // Position derrière le vaisseau
    const offset = forward.clone().multiplyScalar(2)
    const emitPos = position.clone().add(offset)

    this.positions[idx] = emitPos.x + (Math.random() - 0.5) * 0.2
    this.positions[idx + 1] = emitPos.y + (Math.random() - 0.5) * 0.2
    this.positions[idx + 2] = emitPos.z + (Math.random() - 0.5) * 0.2

    // Vélocité vers l'arrière
    this.velocities[idx] = forward.x * 5 + (Math.random() - 0.5) * 2
    this.velocities[idx + 1] = forward.y * 5 + (Math.random() - 0.5) * 2
    this.velocities[idx + 2] = forward.z * 5 + (Math.random() - 0.5) * 2

    this.ages[i] = 0

    this.nextParticle = (this.nextParticle + 1) % this.particleCount
  }

  update(deltaTime: number, shipPosition?: Vector3, shipForward?: Vector3) {
    // Spawn new particles
    if (shipPosition && shipForward) {
      this.spawnTimer += deltaTime
      while (this.spawnTimer >= this.spawnRate) {
        this.emit(shipPosition, shipForward)
        this.spawnTimer -= this.spawnRate
      }
    }

    // Update existing particles
    for (let i = 0; i < this.particleCount; i++) {
      if (this.ages[i] > this.maxAge) continue

      this.ages[i] += deltaTime

      const idx = i * 3
      this.positions[idx] += this.velocities[idx] * deltaTime
      this.positions[idx + 1] += this.velocities[idx + 1] * deltaTime
      this.positions[idx + 2] += this.velocities[idx + 2] * deltaTime

      // Fade out (move far away when expired)
      if (this.ages[i] > this.maxAge) {
        this.positions[idx] = 10000
        this.positions[idx + 1] = 10000
        this.positions[idx + 2] = 10000
      }
    }

    // Update buffer
    const posAttr = this.mesh.geometry.getAttribute('position') as BufferAttribute
    posAttr.needsUpdate = true
  }

  destroy(): void {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
    if (this.mesh.geometry) this.mesh.geometry.dispose()
    const m = this.mesh.material as Material
    if (m) m.dispose()
  }
}

