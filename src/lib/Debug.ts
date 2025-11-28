export class Debug {
  invincible = false
  showHitboxes = false
  noClip = false
  speedMultiplier = 1

  private container: HTMLDivElement
  private debugInfo: HTMLDivElement

  constructor() {
    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #ffff00;
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      border: 2px solid #ffff00;
      z-index: 1000;
      min-width: 250px;
    `

    const title = document.createElement('div')
    title.style.cssText = 'margin-bottom: 5px; font-weight: bold;'

    this.debugInfo = document.createElement('div')

    const instructions = document.createElement('div')
    instructions.style.cssText = 'margin-top: 10px; font-size: 12px; opacity: 0.8;'
    instructions.innerHTML = `
      F1: Toggle Debug<br>
      F2: Invincible<br>
      F3: Show Hitboxes<br>
      F4: NoClip<br>
      +/-: Speed
    `

    this.container.appendChild(title)
    this.container.appendChild(this.debugInfo)
    this.container.appendChild(instructions)

    document.body.appendChild(this.container)
    this.hide()

    this.setupKeyBindings()
  }

  private setupKeyBindings() {
    window.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'F1':
          e.preventDefault()
          this.toggle()
          break
        case 'F2':
          e.preventDefault()
          this.invincible = !this.invincible
          this.updateDisplay()
          break
        case 'F3':
          e.preventDefault()
          this.showHitboxes = !this.showHitboxes
          this.updateDisplay()
          break
        case 'F4':
          e.preventDefault()
          this.noClip = !this.noClip
          this.updateDisplay()
          break
        case '+':
        case '=':
          this.speedMultiplier = Math.min(5, this.speedMultiplier + 0.5)
          this.updateDisplay()
          break
        case '-':
        case '_':
          this.speedMultiplier = Math.max(0.5, this.speedMultiplier - 0.5)
          this.updateDisplay()
          break
      }
    })
  }

  private updateDisplay() {
    this.debugInfo.innerHTML = `
      Invincible: ${this.invincible ? 'ON' : 'OFF'}<br>
      Hitboxes: ${this.showHitboxes ? 'ON' : 'OFF'}<br>
      NoClip: ${this.noClip ? 'ON' : 'OFF'}<br>
      Speed: x${this.speedMultiplier.toFixed(1)}
    `
  }

  toggle() {
    if (this.container.style.display === 'none') {
      this.show()
    } else {
      this.hide()
    }
  }

  show() {
    this.container.style.display = 'block'
    this.updateDisplay()
  }

  hide() {
    this.container.style.display = 'none'
  }

  dispose() {
    document.body.removeChild(this.container)
  }
}
