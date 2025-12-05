import {
  BoxHelper,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector2,
  Vector3,
  AmbientLight,
  DirectionalLight,
  PointLight,
  HemisphereLight,
  Color,
  PlaneGeometry,
  Mesh,
  MeshStandardMaterial
} from 'three'
import { World } from '@dimforge/rapier3d'
import { Engine } from './Engine'
import { Starship } from '../Class/Starship'
import { Obstacle } from '../Class/Obstacle'
import { Controls } from './Controls'
import { Laser } from '../Class/Laser'
import { Enemy } from '../Class/Enemy'
import { Stats } from './Stats'
import { Debug } from './Debug'
import { ParticleExplosion } from '../Class/ParticleExplosion'

type Disposable = { geometry?: { dispose(): void }, material?: { dispose(): void } }

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

  private deathSound?: HTMLAudioElement
  private enemyDeathSound?: HTMLAudioElement

  // pour ne créer l'explosion qu'une seule fois par ennemi détruit
  private processedDestroyed = new Set<Enemy>()

  // génération du monde : paramètres configurables
  private worldGroundY = -2
  private worldGroundSize = 1200
  private worldObstacleCount = 8
  private worldObstacleSpacing = 30
  private worldObstacleAreaWidth = 20
  private worldObstacleScaleMultiplier = 2

  constructor (engine: Engine) {
    super()
    this.engine = engine

    // ciel bleu
    this.background = new Color(0x87ceeb)

    this.camera = new PerspectiveCamera(60, 1, 0.1, 1000)
    this.camera.position.set(0, 2, 6)
    this.camera.lookAt(0, 0, 0)

    this.world = new World({ x: 0.0, y: 0.0, z: 0.0 })

    this.controls = new Controls()
    this.stats = new Stats()
    this.debug = new Debug()

    // charger son de mort (public/sounds/death.wav)
    try {
      this.deathSound = new Audio('/sounds/death.mp3')
      this.deathSound.load()
    } catch (err) {
      console.warn('Impossible de charger death sound', err)
    }

    try {
      this.enemyDeathSound = new Audio('/sounds/deathennemy.mp3')
      this.enemyDeathSound.load()
    } catch (err) {
      console.warn('Impossible de charger enemy death sound', err)
    }

    // génération automatique du monde : sol + obstacles
    this.generateWorld()

    this.setupLights()

    this.starship = new Starship(this.world, 10)
    this.add(this.starship.mesh)
    this.starship.attachCamera(this.camera, new Vector3(0, 4, 10))
  }

  private generateWorld() {
    this.generateGround(this.worldGroundSize, this.worldGroundY)
    this.generateObstacles({
      count: this.worldObstacleCount,
      spacing: this.worldObstacleSpacing,
      areaWidth: this.worldObstacleAreaWidth,
      scaleMultiplier: this.worldObstacleScaleMultiplier
    })
  }

  private generateGround(size = 1200, y = -2) {
    const groundGeom = new PlaneGeometry(size, size)
    const groundMat = new MeshStandardMaterial({ color: 0x00b300, roughness: 1 })
    const ground = new Mesh(groundGeom, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = y
    ground.receiveShadow = false
    ground.name = 'Ground'
    this.add(ground)
  }

  private generateObstacles(opts: { count?: number, spacing?: number, areaWidth?: number, scaleMultiplier?: number } = {}) {
    const count = opts.count ?? 8
    const spacing = opts.spacing ?? 30
    const areaWidth = opts.areaWidth ?? 20
    const scaleMultiplier = opts.scaleMultiplier ?? 2
    const baseTexture = '/textures/building.jpg'

    // start slightly ahead so first obstacles aren't on top of the ship
    for (let i = 1; i <= count; i++) {
      const x = (Math.random() - 0.5) * areaWidth
      const z = -i * spacing - Math.random() * (spacing * 0.3)
      const height = 6 + Math.random() * 10
      const size = new Vector3(3 * scaleMultiplier, height * scaleMultiplier, 3 * scaleMultiplier)
      const posY = this.worldGroundY + (size.y / 2)
      try {
        const obs = new Obstacle(this.world, new Vector3(x, posY, z), size, baseTexture)
        this.obstacles.push(obs)
        this.add(obs.mesh)
      } catch (err) {
        console.warn('Obstacle generation failed for index', i, err)
      }
    }
  }

  private setupLights() {
    this.ambientLight = new AmbientLight(0x404040, 50)
    this.add(this.ambientLight)

    const hemisphereLight = new HemisphereLight(0x4040ff, 0x202020, 1)
    this.add(hemisphereLight)

    this.directionalLight = new DirectionalLight(0xffffff, 1.5)
    this.directionalLight.position.set(5, 10, 5)
    this.directionalLight.castShadow = false
    this.add(this.directionalLight)

    this.shipLight = new PointLight(0x00ffff, 2, 50)
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
    try {
      this.world.step()
    } catch (err) {
      console.warn('world.step error', err)
    }

    const input = this.controls.getInput()

    if (this.starship && !this.starship.destroyed) {
      this.starship.update(delta, input)

      // suivre la lumière du vaisseau
      if (this.shipLight) {
        const sp = this.starship.getPosition()
        this.shipLight.position.set(sp.x, sp.y + 2, sp.z + 6)
      }

      if (this.directionalLight) {
        const sp = this.starship.getPosition()
        this.directionalLight.position.set(sp.x + 5, sp.y + 10, sp.z + 5)
      }

      this.distanceTraveled += delta

      if (this.controls.getShoot() && this.starship.canShoot()) {
        this.shoot()
        this.starship.resetShootCooldown()
      }

      // collisions vaisseau <-> ennemis / obstacles
      if (!this.debug.invincible && !this.debug.noClip) {
        try {
          const shipBox = this.starship.getCollisionAABB()
          for (const enemy of this.enemies) {
            if (enemy.destroyed) continue
            if (enemy.getAABB().intersectsBox(shipBox)) {
              this.handleGameOver()
              break
            }
          }

          for (const obs of this.obstacles) {
            if (obs.mesh && obs.getAABB().intersectsBox(shipBox)) {
              this.handleGameOver()
              break
            }
          }
        } catch (err) {
          console.warn('Collision checks failed', err)
        }
      }
    }

    // lasers update + collisions
    this.lasers = this.lasers.filter(laser => {
      const alive = laser.update(delta)
      if (!alive) {
        try { laser.destroy(this.world) } catch (err) { console.warn('laser.destroy failed', err) }
        if (laser.mesh.parent) laser.mesh.parent.remove(laser.mesh)
        return false
      }

      // collisions laser <-> enemy
      try {
        const la = laser.getAABB()
        for (const enemy of this.enemies) {
          if (enemy.destroyed) continue
          if (enemy.getAABB().intersectsBox(la)) {
            // marque le ennemi comme détruit + score + explosion
            enemy.destroyed = true
            this.addScore(100)
            try {
              const ex = new ParticleExplosion(this, enemy.getPosition(), 2)
              this.explosions.push(ex)
              this.add(ex.mesh)
            } catch (err) {
              console.warn('ParticleExplosion creation failed', err)
            }

            // jouer le son de mort de l'ennemi (clone pour sons simultanés)
            try {
              if (this.enemyDeathSound) {
                const s = this.enemyDeathSound.cloneNode(true) as HTMLAudioElement
                try { s.currentTime = 0 } catch (e) { /* ignore */ }
                s.play().catch(() => { /* autoplay bloqué */ })
              }
            } catch (err) {
              console.warn('play enemy death sound failed', err)
            }

            break
          }
        }
      } catch (err) {
        console.warn('Laser collision check failed', err)
      }

      return true
    })

    // explosions update
    this.explosions = this.explosions.filter(ex => {
      const alive = ex.update(delta)
      if (!alive) {
        ex.destroy()
        return false
      }
      return true
    })

    // update ennemis
    for (const enemy of this.enemies) {
      if (!enemy.destroyed) {
        try {
          enemy.update(delta, this.starship?.getPosition())
          // sync mesh with body translation if needed (enemy handles it)
        } catch (err) {
          console.warn('Enemy update failed', err)
        }
      }
    }

    // créer explosion pour ennemis détruits non encore traités (sécurité)
    for (const enemy of this.enemies) {
      if (enemy.destroyed && !this.processedDestroyed.has(enemy)) {
        try {
          const ex = new ParticleExplosion(this, enemy.getPosition(), 2)
          this.explosions.push(ex)
          this.add(ex.mesh)
        } catch (err) {
          console.warn('ParticleExplosion creation failed (post-destroy)', err)
        }
        this.processedDestroyed.add(enemy)
      }
    }

    // nettoyer ennemis détruits
    this.enemies = this.enemies.filter(e => {
      if (e.destroyed) {
        try { e.destroy(this.world) } catch (err) { console.warn('removeRigidBody failed (enemy)', err) }
        return false
      }
      return true
    })

    // spawn
    this.spawnTimer += delta
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnEnemy()
    }

    // retirer obstacles trop loins
    this.obstacles.forEach(obs => {
      if (this.starship && obs.mesh.position.z > this.starship.getPosition().z + 20) {
        try { obs.destroy(this.world) } catch (err) { console.warn('obs.destroy failed', err) }
      }
    })
    this.obstacles = this.obstacles.filter(o => o.mesh.parent)

    if (this.debug.showHitboxes) {
      this.updateHitboxes()
    } else {
      this.clearHitboxes()
    }

    this.stats.update(
      { lasers: this.lasers.length, enemies: this.enemies.length, obstacles: this.obstacles.length },
      this.starship?.getPosition()
    )

    if (this.gameOverPending) {
      this.gameOverPendingTimer += delta
      if (this.gameOverPendingTimer >= this.gameOverPendingDelay) {
        this.gameOver = true
        if (this.onGameOver) this.onGameOver()
      }
    }

    this.engine.render(this, this.camera)
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
        const helper = new BoxHelper(enemy.mesh, 0xff0000)
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
    const x = (Math.random() - 0.5) * 20
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
    if (this.gameOverPending || this.gameOver) return

    try {
      if (this.deathSound) {
        try { this.deathSound.currentTime = 0 } catch (err) { console.warn('reset deathSound time failed', err) }
        this.deathSound.play().catch(() => { /* autoplay blocked */ })
      }
    } catch (err) {
      console.warn('Erreur en jouant le son de mort', err)
    }

    if (this.starship) {
      const shipPos = this.starship.getPosition().clone()
      try {
        const explosion = new ParticleExplosion(this, shipPos, 8)
        this.explosions.push(explosion)
        this.add(explosion.mesh)
      } catch (err) {
        console.warn('ParticleExplosion creation failed (game over)', err)
      }
    }

    this.starship?.destroy(this.world)

    this.gameOverPending = true
    this.gameOverPendingTimer = 0
  }

  dispose () {
    this.controls.dispose()
    try { this.stats.dispose() } catch (err) { console.warn('stats dispose failed', err) }
    try { this.debug.dispose() } catch (err) { console.warn('debug dispose failed', err) }

    this.lasers.forEach(l => {
      try { l.destroy(this.world) } catch (err) { console.warn('laser.destroy failed during dispose', err) }
    })
    this.enemies.forEach(e => {
      try { e.destroy(this.world) } catch (err) { console.warn('enemy.destroy failed during dispose', err) }
    })
    this.obstacles.forEach(o => {
      try { o.destroy(this.world) } catch (err) { console.warn('obstacle.destroy failed during dispose', err) }
    })

    this.lasers = []
    this.enemies = []
    this.obstacles = []
    this.explosions.forEach(ex => ex.destroy())
    this.explosions = []
    this.processedDestroyed.clear()

    // remove all children and dispose resources safely
    while (this.children.length) {
      const c = this.children[0]
      const d = c as Disposable
      try { d.geometry?.dispose() } catch (err) { console.warn('geometry.dispose failed', err) }
      try { d.material?.dispose() } catch (err) { console.warn('material.dispose failed', err) }
      this.remove(c)
    }
  }
}