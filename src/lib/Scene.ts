import { Box3, PerspectiveCamera, Scene as ThreeScene, Vector2, Vector3 } from 'three'
import { Engine } from './Engine'
import { World } from '@dimforge/rapier3d'
import { Starship } from '../Class/Starship'
import { Obstacle } from '../Class/Obstacle'
import { Controls } from './Controls' // ajout

export class Scene extends ThreeScene {
  engine: Engine
  camera: PerspectiveCamera

  world: World
  starship?: Starship
  obstacles: Obstacle[] = []
  controls: Controls

  private canvasFocusHandler?: () => void

  constructor (engine: Engine) {
    super()
    this.engine = engine

    this.camera = new PerspectiveCamera(60, 1, 0.1, 1000)
    this.camera.position.set(0, 2, 6)
    this.camera.lookAt(0, 0, 0)

    // créer le monde physique (gravité optionnelle)
    this.world = new World({x: 0.0, y: 0.0, z: 0.0})

    // controls
    this.controls = new Controls()

    // starship
    this.starship = new Starship(this.world, 10) // vitesse 10 unités/s
    this.add(this.starship.mesh)
    this.starship.attachCamera(this.camera, new Vector3(0, 2, 8))

    // créer quelques obstacles (tours) devant le vaisseau
    for (let i = 1; i <= 6; i++) {
      const x = (Math.random() - 0.5) * 10
      const z = -i * 15
      const height = 6 + Math.random() * 10
      const obs = new Obstacle(this.world, new Vector3(x, height / 2, z), new Vector3(3, height, 3))
      this.obstacles.push(obs)
      this.add(obs.mesh)
    }
  }

  resize () {
    const v2 = new Vector2()
    this.engine.renderer.getSize(v2)
    this.camera.aspect = v2.x / v2.y
    this.camera.updateProjectionMatrix()
  }

  render () {
    // step physique
    const delta = this.engine.clock.getDelta()
    this.world.step()

    // lire l'input et le passer au starship
    const input = this.controls.getInput()

    if (this.starship && !this.starship.destroyed) {
      this.starship.update(delta, input)
      // collision simple AABB entre mesh threejs
      const shipBox = new Box3().setFromObject(this.starship.mesh)
      for (const obs of this.obstacles) {
        const obsBox = obs.getAABB()
        if (shipBox.intersectsBox(obsBox)) {
          // destruction
          this.starship.destroy(this.world)
          break
        }
      }
    }

    // rendu
    this.engine.renderer.render(this, this.camera)
  }

  // appeler quand tu détruis la scène pour nettoyer les listeners
  dispose () {
    this.controls.dispose()
    if (this.canvasFocusHandler) {
      this.engine.renderer.domElement.removeEventListener('click', this.canvasFocusHandler)
    }
  }
}