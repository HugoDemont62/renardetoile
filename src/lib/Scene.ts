import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene as ThreeScene, Vector2 } from 'three'
import { Engine } from './Engine'

export class Scene extends ThreeScene {
  engine: Engine
  camera: PerspectiveCamera
  cube: Mesh

  constructor (engine: Engine) {
    super()
    this.engine = engine

    this.camera = new PerspectiveCamera()
    this.camera.position.set(0, 0, 5)
    this.camera.lookAt(0, 0, 0)

    this.cube = this.createCube()
    this.add(this.cube)
  }

  createCube (): Mesh {
    const geom = new BoxGeometry(1, 1, 1)
    const mat = new MeshBasicMaterial({color: 0x0077ff})
    const mesh = new Mesh(geom, mat)
    mesh.position.set(0, 0, 0)
    mesh.name = 'CenterCube'
    return mesh
  }

  resize () {
    const v2 = new Vector2()
    this.engine.renderer.getSize(v2)
    this.camera.aspect = v2.x / v2.y
    this.camera.updateProjectionMatrix()
  }

  render () {
    // Pas de physique ni d'interaction — juste rendu du cube
    this.engine.renderer.render(this, this.camera)
  }
}