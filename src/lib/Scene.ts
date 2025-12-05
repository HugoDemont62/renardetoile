import {
  BoxHelper,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector2,
  Vector3,
  AmbientLight,
  DirectionalLight,
  PointLight,
  HemisphereLight
} from 'three'
import { Engine } from './Engine'
import { World } from '@dimforge/rapier3d'
import { Starship } from '../Class/Starship'
import { Obstacle } from '../Class/Obstacle'
import { Controls } from './Controls'
import { Laser } from '../Class/Laser'
import { Enemy } from '../Class/Enemy'
import { Stats } from './Stats'
import { Debug } from './Debug'
import { ParticleExplosion } from '../Class/ParticleExplosion'


export class Scene extends ThreeScene {
  engine: Engine
  camera: PerspectiveCamera

  world: World
  starship?: Starship
  obstacles: Obstacle[] = []
  lasers: Laser[] = []
  enemies: Enemy[] = []
  controls: Controls
  stats: Stats
  debug: Debug
  private explosions: ParticleExplosion[] = []
  private gameOverPending = false
  private gameOverPendingTimer = 0
  private gameOverPendingDelay = 1.5

  // Lumières
  private ambientLight?: AmbientLight
  private directionalLight?: DirectionalLight
  private shipLight?: PointLight

  score = 0
  gameOver = false
  private spawnTimer = 0
  private spawnInterval = 2
  private distanceTraveled = 0
  private hitboxHelpers: BoxHelper[] = []

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
    this.stats = new Stats()
    this.debug = new Debug()

    // Ajouter les lumières à la scène
    this.setupLights()

    this.starship = new Starship(this.world, 10)
    this.add(this.starship.mesh)
    this.starship.attachCamera(this.camera, new Vector3(0, 4, 10))

    for (let i = 1; i <= 6; i++) {
      const x = (Math.random() - 0.5) * 10
      const z = -i * 15
      const height = 6 + Math.random() * 10
      const obs = new Obstacle(this.world, new Vector3(x, height / 2, z), new Vector3(3, height, 3))
      this.obstacles.push(obs)
      this.add(obs.mesh)
    }
  }

  private setupLights() {
    // 1. Lumière ambiante - éclaire tout uniformément (lumière de base)
    this.ambientLight = new AmbientLight(0x404040, 1.5) // couleur grise douce, intensité 1.5
    this.add(this.ambientLight)

    // 2. Lumière hémisphérique - simule le ciel et le sol
    const hemisphereLight = new HemisphereLight(
      0x4040ff, // couleur du ciel (bleu foncé)
      0x202020, // couleur du sol (gris très foncé)
      0.8 // intensité
    )
    this.add(hemisphereLight)

    // 3. Lumière directionnelle - comme le soleil, éclaire dans une direction
    this.directionalLight = new DirectionalLight(0xffffff, 1.5)
    this.directionalLight.position.set(5, 10, 5)
    this.directionalLight.castShadow = false // pas d'ombres pour meilleures perfs
    this.add(this.directionalLight)

    // 4. Lumière ponctuelle qui suit le vaisseau - pour l'effet "projecteur"
    this.shipLight = new PointLight(0x00ffff, 2, 50) // couleur cyan, intensité 2, portée 50
    this.add(this.shipLight)

    console.log('✨ Lumières ajoutées à la scène')
  }

  resize () {
    const v2 = new Vector2()
    this.engine.renderer.getSize(v2)
    this.camera.aspect = v2.x / v2.y
    this.camera.updateProjectionMatrix()
  }

  render () {
    if (this.gameOver) return

    const delta = this.engine.clock.getDelta() * this.debug.speedMultiplier
    this.world.step()

    const input = this.controls.getInput()

    if (this.starship && !this.starship.destroyed) {
      this.starship.update(delta, input)

      // Faire suivre la lumière du vaisseau
      if (this.shipLight) {
        const shipPos = this.starship.getPosition()
        this.shipLight.position.set(shipPos.x, shipPos.y + 2, shipPos.z)
      }

      // Faire suivre la lumière directionnelle (optionnel)
      if (this.directionalLight) {
        const shipPos = this.starship.getPosition()
        this.directionalLight.position.set(
          shipPos.x + 5,
          shipPos.y + 10,
          shipPos.z + 5
        )
        this.directionalLight.target.position.copy(shipPos)
        this.directionalLight.target.updateMatrixWorld()
      }

      this.distanceTraveled += delta

      if (this.controls.getShoot() && this.starship.canShoot()) {
        this.shoot()
        this.starship.resetShootCooldown()
      }

      if (!this.debug.invincible && !this.debug.noClip) {
        const shipBox = this.starship.getCollisionAABB()
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
          const enemyPos = enemy.getPosition().clone()
          enemy.destroy(this.world)

          // créer l'explosion en passant la Scene (this) et non le World
          const explosion = new ParticleExplosion(this, enemyPos, 5)
          this.explosions.push(explosion)
          this.add(explosion.mesh)

          laser.destroy(this.world)
          this.addScore(10)
          return false
        }
      }

      return true
    })

    // mettre à jour les explosions et supprimer les terminées
    this.explosions = this.explosions.filter(ex => {
      const alive = ex.update(delta)
      if (!alive) {
        // appeler destroy sans passer this.world
        ex.destroy()
        if (ex.mesh.parent === this) this.remove(ex.mesh)
        return false
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

    if (this.debug.showHitboxes) {
      this.updateHitboxes()
    } else {
      this.clearHitboxes()
    }

    this.stats.update(
      {
        lasers: this.lasers.length,
        enemies: this.enemies.length,
        obstacles: this.obstacles.length
      },
      this.starship?.getPosition()
    )
    if (this.gameOverPending) {
      this.gameOverPendingTimer += delta
      if (this.gameOverPendingTimer >= this.gameOverPendingDelay) {
        this.gameOverPending = false
        this.gameOver = true
        if (this.onGameOver) {
          this.onGameOver()
        }
      }
    }

    this.engine.renderer.render(this, this.camera)
  }

  private updateHitboxes() {
    this.clearHitboxes()

    if (this.starship && !this.starship.destroyed) {
      const helper = new BoxHelper(this.starship.mesh, 0x00ff00)
      this.hitboxHelpers.push(helper)
      this.add(helper)
    }

    this.enemies.forEach(enemy => {
      if (!enemy.destroyed) {
        const helper = new BoxHelper(enemy.mesh, 0xff0066)
        this.hitboxHelpers.push(helper)
        this.add(helper)
      }
    })

    this.obstacles.forEach(obs => {
      const helper = new BoxHelper(obs.mesh, 0x808080)
      this.hitboxHelpers.push(helper)
      this.add(helper)
    })
  }

  private clearHitboxes() {
    this.hitboxHelpers.forEach(helper => this.remove(helper))
    this.hitboxHelpers = []
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
    // éviter les doubles appels
    if (this.gameOverPending || this.gameOver) return

    if (this.starship) {
      const shipPos = this.starship.getPosition().clone()
      // créer explosion du vaisseau
      const explosion = new ParticleExplosion(this, shipPos, 8)
      this.explosions.push(explosion)
      this.add(explosion.mesh)
    }

    // détruire le vaisseau pour couper le contrôle immédiatement
    this.starship?.destroy(this.world)

    // marquer la fin comme "en attente" pour laisser le temps aux effets de se jouer
    this.gameOverPending = true
    this.gameOverPendingTimer = 0
  }

  dispose () {
    this.controls.dispose()
    this.stats.dispose()
    this.debug.dispose()
    this.lasers.forEach(l => l.destroy(this.world))
    this.enemies.forEach(e => e.destroy(this.world))
    this.obstacles.forEach(o => o.destroy(this.world))

    this.explosions.forEach(ex => {
      // appeler destroy sans passer this.world
      ex.destroy()
      if (ex.mesh.parent === this) this.remove(ex.mesh)
    })
    this.explosions = []

    this.clearHitboxes()
  }
}
