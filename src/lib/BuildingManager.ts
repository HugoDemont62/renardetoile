import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, TextureLoader, RepeatWrapping } from 'three'
import { World } from '@dimforge/rapier3d'
import { Obstacle } from '../Class/Obstacle'
import { Pool } from './Pool'
import { Vector3 } from 'three'

type Tile = {
  col: number
  row: number
  obstacle?: Obstacle
}

export class BuildingManager {
  private scene: Scene
  private world: World
  private pool: Pool<Obstacle>
  private activeTiles = new Map<string, Tile>()

  // background side buildings par row (grandes masses statiques, pas de physique)
  private backgroundMeshes = new Map<string, Mesh[]>()
  // garde la colonne de passage par row pour éviter flicker
  private rowPassages = new Map<number, number>()

  // configuration
  private tileDepth = 30
  private cols = 5
  private rowsAhead = 60 // étendre significativement devant le joueur
  private rowsBehind = 2
  private areaWidth = 20
  private texture = '/textures/building.jpg'
  private scaleMultiplier = 2

  constructor (scene: Scene, world: World, opts: { cols?: number, tileDepth?: number, areaWidth?: number, rowsAhead?: number, rowsBehind?: number, texture?: string, scaleMultiplier?: number } = {}) {
    this.scene = scene
    this.world = world
    this.pool = new Pool<Obstacle>()

    if (opts.cols) this.cols = opts.cols
    if (opts.tileDepth) this.tileDepth = opts.tileDepth
    if (opts.areaWidth) this.areaWidth = opts.areaWidth
    if (opts.rowsAhead) this.rowsAhead = opts.rowsAhead
    if (opts.rowsBehind) this.rowsBehind = opts.rowsBehind
    if (opts.texture) this.texture = opts.texture
    if (opts.scaleMultiplier) this.scaleMultiplier = opts.scaleMultiplier
  }

  init () {
    // Pré-créer un certain nombre d'obstacles et les mettre dans le pool
    const total = this.cols * (this.rowsAhead + this.rowsBehind + 1)
    // Cap pour éviter de sur-allouer lorsque rowsAhead est très grand
    const cap = 300
    const toCreate = Math.min(total, cap)
    for (let i = 0; i < toCreate; i++) {
      // placer hors-scène pour l'instant
      const size = new Vector3(3 * this.scaleMultiplier, (6 + Math.random() * 10) * this.scaleMultiplier, 3 * this.scaleMultiplier)
      const pos = new Vector3(0, -1000, 0)
      const ob = new Obstacle(this.world, pos, size, this.texture)
      ob.deactivate()
      this.pool.release(ob)
    }
  }

  dispose () {
    // détruire tous les obstacles (actifs + pool)
    this.activeTiles.forEach(t => {
      if (t.obstacle) {
        t.obstacle.destroy(this.world)
      }
    })
    this.activeTiles.clear()

    // détruire backgrounds
    this.backgroundMeshes.forEach(ms => {
      ms.forEach(m => {
        if (m.parent) m.parent.remove(m)
        // dispose safely without using `any`
        try {
          const g = m.geometry as { dispose?: () => void }
          if (g && typeof g.dispose === 'function') g.dispose()
        } catch (e) { void e }
        try {
          if (Array.isArray(m.material)) {
            ;(m.material as Array<{ dispose?: () => void }>).forEach(mm => { if (mm && typeof mm.dispose === 'function') mm.dispose() })
          } else {
            const mat = m.material as { dispose?: () => void }
            if (mat && typeof mat.dispose === 'function') mat.dispose()
          }
        } catch (e) { void e }
      })
    })
    this.backgroundMeshes.clear()

    // vider pool
    while (this.pool.size() > 0) {
      const o = this.pool.acquire()
      if (!o) break
      try { o.destroy(this.world) } catch (e) { void e }
    }
  }

  private key (col: number, row: number) {
    return `${col},${row}`
  }

  // Retourne la liste d'obstacles actifs pour la collision
  getActiveObstacles () {
    const res: Obstacle[] = []
    this.activeTiles.forEach(t => { if (t.obstacle) res.push(t.obstacle) })
    return res
  }

  private ensureRowPassage (row: number, halfCols: number) {
    if (this.rowPassages.has(row)) return this.rowPassages.get(row) as number
    // Choisit une colonne comme passage (favorise le centre)
    const centerBias = 0.7
    const r = Math.random()
    let chosen = 0
    if (r < centerBias) {
      chosen = Math.floor((Math.random() - 0.5) * Math.max(1, halfCols / 2))
    } else {
      chosen = Math.floor((Math.random() - 0.5) * (halfCols * 2 + 1))
    }
    // clamp
    chosen = Math.max(-halfCols, Math.min(halfCols, chosen))
    this.rowPassages.set(row, chosen)
    return chosen
  }

  private createSideBuildings (row: number, playerZ: number) {
    const key = `bg_${row}`
    if (this.backgroundMeshes.has(key)) return
    const loader = new TextureLoader()
    const tex = loader.load(this.texture)
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(1, 1)

    const mat = new MeshStandardMaterial({ map: tex })
    const meshes: Mesh[] = []
    // créer 2-4 très gros volumes à gauche et à droite, loin derrière pour effet de skyline
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const width = 40 + Math.random() * 80
      const height = 60 + Math.random() * 240
      const depth = 20 + Math.random() * 80
      const geom = new BoxGeometry(width, height, depth)

      // très en arrière pour éviter d'interférer avec le gameplay
      const z = playerZ - (row * this.tileDepth) - 400 - Math.random() * 300
      const y = -2 + height / 2

      const xL = -this.areaWidth / 2 - 60 - Math.random() * 120 - i * 20
      const mL = new Mesh(geom.clone(), mat)
      mL.position.set(xL, y, z)
      mL.rotateY(Math.PI / 20)
      this.scene.add(mL)
      meshes.push(mL)

      const xR = this.areaWidth / 2 + 60 + Math.random() * 120 + i * 20
      const mR = new Mesh(geom.clone(), mat)
      mR.position.set(xR, y, z)
      mR.rotateY(-Math.PI / 20)
      this.scene.add(mR)
      meshes.push(mR)
    }

    this.backgroundMeshes.set(key, meshes)
  }

  update (playerPos: Vector3) {
    const halfCols = Math.floor(this.cols / 2)
    const desired = new Set<string>()

    for (let c = -halfCols; c <= halfCols; c++) {
      for (let r = -this.rowsBehind; r <= this.rowsAhead; r++) {
        const k = this.key(c, r)
        desired.add(k)
        if (!this.activeTiles.has(k)) {
          // choisir passage pour cette ligne (on ne spawn pas de building sur cette colonne)
          const passage = this.ensureRowPassage(r, halfCols)
          if (c === passage) {
            continue
          }
          // need to spawn or recycle
          let ob = this.pool.acquire()
          if (!ob) {
            // recycle the farthest tile
            let farKey: string | null = null
            let farDist = -Infinity
            this.activeTiles.forEach((t, kk) => {
              const dz = t.row - r
              const dist = Math.abs(dz) + Math.abs(t.col - c)
              if (dist > farDist) {
                farDist = dist
                farKey = kk
              }
            })
            if (farKey) {
              const t = this.activeTiles.get(farKey)
              if (t && t.obstacle) {
                ob = t.obstacle
                t.obstacle = undefined
                this.activeTiles.delete(farKey)
              }
            }
          }

          if (ob) {
            const worldX = (c / Math.max(1, halfCols)) * (this.areaWidth / 2) + (Math.random() - 0.5) * 1.5
            const height = ob.size?.y ?? (6 * this.scaleMultiplier)
            const posY = -2 + (height / 2)
            const worldZ = playerPos.z - (r * this.tileDepth) - Math.random() * (this.tileDepth * 0.3)
            ob.reset(new Vector3(worldX, posY, worldZ))
            this.scene.add(ob.mesh)
            this.activeTiles.set(k, {col: c, row: r, obstacle: ob})
            // créer de grands immeubles latéraux loin derrière pour la profondeur
            if (Math.abs(c) === halfCols) {
              this.createSideBuildings(r, playerPos.z)
            }
          }
        }
      }
    }

    // release tiles not desired anymore
    const toRemove: string[] = []
    this.activeTiles.forEach((t, k) => {
      if (!desired.has(k)) {
        if (t.obstacle) {
          t.obstacle.deactivate()
          this.pool.release(t.obstacle)
        }
        toRemove.push(k)
      }
    })
    toRemove.forEach(k => this.activeTiles.delete(k))
  }
}
