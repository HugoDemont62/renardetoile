import { WebGLRenderer, Scene, PerspectiveCamera, Vector2 } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'

export class PostProcessing {
  composer: EffectComposer
  private renderPass: RenderPass
  private pixelPass: ShaderPass
  private resolution = new Vector2(1, 1)

  constructor(renderer: WebGLRenderer, pixelSize = 6) {
    this.composer = new EffectComposer(renderer)

    // RenderPass initial (sera réutilisé et mis à jour chaque frame)
    this.renderPass = new RenderPass(new Scene(), new PerspectiveCamera())
    this.composer.addPass(this.renderPass)

    // Shader de pixelation
    const PixelShader = {
      uniforms: {
        tDiffuse: { value: null },
        pixelSize: { value: pixelSize },
        resolution: { value: this.resolution }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float pixelSize;
        uniform vec2 resolution;
        varying vec2 vUv;
        void main() {
          vec2 d = pixelSize / resolution;
          vec2 uv = floor(vUv / d) * d + (d * 0.5); // centre du "pixel"
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `
    }

    this.pixelPass = new ShaderPass(PixelShader as any)
    this.pixelPass.renderToScreen = true
    this.composer.addPass(this.pixelPass)
  }

  render(threeScene: Scene, camera: PerspectiveCamera) {
    // mettre à jour le RenderPass existant (évite de recréer et d'introduire des erreurs)
    this.renderPass.scene = threeScene as any
    this.renderPass.camera = camera as any

    // mettre à jour uniforms si besoin
    const uniforms: any = (this.pixelPass.uniforms as any)
    if (uniforms.resolution && uniforms.resolution.value instanceof Vector2) {
      // resolution est déjà référencée -- s'assurer qu'elle contient la bonne taille
      // size est mis à jour via setSize mais on peut recaler depuis le composer.domElement
      const dom = this.composer.renderer.domElement
      uniforms.resolution.value.set(dom.width || dom.clientWidth, dom.height || dom.clientHeight)
    }
    if (uniforms.pixelSize) {
      // pixelSize reste configurable via setPixelSize
    }

    this.composer.render()
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h)
    this.resolution.set(w, h)
    // mettre à jour uniform resolution immédiatement
    const uniforms: any = (this.pixelPass.uniforms as any)
    if (uniforms.resolution) uniforms.resolution.value.set(w, h)
  }

  setPixelSize(value: number) {
    const uniforms: any = (this.pixelPass.uniforms as any)
    if (uniforms.pixelSize) uniforms.pixelSize.value = value
  }

  dispose() {
    try { this.composer.dispose() } catch {}
  }
}