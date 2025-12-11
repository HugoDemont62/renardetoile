import { Box3, BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d'

export class EnemyShooter {
  mesh: Group
  body: RigidBody
  speed: number
  destroyed = false

  private shootCooldown = 0
  private shootRate = 2.5 // Tire toutes les 2.5 secondes
  canShootLaser = false // Le laser sera créé par Scene
  lastShootDirection = new Vector3()

  constructor(world: World, position: Vector3, speed: number) {
    this.speed = speed
    this.mesh = new Group()
    this.mesh.name = 'EnemyShooter'

    // Corps principal (rouge foncé)
    const bodyGeom = new BoxGeometry(1.8, 1.0, 2.5)
    const bodyMat = new MeshStandardMaterial({
      color: 0x8b0000,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0x220000,
      emissiveIntensity: 0.5
    })
    const bodyMesh = new Mesh(bodyGeom, bodyMat)
    this.mesh.add(bodyMesh)

    // Ailes (triangulaires)
    const wingGeom = new ConeGeometry(0.8, 2, 3)
    const wingMat = new MeshStandardMaterial({
      color: 0x660000,
      metalness: 0.5,
      roughness: 0.5
    })

    const leftWing = new Mesh(wingGeom, wingMat)
    leftWing.rotation.z = Math.PI / 2
    leftWing.rotation.y = Math.PI / 2
    leftWing.position.set(-1.5, 0, 0)
    this.mesh.add(leftWing)

    const rightWing = new Mesh(wingGeom, wingMat)
    rightWing.rotation.z = -Math.PI / 2
    rightWing.rotation.y = Math.PI / 2
    rightWing.position.set(1.5, 0, 0)
    this.mesh.add(rightWing)

    // Canon (jaune lumineux)
    const cannonGeom = new BoxGeometry(0.2, 0.2, 1)
    const cannonMat = new MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 1
    })
    const cannon = new Mesh(cannonGeom, cannonMat)
    cannon.position.set(0, -0.3, 1.2)
    this.mesh.add(cannon)

    this.mesh.position.copy(position)

    this.body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased())
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true)
  }

  update(deltaTime: number, targetPos?: Vector3) {
    if (this.destroyed) return

    const t = this.body.translation()
    let newX = t.x
    let newY = t.y

    // Mouvement latéral pour suivre le joueur
    if (targetPos && t.z > targetPos.z - 40) {
      const dx = targetPos.x - t.x
      const dy = targetPos.y - t.y
      newX += dx * 0.5 * deltaTime
      newY += dy * 0.5 * deltaTime
    }

    const newZ = t.z + this.speed * deltaTime

    this.body.setTranslation({ x: newX, y: newY, z: newZ }, true)
    this.mesh.position.set(newX, newY, newZ)

    // Rotation vers le joueur
    if (targetPos) {
      this.mesh.lookAt(targetPos)
    }

    // Cooldown de tir
    this.shootCooldown -= deltaTime
    this.canShootLaser = false

    if (this.shootCooldown <= 0 && targetPos) {
      const dist = this.mesh.position.distanceTo(targetPos)
      if (dist < 35) { // Tire seulement si assez proche
        this.canShootLaser = true
        this.lastShootDirection = targetPos.clone().sub(this.mesh.position).normalize()
        this.shootCooldown = this.shootRate
      }
    }
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone()
  }

  getAABB(): Box3 {
    return new Box3().setFromObject(this.mesh)
  }

  destroy(world: World) {
    if (this.destroyed) return
    this.destroyed = true
    try {
      world.removeRigidBody(this.body)
    } catch { /* ignore */ }
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh)
  }
}

