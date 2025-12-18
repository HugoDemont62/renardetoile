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
import { EnemyShooter } from '../Class/EnemyShooter'
import { EnemyLaser } from '../Class/EnemyLaser'
import { PowerUp } from '../Class/PowerUp'
import type { PowerUpType } from '../Class/PowerUp'
import { EngineTrail } from '../Class/EngineTrail'
import { Stats } from './Stats'
import { Debug } from './Debug'
import { ParticleExplosion } from '../Class/ParticleExplosion'
import { BuildingManager } from './BuildingManager'
import { addScore, getMachineName } from './Highscores'

type Disposable = { geometry?: { dispose(): void }, material?: { dispose(): void } }

export class Scene extends ThreeScene {
  engine: Engine
  camera: PerspectiveCamera

  world: World
  starship?: Starship
  obstacles: Obstacle[] = []
  lasers: Laser[] = []
  enemies: Enemy[] = []
  enemyShooters: EnemyShooter[] = []
  enemyLasers: EnemyLaser[] = []
  powerUps: PowerUp[] = []
  controls: Controls
  stats: Stats
  debug: Debug
  private explosions: ParticleExplosion[] = []
  private engineTrail?: EngineTrail
  private gameOverPending = false
  private gameOverPendingTimer = 0
  private gameOverPendingDelay = 1.5

  private ambientLight?: AmbientLight
  private directionalLight?: DirectionalLight
  private shipLight?: PointLight

  // Système de vies et shield
  lives = 3
  maxLives = 5
  shieldActive = false
  shieldTimer = 0
  shieldDuration = 5
  invincibilityTimer = 0
  invincibilityDuration = 2

  // Système de combo
  combo = 1
  maxCombo = 20
  comboTimer = 0
  comboDuration = 6 // longer so combos stay visible

  // Système de tir rapide
  rapidFireActive = false
  rapidFireTimer = 0
  rapidFireDuration = 8

  score = 0
  gameOver = false
  private spawnTimer = 0
  private spawnInterval = 2
  private powerUpSpawnTimer = 0
  private powerUpSpawnInterval = 15
  private difficultyTimer = 0
  private difficultyLevel = 1
  private distanceTraveled = 0
  private hitboxHelpers: BoxHelper[] = []

  onScoreUpdate?: (score: number) => void
  onGameOver?: () => void
  onLivesUpdate?: (lives: number) => void
  onComboUpdate?: (combo: number) => void
  onPowerUpCollected?: (type: PowerUpType) => void
  onShieldUpdate?: (active: boolean, timeLeft: number) => void
  onRapidFireUpdate?: (active: boolean, timeLeft: number) => void

  private deathSound?: HTMLAudioElement
  private enemyDeathSound?: HTMLAudioElement

  // pour ne créer l'explosion qu'une seule fois par ennemi détruit
  private processedDestroyed = new Set<Enemy>()

  // génération du monde : paramètres configurables
  private worldGroundY = -2
  private worldGroundSize = 1200
  private worldObstacleSpacing = 30
  private worldObstacleScaleMultiplier = 2

  private buildingManager?: BuildingManager
  private ground?: Mesh

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

    // Création de la trainée du moteur
    this.engineTrail = new EngineTrail(this, 80)
  }

  private generateWorld() {
    this.generateGround(this.worldGroundSize, this.worldGroundY)
    // Utiliser BuildingManager pour un monde infini
    // élargir la route (plus d'espace latéral) et plus de colonnes
    const extendedAreaWidth = 60 // plus large pour permettre de se déplacer sans 'parois'
    this.buildingManager = new BuildingManager(this, this.world, {
      tileDepth: this.worldObstacleSpacing,
      areaWidth: extendedAreaWidth,
      rowsAhead: 120, // beaucoup plus loin pour donner l'impression d'infini
      rowsBehind: 6,
      texture: '/textures/building.jpg',
      scaleMultiplier: this.worldObstacleScaleMultiplier,
      cols: Math.max(5, Math.floor(extendedAreaWidth / 4))
    })
    // Initialise le manager (pré-crée des obstacles dans le pool)
    this.buildingManager.init()
  }

  private generateGround(size = 1200, y = -2) {
    const groundGeom = new PlaneGeometry(size, size)
    const groundMat = new MeshStandardMaterial({ color: 0x00b300, roughness: 1 })
    const ground = new Mesh(groundGeom, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = y
    ground.receiveShadow = false
    ground.name = 'Ground'
    this.ground = ground
    this.add(ground)
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

    // Update timers
    this.updateTimers(delta)

    if (this.starship && !this.starship.destroyed) {
      this.starship.update(delta, input)

      // recentre le sol sous le vaisseau pour qu'il ne disparaisse pas
      try {
        const shipPos = this.starship.getPosition()
        if (this.ground) {
          this.ground.position.z = shipPos.z
        }
      } catch (err) { console.warn('Failed to recenter ground under ship', err) }

      // Update engine trail
      if (this.engineTrail) {
        const shipPos = this.starship.getPosition()
        const shipForward = this.starship.getForward().negate() // Inverse pour trainée arrière
        this.engineTrail.update(delta, shipPos, shipForward)
      }

      // suivre la lumière du vaisseau
      if (this.shipLight) {
        const sp = this.starship.getPosition()
        this.shipLight.position.set(sp.x, sp.y + 2, sp.z + 6)
        // Couleur cyan ou dorée si shield actif
        this.shipLight.color.set(this.shieldActive ? 0xffff00 : 0x00ffff)
      }

      if (this.directionalLight) {
        const sp = this.starship.getPosition()
        this.directionalLight.position.set(sp.x + 5, sp.y + 10, sp.z + 5)
      }

      this.distanceTraveled += delta

      // Tir (avec rapidfire)
      const canShoot = this.rapidFireActive ? true : this.starship.canShoot()
      if (this.controls.getShoot() && canShoot) {
        this.shoot()
        if (!this.rapidFireActive) {
          this.starship.resetShootCooldown()
        }
      }

      // collisions vaisseau <-> ennemis / obstacles / enemy lasers
      if (!this.debug.invincible && !this.debug.noClip && this.invincibilityTimer <= 0) {
        this.checkPlayerCollisions()
      }

      // Collision avec power-ups
      this.checkPowerUpCollisions()
      // Update buildings (monde infini)
      if (this.buildingManager && this.starship) {
        this.buildingManager.update(this.starship.getPosition())
        // Synchroniser la liste d'obstacles de la scène avec ce que le manager gère
        // cela permet à l'UI / aux collisions existantes de continuer à fonctionner
        this.obstacles = this.buildingManager.getActiveObstacles()
      }
    }

    // lasers update + collisions
    this.updateLasers(delta)

    // Enemy lasers update
    this.updateEnemyLasers(delta)

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
    this.updateEnemies(delta)

    // Update enemy shooters
    this.updateEnemyShooters(delta)

    // Update power-ups
    this.updatePowerUps(delta)

    // spawn enemies and power-ups
    this.handleSpawning(delta)

    // Difficulty progression
    this.updateDifficulty(delta)

    // retirer obstacles trop loins
    // Si nous utilisons BuildingManager, il s'occupe du pooling/destruction des obstacles.
    // Ne pas détruire ici les obstacles managés. Par contre, si aucun manager, garder le comportement existant.
    if (!this.buildingManager) {
      this.obstacles.forEach(obs => {
        if (this.starship && obs.mesh.position.z > this.starship.getPosition().z + 20) {
          try { obs.destroy(this.world) } catch (err) { console.warn('obs.destroy failed', err) }
        }
      })
      this.obstacles = this.obstacles.filter(o => o.mesh.parent)
    } else {
      // garder la référence aux obstacles fournie par le manager
      this.obstacles = this.buildingManager.getActiveObstacles()
    }

    if (this.debug.showHitboxes) {
      this.updateHitboxes()
    } else {
      this.clearHitboxes()
    }

    this.stats.update(
      { lasers: this.lasers.length, enemies: this.enemies.length + this.enemyShooters.length, obstacles: this.obstacles.length },
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

  private updateTimers(delta: number) {
    // Shield timer
    if (this.shieldActive) {
      this.shieldTimer -= delta
      if (this.onShieldUpdate) this.onShieldUpdate(true, this.shieldTimer)
      if (this.shieldTimer <= 0) {
        this.shieldActive = false
        if (this.onShieldUpdate) this.onShieldUpdate(false, 0)
      }
    }

    // Rapid fire timer
    if (this.rapidFireActive) {
      this.rapidFireTimer -= delta
      if (this.onRapidFireUpdate) this.onRapidFireUpdate(true, this.rapidFireTimer)
      if (this.rapidFireTimer <= 0) {
        this.rapidFireActive = false
        if (this.onRapidFireUpdate) this.onRapidFireUpdate(false, 0)
      }
    }

    // Combo timer
    if (this.combo > 1) {
      this.comboTimer -= delta
      if (this.comboTimer <= 0) {
        this.combo = 1
        if (this.onComboUpdate) this.onComboUpdate(this.combo)
      }
    }

    // Invincibility timer (après avoir pris des dégâts)
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer -= delta
      // Effet de clignotement
      if (this.starship) {
        this.starship.mesh.visible = Math.floor(this.invincibilityTimer * 10) % 2 === 0
      }
    } else if (this.starship) {
      this.starship.mesh.visible = true
    }
  }

  private checkPlayerCollisions() {
    if (!this.starship || this.starship.destroyed) return

    try {
      const shipBox = this.starship.getCollisionAABB()

      // Collision avec ennemis normaux
      for (const enemy of this.enemies) {
        if (enemy.destroyed) continue
        if (enemy.getAABB().intersectsBox(shipBox)) {
          this.handleDamage()
          enemy.destroyed = true
          return
        }
      }

      // Collision avec enemy shooters
      for (const shooter of this.enemyShooters) {
        if (shooter.destroyed) continue
        if (shooter.getAABB().intersectsBox(shipBox)) {
          this.handleDamage()
          shooter.destroyed = true
          return
        }
      }

      // Collision avec obstacles (inclut BuildingManager actifs)
      // obstacles managés
      if (this.buildingManager) {
        const mgrObs = this.buildingManager.getActiveObstacles()
        for (const obs of mgrObs) {
          try {
            if (obs.mesh && obs.getAABB().intersectsBox(shipBox)) {
              this.handleDamage()
              return
            }
          } catch (err) { console.warn('Obstacle collision check failed', err) }
        }
      }
      // legacy obstacles array (if any)
      for (const obs of this.obstacles) {
        if (obs.mesh && obs.getAABB().intersectsBox(shipBox)) {
          this.handleDamage()
          return
        }
      }

      // Collision avec enemy lasers
      for (const laser of this.enemyLasers) {
        if (laser.getAABB().intersectsBox(shipBox)) {
          this.handleDamage()
          try { laser.destroy(this.world) } catch (err) { console.warn('enemy laser destroy failed', err) }
          this.enemyLasers = this.enemyLasers.filter(l => l !== laser)
          return
        }
      }
    } catch (err) {
      console.warn('Collision checks failed', err)
    }
  }

  private checkPowerUpCollisions() {
    if (!this.starship || this.starship.destroyed) return

    const shipBox = this.starship.getCollisionAABB()

    this.powerUps = this.powerUps.filter(powerUp => {
      if (powerUp.destroyed) return false

      if (powerUp.getAABB().intersectsBox(shipBox)) {
        this.collectPowerUp(powerUp.type)
        powerUp.destroy(this.world)
        return false
      }
      return true
    })
  }

  private collectPowerUp(type: PowerUpType) {
    // notify UI that a power-up was collected (for notifications)
    try { if (this.onPowerUpCollected) this.onPowerUpCollected(type) } catch (err) { console.warn('onPowerUpCollected handler failed', err) }
    switch (type) {
      case 'health':
        if (this.lives < this.maxLives) {
          this.lives++
          if (this.onLivesUpdate) this.onLivesUpdate(this.lives)
        }
        break
      case 'rapidfire':
        this.rapidFireActive = true
        this.rapidFireTimer = this.rapidFireDuration
        if (this.onRapidFireUpdate) this.onRapidFireUpdate(true, this.rapidFireTimer)
        break
      case 'shield':
        this.shieldActive = true
        this.shieldTimer = this.shieldDuration
        if (this.onShieldUpdate) this.onShieldUpdate(true, this.shieldTimer)
        break
      case 'score':
        this.addScore(500)
        break
    }
  }

  private handleDamage() {
    if (this.shieldActive) {
      // Shield absorbe le dégât
      this.shieldActive = false
      this.shieldTimer = 0
      if (this.onShieldUpdate) this.onShieldUpdate(false, 0)
      // Petit effet visuel
      if (this.starship) {
        try {
          const ex = new ParticleExplosion(this, this.starship.getPosition(), 1)
          this.explosions.push(ex)
        } catch (err) { console.warn('ParticleExplosion creation failed', err) }
      }
      return
    }

    this.lives--
    if (this.onLivesUpdate) this.onLivesUpdate(this.lives)

    // Reset combo
    this.combo = 1
    if (this.onComboUpdate) this.onComboUpdate(this.combo)

    if (this.lives <= 0) {
      this.handleGameOver()
    } else {
      // Invincibilité temporaire
      this.invincibilityTimer = this.invincibilityDuration

      // Son de dégât
      try {
        if (this.deathSound) {
          const s = this.deathSound.cloneNode(true) as HTMLAudioElement
          s.volume = 0.5
          s.play().catch(() => { /* ignore */ })
        }
      } catch (err) {
        console.warn('Error playing damage sound', err)
      }
    }
  }

  private updateLasers(delta: number) {
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

        // Check normal enemies
        for (const enemy of this.enemies) {
          if (enemy.destroyed) continue
          if (enemy.getAABB().intersectsBox(la)) {
            enemy.destroyed = true
            this.handleEnemyKill(enemy.getPosition(), 100)
            return false
          }
        }

        // Check enemy shooters (more points)
        for (const shooter of this.enemyShooters) {
          if (shooter.destroyed) continue
          if (shooter.getAABB().intersectsBox(la)) {
            shooter.destroyed = true
            this.handleEnemyKill(shooter.getPosition(), 200)
            return false
          }
        }
      } catch (err) {
        console.warn('Laser collision check failed', err)
      }

      return true
    })
  }

  private handleEnemyKill(position: Vector3, basePoints: number) {
    // Increase combo
    this.comboTimer = this.comboDuration
    // increase combo more visibly and give more points
    this.combo = Math.min(this.maxCombo, this.combo + 1)
    const points = Math.floor(basePoints * (1 + (this.combo - 1) * 0.5)) // each combo adds +50% points
    this.addScore(points)

    if (this.combo < this.maxCombo) {
      if (this.onComboUpdate) this.onComboUpdate(this.combo)
    }

    // Explosion
    try {
      const ex = new ParticleExplosion(this, position, 2)
      this.explosions.push(ex)
      this.add(ex.mesh)
    } catch (err) {
      console.warn('ParticleExplosion creation failed', err)
    }

    // Son
    try {
      if (this.enemyDeathSound) {
        const s = this.enemyDeathSound.cloneNode(true) as HTMLAudioElement
        s.play().catch(() => { /* ignore */ })
      }
    } catch (err) {
      console.warn('Error playing enemy death sound', err)
    }
  }

  private updateEnemyLasers(delta: number) {
    this.enemyLasers = this.enemyLasers.filter(laser => {
      const alive = laser.update(delta)
      if (!alive) {
        try { laser.destroy(this.world) } catch (err) { console.warn('enemy laser destroy failed', err) }
        return false
      }
      return true
    })
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      if (!enemy.destroyed) {
        try {
          enemy.update(delta, this.starship?.getPosition())
        } catch (err) {
          console.warn('Failed to update enemy', err)
        }
      }
    }

    // créer explosion pour ennemis détruits non encore traités
    for (const enemy of this.enemies) {
      if (enemy.destroyed && !this.processedDestroyed.has(enemy)) {
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
  }

  private updateEnemyShooters(delta: number) {
    for (const shooter of this.enemyShooters) {
      if (!shooter.destroyed) {
        try {
          shooter.update(delta, this.starship?.getPosition())

          // Create laser if shooter wants to shoot
          if (shooter.canShootLaser) {
            const laserPos = shooter.getPosition()
            const enemyLaser = new EnemyLaser(this.world, laserPos, shooter.lastShootDirection, 25)
            this.enemyLasers.push(enemyLaser)
            this.add(enemyLaser.mesh)
          }
        } catch (err) {
          console.warn('EnemyShooter update failed', err)
        }
      }
    }

    // Cleanup destroyed shooters
    this.enemyShooters = this.enemyShooters.filter(s => {
      if (s.destroyed) {
        try { s.destroy(this.world) } catch (err) { console.warn('enemyShooter.destroy failed during dispose', err) }
        return false
      }
      return true
    })
  }

  private updatePowerUps(delta: number) {
    this.powerUps.forEach(p => p.update(delta))

    // Remove power-ups too far behind
    if (this.starship) {
      const shipZ = this.starship.getPosition().z
      this.powerUps = this.powerUps.filter(p => {
        if (p.mesh.position.z > shipZ + 30) {
          p.destroy(this.world)
          return false
        }
        return true
      })
    }
  }

  private handleSpawning(delta: number) {
    // Enemy spawning
    this.spawnTimer += delta
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0

      // Random: normal enemy or shooter based on difficulty
      const shooterChance = Math.min(0.1 + this.difficultyLevel * 0.05, 0.5)
      if (Math.random() < shooterChance) {
        this.spawnEnemyShooter()
      } else {
        this.spawnEnemy()
      }
    }

    // Power-up spawning
    this.powerUpSpawnTimer += delta
    if (this.powerUpSpawnTimer >= this.powerUpSpawnInterval) {
      this.powerUpSpawnTimer = 0
      this.spawnPowerUp()
    }
  }

  private updateDifficulty(delta: number) {
    this.difficultyTimer += delta

    // Increase difficulty every 30 seconds
    const newLevel = Math.floor(this.difficultyTimer / 20) + 1
    if (newLevel > this.difficultyLevel) {
      this.difficultyLevel = newLevel

      // Reduce spawn interval (more enemies)
      this.spawnInterval = Math.max(0.4, 1.5 - this.difficultyLevel * 0.12)

      console.log(`🎮 Difficulté augmentée: niveau ${this.difficultyLevel}`)
    }
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

    this.enemyShooters.forEach(shooter => {
      if (!shooter.destroyed) {
        const helper = new BoxHelper(shooter.mesh, 0xff6600)
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
    // calculer la direction depuis la direction du vaisseau (où il pointe)
    const dir = this.starship.getForward().clone().normalize()
    const laser = new Laser(this.world, pos, dir, 40)
    this.lasers.push(laser)
    this.add(laser.mesh)

    // Double shot when rapidfire is active
    if (this.rapidFireActive) {
      const pos2 = this.starship.getPosition()
      pos2.z -= 2
      pos2.x += 0.8
      const laser2 = new Laser(this.world, pos2, dir, 40)
      this.lasers.push(laser2)
      this.add(laser2.mesh)

      const pos3 = this.starship.getPosition()
      pos3.z -= 2
      pos3.x -= 0.8
      const laser3 = new Laser(this.world, pos3, dir, 40)
      this.lasers.push(laser3)
      this.add(laser3.mesh)
    }
  }

  private spawnEnemy() {
    if (!this.starship) return
    // spawn plus loin devant et réparti sur la largeur étendue
    const x = (Math.random() - 0.5) * 50
    const y = Math.random() * 8 + 2
    const z = this.starship.getPosition().z - (60 + Math.random() * 120 + this.difficultyLevel * 5)
    // Speed increases with difficulty
    const speed = 8 + this.difficultyLevel * 1.5
    const enemy = new Enemy(this.world, new Vector3(x, y, z), speed)
    this.enemies.push(enemy)
    this.add(enemy.mesh)
  }

  private spawnEnemyShooter() {
    if (!this.starship) return
    const x = (Math.random() - 0.5) * 50
    const y = Math.random() * 6 + 3
    const z = this.starship.getPosition().z - (70 + Math.random() * 140 + this.difficultyLevel * 6)
    const speed = 6 + this.difficultyLevel
    const shooter = new EnemyShooter(this.world, new Vector3(x, y, z), speed)
    this.enemyShooters.push(shooter)
    this.add(shooter.mesh)
  }

  private spawnPowerUp() {
    if (!this.starship) return
    const x = (Math.random() - 0.5) * 16
    const y = Math.random() * 6 + 2
    const z = this.starship.getPosition().z - 40

    // Random type with weighted probability
    const types: PowerUpType[] = ['health', 'rapidfire', 'shield', 'score']
    const weights = [0.3, 0.25, 0.2, 0.25]
    const r = Math.random()
    let cumulative = 0
    let type: PowerUpType = 'score'
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i]
      if (r <= cumulative) {
        type = types[i]
        break
      }
    }

    const powerUp = new PowerUp(this.world, new Vector3(x, y, z), type)
    this.powerUps.push(powerUp)
    this.add(powerUp.mesh)
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
    // save highscore
    try {
      const name = getMachineName()
      addScore(name, this.score).catch(() => { /* ignore */ })
    } catch (err) {
      console.warn('Failed to save highscore', err)
    }
  }

  dispose () {
    this.controls.dispose()
    try { this.stats.dispose() } catch (err) { console.warn('stats dispose failed', err) }
    try { this.debug.dispose() } catch (err) { console.warn('debug dispose failed', err) }

    this.lasers.forEach(l => {
      try { l.destroy(this.world) } catch (err) { console.warn('laser.destroy failed during dispose', err) }
    })
    this.enemyLasers.forEach(l => {
      try { l.destroy(this.world) } catch (err) { console.warn('enemyLaser.destroy failed during dispose', err) }
    })
    this.enemies.forEach(e => {
      try { e.destroy(this.world) } catch (err) { console.warn('enemy.destroy failed during dispose', err) }
    })
    this.enemyShooters.forEach(s => {
      try { s.destroy(this.world) } catch (err) { console.warn('enemyShooter.destroy failed during dispose', err) }
    })
    this.powerUps.forEach(p => {
      try { p.destroy(this.world) } catch (err) { console.warn('powerUp.destroy failed during dispose', err) }
    })
    this.obstacles.forEach(o => {
      try { o.destroy(this.world) } catch (err) { console.warn('obstacle.destroy failed during dispose', err) }
    })

    this.lasers = []
    this.enemyLasers = []
    this.enemies = []
    this.enemyShooters = []
    this.powerUps = []
    this.obstacles = []
    this.explosions.forEach(ex => ex.destroy())
    this.explosions = []
    this.processedDestroyed.clear()

    // Destroy engine trail
    if (this.engineTrail) {
      this.engineTrail.destroy()
    }

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

