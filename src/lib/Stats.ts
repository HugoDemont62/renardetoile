export class Stats {
  private container: HTMLDivElement
  private fpsDisplay: HTMLDivElement
  private entityDisplay: HTMLDivElement
  private positionDisplay: HTMLDivElement

  private frames = 0
  private lastTime = performance.now()
  private fps = 0

  private visible = true

  constructor() {
    // Ne pas afficher les stats automatiquement sur mobile/tactile ou écrans étroits
    const isTouchDevice = (typeof navigator !== 'undefined' && ('maxTouchPoints' in navigator && (navigator as any).maxTouchPoints > 0)) || (typeof window !== 'undefined' && 'ontouchstart' in window) || (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    const smallScreen = typeof window !== 'undefined' && (window.innerWidth < 900)

    this.visible = !(isTouchDevice || smallScreen)

    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      border: 2px solid #00ff00;
      z-index: 1000;
      min-width: 200px;
    `

    this.fpsDisplay = document.createElement('div')
    this.entityDisplay = document.createElement('div')
    this.positionDisplay = document.createElement('div')

    this.container.appendChild(this.fpsDisplay)
    this.container.appendChild(this.entityDisplay)
    this.container.appendChild(this.positionDisplay)

    if (this.visible) {
      document.body.appendChild(this.container)
    }
  }

  update(entities: { lasers: number; enemies: number; obstacles: number }, position?: { x: number; y: number; z: number }) {
    if (!this.visible) return

    this.frames++
    const currentTime = performance.now()

    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime))
      this.frames = 0
      this.lastTime = currentTime
    }

    this.fpsDisplay.innerHTML = `FPS: ${this.fps}`
    this.entityDisplay.innerHTML = `
      Lasers: ${entities.lasers}<br>
      Enemies: ${entities.enemies}<br>
      Obstacles: ${entities.obstacles}
    `

    if (position) {
      this.positionDisplay.innerHTML = `
        X: ${position.x.toFixed(1)}<br>
        Y: ${position.y.toFixed(1)}<br>
        Z: ${position.z.toFixed(1)}
      `
    }
  }

  show() {
    if (this.visible) return
    this.visible = true
    if (!this.container.parentElement) document.body.appendChild(this.container)
  }

  hide() {
    if (!this.visible) return
    this.visible = false
    if (this.container.parentElement) document.body.removeChild(this.container)
  }

  dispose() {
    if (this.container.parentElement) document.body.removeChild(this.container)
  }
}