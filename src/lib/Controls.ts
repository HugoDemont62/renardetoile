import { Vector3 } from 'three'

export class Controls {
  private keys: Record<string, boolean> = {}

  constructor () {
    globalThis.addEventListener('keydown', this.onKeyDown)
    globalThis.addEventListener('keyup', this.onKeyUp)
  }

  dispose () {
    globalThis.removeEventListener('keydown', this.onKeyDown)
    globalThis.removeEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false
  }

  getInput (): Vector3 {
    const left = this.keys['q'] || this.keys['arrowleft']
    const right = this.keys['d'] || this.keys['arrowright']
    const up = this.keys['z'] || this.keys['arrowup']
    const down = this.keys['s'] || this.keys['arrowdown']

    const accel = this.keys[' '] || this.keys['space']
    const brake = this.keys['shift'] || this.keys['shiftleft'] || this.keys['shiftright']

    const strafe = (right ? 1 : 0) - (left ? 1 : 0)
    const lift = (up ? 1 : 0) - (down ? 1 : 0)
    const throttle = (accel ? 1 : 0) - (brake ? 1 : 0)

    // retourner en tant que Vector3 (x=strafe, y=lift, z=throttle)
    return new Vector3(strafe, lift, throttle)
  }
}