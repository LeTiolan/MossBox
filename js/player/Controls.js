/* =========================================================
   MossBox — Player Controls
   Pointer-lock mouse look + keyboard movement. Reads actions
   through the keybindManager so remapped keys "just work"
   everywhere without this file knowing physical key codes.
   ========================================================= */

import { keybindManager } from '../config/keybinds.js';
import { getBlock } from '../config/blocks.js';

const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.5;
const SNEAK_SPEED = 2.0;
const JUMP_VELOCITY = 8.4;
const GRAVITY = -24;

export class Controls {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.position = new THREE.Vector3(0, 90, 0);

    this.onGround = false;
    this.isLocked = false;
    this.enabled = false;

    this._keysDown = new Set();
    this._bindEvents();
  }

  _bindEvents() {
    document.addEventListener('keydown', (e) => this._keysDown.add(e.code));
    document.addEventListener('keyup', (e) => this._keysDown.delete(e.code));

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked || !this.enabled) return;
      const sensitivity = 0.0022;
      this.euler.y -= e.movementX * sensitivity;
      this.euler.x -= e.movementY * sensitivity;
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });
  }

  lock() { this.domElement.requestPointerLock(); }
  unlock() { document.exitPointerLock(); }

  _isActionDown(action) {
    const binding = keybindManager.bindings[action];
    return binding && binding.key && this._keysDown.has(binding.key);
  }

  update(dt) {
    if (!this.enabled) return;

    const forward = this._isActionDown('moveForward');
    const backward = this._isActionDown('moveBackward');
    const left = this._isActionDown('moveLeft');
    const right = this._isActionDown('moveRight');
    const sprinting = this._isActionDown('sprint');
    const sneaking = this._isActionDown('sneak');
    const wantsJump = this._isActionDown('jump');

    let speed = sprinting ? SPRINT_SPEED : sneaking ? SNEAK_SPEED : WALK_SPEED;

    const moveDir = new THREE.Vector3();
    if (forward) moveDir.z -= 1;
    if (backward) moveDir.z += 1;
    if (left) moveDir.x -= 1;
    if (right) moveDir.x += 1;
    moveDir.normalize();

    // Move relative to look direction (Y-only yaw, ignore pitch for walking).
    const yaw = this.euler.y;
    const forwardVec = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const rightVec = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const desired = new THREE.Vector3()
      .addScaledVector(forwardVec, -moveDir.z)
      .addScaledVector(rightVec, moveDir.x);

    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(speed);

    this.velocity.x = desired.x;
    this.velocity.z = desired.z;

    // Gravity + jump
    this.velocity.y += GRAVITY * dt;
    if (wantsJump && this.onGround) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
    }

    this._moveWithCollision(dt);
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, 1.62, 0));
  }

  _isSolid(x, y, z) {
    const id = this.world.getBlockId(Math.floor(x), Math.floor(y), Math.floor(z));
    if (id === 0) return false;
    const block = getBlock(id);
    // Only registry-flagged solid blocks collide — tall grass, flowers,
    // torches, water, sugar cane, etc. are all walkable/swimmable.
    return !!block?.solid;
  }

  _moveWithCollision(dt) {
    const step = (axis) => {
      const delta = this.velocity[axis] * dt;
      const next = this.position.clone();
      next[axis] += delta;

      const half = 0.3; // player horizontal half-width
      const feet = next.y;
      const head = next.y + 1.7;

      let blocked = false;
      if (axis === 'y') {
        const checkY = delta < 0 ? Math.floor(feet) : Math.floor(head);
        blocked = this._isSolid(next.x, checkY, next.z);
        if (blocked) {
          if (delta < 0) this.onGround = true;
          this.velocity.y = 0;
        } else if (delta < 0) {
          this.onGround = false;
        }
      } else {
        for (const dy of [0.1, 1.5]) {
          if (this._isSolid(next.x + (axis === 'x' ? Math.sign(delta) * half : 0), feet + dy, next.z + (axis === 'z' ? Math.sign(delta) * half : 0))) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) this.position[axis] = next[axis];
    };

    step('x');
    step('z');
    step('y');
  }
}
