import {
  WebGLRenderer,
  Scene as ThreeScene,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderTarget,
  Vector2,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  NearestFilter,
  RGBAFormat
} from 'three'

export class PostProcessing {
  private renderer: WebGLRenderer
  private rt: WebGLRenderTarget
  private quadScene: ThreeScene
  private quadCamera: OrthographicCamera
  private quad: Mesh
  private resolution = new Vector2(1, 1)

  constructor(renderer: WebGLRenderer, private pixelSize = 6) {
    this.renderer = renderer

    this.rt = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat
    })

    // scene + camera pour le quad fullscreen
    this.quadScene = new ThreeScene()
    this.quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null as any }, // texture défini au runtime (typed via three internals)
        pixelSize: { value: this.pixelSize },
        resolution: { value: this.resolution }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float pixelSize;
        uniform vec2 resolution;
        varying vec2 vUv;
        void main() {
          vec2 px = pixelSize / resolution;
          // centrer l'échantillon dans le bloc
          vec2 coord = floor(vUv / px) * px + px * 0.5;
          gl_FragColor = texture2D(tDiffuse, coord);
        }
      `
    })

    this.quad = new Mesh(new PlaneGeometry(2, 2), material)
    this.quadScene.add(this.quad)
  }

  render(scene: ThreeScene, camera: PerspectiveCamera): void {
    // rendu de la scène dans le render target
    try {
      this.renderer.setRenderTarget(this.rt)
      this.renderer.render(scene, camera)
      this.renderer.setRenderTarget(null)

      // fournir la texture au shader puis dessiner le quad
      const mat = this.quad.material as ShaderMaterial
      mat.uniforms.tDiffuse.value = this.rt.texture
      mat.uniforms.pixelSize.value = this.pixelSize
      mat.uniforms.resolution.value = this.resolution

      this.renderer.render(this.quadScene, this.quadCamera)
    } catch (err) {
      console.warn('PostProcessing.render failed', err)
    }
  }

  setSize(w: number, h: number): void {
    this.renderer.getSize(this.resolution) // met à jour interne si besoin
    this.rt.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)))
    this.resolution.set(w, h)
    const mat = this.quad.material as ShaderMaterial
    mat.uniforms.resolution.value = this.resolution
  }

  setPixelSize(value: number): void {
    this.pixelSize = Math.max(1, value)
    const mat = this.quad.material as ShaderMaterial
    mat.uniforms.pixelSize.value = this.pixelSize
  }

  dispose(): void {
    try {
      this.rt.dispose()
    } catch (err) {
      console.warn('PostProcessing.dispose: rt.dispose failed', err)
    }
    try {
      this.quad.geometry.dispose()
    } catch (err) {
      console.warn('PostProcessing.dispose: geometry.dispose failed', err)
    }
    try {
      const mat = this.quad.material as ShaderMaterial
      mat.dispose()
    } catch (err) {
      console.warn('PostProcessing.dispose: material.dispose failed', err)
    }
  }
}
