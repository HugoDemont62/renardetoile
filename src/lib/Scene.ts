import { Box3, PerspectiveCamera, Scene as ThreeScene, Vector2, Vector3 } from 'three'
import { Engine } from './Engine'
import { World } from '@dimforge/rapier3d'
import { Starship } from '../Class/Starship'
import { Obstacle } from '../Class/Obstacle'
import { Controls } from './Controls'
import { Laser } from '../Class/Laser'
import { Enemy } from '../Class/Enemy'

export class Scene extends ThreeScene {
  engine: Engine
  camera: PerspectiveCamera

  world: World
  starship?: Starship
  obstacles: Obstacle[] = []
  lasers: Laser[] = []
  enemies: Enemy[] = []
  controls: Controls

  score = 0
  gameOver = false
  private spawnTimer = 0
  private spawnInterval = 2
  private distanceTraveled = 0

  onScoreUpdate?: (score: number) => void
  onGameOver?: () => void

  constructor (engine: Engine) {
    super()
    this.engine = engine

    this.camera = new PerspectiveCamera(60, 1, 0.1, 1000)
    this.camera.position.set(0, 2, 6)
    this.camera.lookAt(0, 0, 0)

    this.world = new World({x: 0.0, y: 0.0, z: 0.0})

    this.controls = new Controls()

    this.starship = new Starship(this.world, 10)
    this.add(this.starship.mesh)
    this.starship.attachCamera(this.camera, new Vector3(0, 2, 8))

    for (let i = 1; i <= 6; i++) {
      const x = (Math.random() - 0.5) * 10
      const z = -i * 15
      const height = 6 + Math.random() * 10
      const obs = new Obstacle(this.world, new Vector3(x, height / 2, z), new Vector3(3, height, 3))
      this.obstacles.push(obs)
      this.add(obs.mesh)
    }
  }

  resize () {
    const v2 = new Vector2()
    this.engine.renderer.getSize(v2)
    this.camera.aspect = v2.x / v2.y
    this.camera.updateProjectionMatrix()
  }

  render () {
    if (this.gameOver) return

    const delta = this.engine.clock.getDelta()
    this.world.step()

    const input = this.controls.getInput()

    if (this.starship && !this.starship.destroyed) {
      this.starship.update(delta, input)

      this.distanceTraveled += delta

      if (this.controls.getShoot() && this.starship.canShoot()) {
        this.shoot()
        this.starship.resetShootCooldown()
      }

      const shipBox = new Box3().setFromObject(this.starship.mesh)
      for (const obs of this.obstacles) {
        const obsBox = obs.getAABB()
        if (shipBox.intersectsBox(obsBox)) {
          this.handleGameOver()
          break
        }
      }

      for (const enemy of this.enemies) {
        if (enemy.destroyed) continue
        const enemyBox = enemy.getAABB()
        if (shipBox.intersectsBox(enemyBox)) {
          this.handleGameOver()
          break
        }
      }
    }

    this.lasers = this.lasers.filter(laser => {
      const alive = laser.update(delta)
      if (!alive) {
        laser.destroy(this.world)
        return false
      }

      const laserBox = laser.getAABB()
      for (const enemy of this.enemies) {
        if (enemy.destroyed) continue
        const enemyBox = enemy.getAABB()
        if (laserBox.intersectsBox(enemyBox)) {
          enemy.destroy(this.world)
          laser.destroy(this.world)
          this.addScore(10)
          return false
        }
      }

      return true
    })

    const shipPos = this.starship?.getPosition()
    for (const enemy of this.enemies) {
      if (!enemy.destroyed) {
        enemy.update(delta, shipPos)
        if (enemy.getPosition().z > 20) {
          enemy.destroy(this.world)
        }
      }
    }

    this.enemies = this.enemies.filter(e => !e.destroyed)

    this.spawnTimer += delta
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnEnemy()
    }

    this.obstacles.forEach(obs => {
      if (this.starship && obs.mesh.position.z > this.starship.getPosition().z + 20) {
        obs.mesh.position.z -= 120
      }
    })

    this.engine.renderer.render(this, this.camera)
  }

  private shoot() {
    if (!this.starship) return
    const pos = this.starship.getPosition()
    pos.z -= 2
    const dir = this.starship.getForward()
    const laser = new Laser(this.world, pos, dir, 40)
    this.lasers.push(laser)
    this.add(laser.mesh)
  }

  private spawnEnemy() {
    if (!this.starship) return
    const x = (Math.random() - 0.5) * 15
    const y = Math.random() * 8 + 2
    const z = this.starship.getPosition().z - 50
    const enemy = new Enemy(this.world, new Vector3(x, y, z), 8)
    this.enemies.push(enemy)
    this.add(enemy.mesh)
  }

  private addScore(points: number) {
    this.score += points
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score)
    }
  }

  private handleGameOver() {
    this.gameOver = true
    this.starship?.destroy(this.world)
    if (this.onGameOver) {
      this.onGameOver()
    }
  }

  dispose () {
    this.controls.dispose()
    this.lasers.forEach(l => l.destroy(this.world))
    this.enemies.forEach(e => e.destroy(this.world))
    this.obstacles.forEach(o => o.destroy(this.world))
  }
}