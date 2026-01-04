import { Vector3 } from 'three'

export class Controls {
  private keys: Record<string, boolean> = {}
  private shoot = false
  private eventTarget: EventTarget

  // Touch / pointer controls
  private moveTouchId: number | null = null
  private moveStartX = 0
  private moveStartY = 0
  private moveCurrentX = 0
  private touchStrafe = 0
  private touchLift = 0

  private shootPressed = false // true while touching right side
  private lastShotTime = 0
  private shootInterval = 150 // ms between auto-shots when holding

  constructor (target?: EventTarget) {
    this.eventTarget = target || globalThis

    // Garder les écouteurs clavier globaux pour le desktop (ne pas perdre l'ancien système)
    globalThis.addEventListener('keydown', this.onKeyDown as EventListener)
    globalThis.addEventListener('keyup', this.onKeyUp as EventListener)

    // pointer events for touch devices (works for touch + pen; ignores mouse)
    this.eventTarget.addEventListener('pointerdown', this.onPointerDown as EventListener)
    this.eventTarget.addEventListener('pointermove', this.onPointerMove as EventListener)
    this.eventTarget.addEventListener('pointerup', this.onPointerUp as EventListener)
    this.eventTarget.addEventListener('pointercancel', this.onPointerUp as EventListener)
  }

  dispose () {
    // Retirer écouteurs clavier globaux
    globalThis.removeEventListener('keydown', this.onKeyDown as EventListener)
    globalThis.removeEventListener('keyup', this.onKeyUp as EventListener)

    this.eventTarget.removeEventListener('pointerdown', this.onPointerDown as EventListener)
    this.eventTarget.removeEventListener('pointermove', this.onPointerMove as EventListener)
    this.eventTarget.removeEventListener('pointerup', this.onPointerUp as EventListener)
    this.eventTarget.removeEventListener('pointercancel', this.onPointerUp as EventListener)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true
    if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
      this.shoot = true
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false
  }

  // Pointer/touch handlers
  private onPointerDown = (e: PointerEvent) => {
    // only handle touch/pen to avoid interfering with mouse desktop behavior
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return

    const w = (globalThis as unknown as Window).innerWidth || (document && document.documentElement && document.documentElement.clientWidth) || 0
    // left half = movement joystick, right half = shoot
    if (e.clientX <= w / 2) {
      this.moveTouchId = e.pointerId
      this.moveStartX = e.clientX
      this.moveStartY = e.clientY
      this.moveCurrentX = e.clientX
      this.touchStrafe = 0
      this.touchLift = 0
    } else {
      this.shootPressed = true
      // allow immediate shot
      this.lastShotTime = 0
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    if (this.moveTouchId !== null && e.pointerId === this.moveTouchId) {
      this.moveCurrentX = e.clientX
      const dx = this.moveCurrentX - this.moveStartX
      const dy = e.clientY - this.moveStartY
      const max = 100 // pixels of travel to reach full input
      const sx = Math.max(-1, Math.min(1, dx / max))
      const sy = Math.max(-1, Math.min(1, dy / max))
      this.touchStrafe = sx
      // screen y increases downward, so invert for lift (up => positive)
      this.touchLift = -sy
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    if (this.moveTouchId !== null && e.pointerId === this.moveTouchId) {
      this.moveTouchId = null
      this.touchStrafe = 0
      this.touchLift = 0
    } else {
      // releasing a non-movement pointer likely releases shooting
      this.shootPressed = false
    }
  }

  getInput (): Vector3 {
    const left = this.keys['q'] || this.keys['arrowleft']
    const right = this.keys['d'] || this.keys['arrowright']
    const up = this.keys['z'] || this.keys['arrowup']
    const down = this.keys['s'] || this.keys['arrowdown']

    const accel = this.keys[' '] || this.keys['space']
    const brake = this.keys['shift'] || this.keys['shiftleft'] || this.keys['shiftright']

    let strafe = (right ? 1 : 0) - (left ? 1 : 0)
    let lift = (up ? 1 : 0) - (down ? 1 : 0)
    const throttle = (accel ? 1 : 0) - (brake ? 1 : 0)

    // if touch joystick active, override horizontal/vertical
    if (this.moveTouchId !== null) {
      strafe = this.touchStrafe
      lift = this.touchLift
    }

    return new Vector3(strafe, lift, throttle)
  }

  getShoot(): boolean {
    // keyboard / button press
    if (this.shoot) {
      this.shoot = false
      return true
    }

    // touch: support both tap (single quick press) and hold (auto-fire)
    if (this.shootPressed) {
      const now = Date.now()
      if (now - this.lastShotTime >= this.shootInterval) {
        this.lastShotTime = now
        return true
      }
    }

    return false
  }
}