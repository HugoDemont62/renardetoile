import { Clock, WebGLRenderer, Scene as ThreeScene, PerspectiveCamera } from 'three'
import type { Scene } from './Scene'
import { PostProcessing } from './PostProcessing'

export class Engine {
  renderer: WebGLRenderer
  clock: Clock
  scene?: Scene
  private post?: PostProcessing

  constructor (parent?: HTMLElement) {
    this.renderer = new WebGLRenderer()
    parent?.append(this.renderer.domElement)
    this.clock = new Clock()

    this.renderer.domElement.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: block; z-index: -1; touch-action: none;`

    this.renderer.setAnimationLoop(this.update.bind(this))

    globalThis.addEventListener('resize', this.resize)

    // initialiser postprocessing (pixelSize par défaut réduit)
    this.post = new PostProcessing(this.renderer)
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
    // redimensionner composer si présent
    if (this.post) this.post.setSize(globalThis.innerWidth, globalThis.innerHeight)
    this.scene?.resize()
  }

  // méthode pour que la Scene demande le rendu — utilise composer si présent
  render(scene: ThreeScene, camera: PerspectiveCamera) {
    if (this.post) {
      this.post.render(scene, camera)
    } else {
      this.renderer.render(scene, camera)
    }
  }
}
