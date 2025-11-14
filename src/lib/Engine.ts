import { Clock, WebGLRenderer } from 'three'
import type { Scene } from './Scene.ts'

export class Engine {
  renderer: WebGLRenderer
  clock: Clock
  scene?: Scene

  constructor (parent?: HTMLElement) {
    this.renderer = new WebGLRenderer()
    parent?.append(this.renderer.domElement)
    this.clock = new Clock()

    this.renderer.domElement.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: block; z-index: -1;`

    this.renderer.setAnimationLoop(this.update.bind(this))

    globalThis.addEventListener('resize', this.resize)
  }

  setScene(S: new (engine: Engine) => Scene) {
    this.scene = new S(this)
    this.resize()
  }

  setPixelRatio(pixelRatio: number) {
    this.renderer.setPixelRatio(Math.min(2, pixelRatio))
  }

  update() {
    this.scene?.render()
  }

  resize = () => {
    this.renderer.setSize(globalThis.innerWidth, globalThis.innerHeight)
    this.scene?.resize()
  }
}