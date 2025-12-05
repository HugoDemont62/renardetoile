import { Group, PerspectiveCamera, Vector3, Matrix4, Quaternion, Box3, MeshStandardMaterial, Mesh, Sphere } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class Starship {
  mesh: Group
  speed: number
  body: RigidBody
  destroyed = false
  private camera?: PerspectiveCamera
  private cameraOffset = new Vector3(0, 4, 10)

  private lateralSpeed = 8 // léger ajustement de la physique
  private verticalSpeed = 5

  private previousPosition = new Vector3()
  private minMoveEpsilon = 1e-4

  private rotationSmooth = 8
  private cameraSmooth = 6

  private shootCooldown = 0
  private shootRate = 0.2

  private modelLoaded = false

  // --- Roll / Barrel roll ---
  private rollAngleMax = Math.PI / 6 // ~30deg max bank
  private barrelRolling = false
  private barrelRollTimer = 0
  private barrelRollDuration = 0.6
  private barrelRollDirection = 1

  constructor (world: World, speed: number) {
    this.speed = speed
    this.mesh = new Group()
    this.mesh.name = 'Starship'

    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased()
    )

    this.body.setTranslation({ x: 0, y: 0, z: 0 }, true)
    this.syncMeshWithBody()
    this.previousPosition.copy(this.mesh.position)

    this.loadModel()
  }

  private async loadModel() {
    const loader = new GLTFLoader()

    try {
      const gltf = await loader.loadAsync('/models/starship.glb')

      while(this.mesh.children.length > 0) {
        this.mesh.remove(this.mesh.children[0])
      }

      this.mesh.add(gltf.scene)

      // Remplace le matériau par défaut par MeshStandardMaterial (sans `any`)
      gltf.scene.traverse((child) => {
        if (child instanceof Mesh) {
          if (child.material && !(child.material instanceof MeshStandardMaterial)) {
            child.material = new MeshStandardMaterial({
              color: 0xffffff,
              metalness: 0.3,
              roughness: 0.7
            })
          }
        }
      })

      const box = new Box3().setFromObject(gltf.scene)
      const center = box.getCenter(new Vector3())
      gltf.scene.position.sub(center)

      this.modelLoaded = true
      console.log('✅ Modèle 3D chargé avec succès')
    } catch (error) {
      console.error('❌ Erreur lors du chargement du modèle 3D:', error)

      const { BoxGeometry, Mesh, MeshStandardMaterial } = await import('three')
      const fallbackMesh = new Mesh(
        new BoxGeometry(1, 1, 3),
        new MeshStandardMaterial({ color: 0x00ff00 })
      )
      this.mesh.add(fallbackMesh)
      this.modelLoaded = true
    }
  }

  attachCamera (camera: PerspectiveCamera, offset?: Vector3) {
    this.camera = camera
    if (offset) this.cameraOffset.copy(offset)
    this.updateCamera(1)
  }

  update (deltaTime: number, input?: Vector3) {
    if (this.destroyed || !this.modelLoaded) return

    const t = this.body.translation()

    const throttleFactor = 1 + (input?.z ?? 0) * 0.5
    const forward = this.speed * throttleFactor * deltaTime
    const newX = t.x + (input?.x ?? 0) * this.lateralSpeed * deltaTime
    let newY = t.y + (input?.y ?? 0) * this.verticalSpeed * deltaTime
    const newZ = t.z - forward

    if (newY < 0) newY = 0

    this.body.setTranslation({ x: newX, y: newY, z: newZ }, true)

    this.syncMeshWithBody()

    const newPos = this.mesh.position.clone()
    const moveVec = newPos.clone().sub(this.previousPosition)
    if (moveVec.lengthSq() > this.minMoveEpsilon) {
      const dir = moveVec.normalize()
      const targetPos = newPos.clone().add(dir)

      const m = new Matrix4().lookAt(newPos, targetPos, this.mesh.up)
      const targetQuat = new Quaternion().setFromRotationMatrix(m)

      // --- Roll handling ---
      let desiredQuat = targetQuat.clone()

      if (this.barrelRolling) {
        this.barrelRollTimer += deltaTime
        const progress = Math.min(1, this.barrelRollTimer / this.barrelRollDuration)
        // inversion du sens du barrel roll (sens demandé)
        const spin = -this.barrelRollDirection * progress * Math.PI * 2
        const forwardAxis = new Vector3(0, 0, -1)
        const rollQuat = new Quaternion().setFromAxisAngle(forwardAxis, spin)
        desiredQuat = targetQuat.clone().multiply(rollQuat)

        if (progress >= 1) {
          this.barrelRolling = false
          this.barrelRollTimer = 0
        }
      } else {
        // Bank based on lateral input
        const lateral = input?.x ?? 0
        const targetRoll = -lateral * this.rollAngleMax
        const forwardAxis = new Vector3(0, 0, -1)
        const rollQuat = new Quaternion().setFromAxisAngle(forwardAxis, targetRoll)
        desiredQuat = targetQuat.clone().multiply(rollQuat)
      }

      const tSmooth = 1 - Math.exp(-this.rotationSmooth * deltaTime)
      this.mesh.quaternion.slerp(desiredQuat, tSmooth)
    }
    this.previousPosition.copy(newPos)

    this.updateCamera(deltaTime)

    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime
    }
  }

  // Permet de déclencher un barrel roll (1 = droite, -1 = gauche)
  startBarrelRoll(direction = 1) {
    if (this.barrelRolling) return
    this.barrelRolling = true
    this.barrelRollTimer = 0
    this.barrelRollDirection = Math.sign(direction) || 1
  }

  canShoot(): boolean {
    return this.shootCooldown <= 0 && this.modelLoaded
  }

  resetShootCooldown() {
    this.shootCooldown = this.shootRate
  }

  private syncMeshWithBody () {
    const t = this.body.translation()
    this.mesh.position.set(t.x, t.y, t.z)
  }

  private updateCamera (deltaTime = 0.016) {
    if (!this.camera) return

    const target = this.mesh.position.clone()

    const offset = this.cameraOffset.clone()
    offset.applyQuaternion(this.mesh.quaternion)
    const desiredCamPos = target.clone().add(offset)

    const tCam = deltaTime > 0 ? 1 - Math.exp(-this.cameraSmooth * deltaTime) : 1

    this.camera.position.lerp(desiredCamPos, tCam)

    const m = new Matrix4().lookAt(this.camera.position, target, this.camera.up)
    const targetQuat = new Quaternion().setFromRotationMatrix(m)
    this.camera.quaternion.slerp(targetQuat, tCam)

    this.camera.updateProjectionMatrix()
  }

  getPosition (): Vector3 {
    return this.mesh.position.clone()
  }

  getForward(): Vector3 {
    return new Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion)
  }

  // Retourne une sphère englobante calculée à partir du mesh (plus précise pour collisions mesh-vs-mesh)
  getCollisionSphere(): Sphere {
    const box = new Box3().setFromObject(this.mesh)
    const sphere = box.getBoundingSphere(new Sphere())
    // si trop petit, fallback centré sur le vaisseau
    if (!sphere || sphere.radius <= 0.001) {
      return new Sphere(this.getPosition(), 1.5)
    }
    return sphere
  }

  getCollisionAABB(marginX = 0.75, marginY = 0.5, marginZ = 0.5): Box3 {
    const box = new Box3().setFromObject(this.mesh)
    box.expandByVector(new Vector3(-marginX, -marginY, -marginZ))

    const size = box.getSize(new Vector3())
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
      const pos = this.getPosition()
      return new Box3().setFromCenterAndSize(pos, new Vector3(1, 1, 3))
    }

    return box
  }

  destroy (world: World) {
    if (this.destroyed) return
    this.destroyed = true
    try {
      world.removeRigidBody(this.body)
    } catch (e) {
      console.warn('removeRigidBody failed', e)
    }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}
