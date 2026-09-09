/* =========================================================
   MossBox — Player Interaction
   Handles the two core mouse actions:
     Left click  -> destroy the targeted block
     Right click -> place the held block, or interact with a
                    workstation/interactable if one is targeted
   Uses a simple voxel DDA raycast (marching along the look
   ray in small steps) rather than Three.js raycaster-against-
   meshes, since block geometry is merged per-type per-chunk
   and would otherwise return the wrong block on merged faces.
   ========================================================= */

import { getBlock } from '../config/blocks.js';
import { audio } from '../audio/AudioManager.js';

const REACH_DISTANCE = 5;
const STEP = 0.05;

export class Interaction {
  constructor({ camera, world, chunkManager, inventory, onOpenWorkstation }) {
    this.camera = camera;
    this.world = world;
    this.chunkManager = chunkManager;
    this.inventory = inventory;
    this.onOpenWorkstation = onOpenWorkstation;

    this.enabled = false;
    this.hoveredBlock = null; // { x, y, z, faceNormal }

    document.addEventListener('mousedown', (e) => this._onMouseDown(e));
  }

  /** Call every frame to keep the hover/highlight target up to date. */
  update() {
    this.hoveredBlock = this.enabled ? this._raycast() : null;
  }

  _raycast() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let lastEmpty = null;
    for (let t = 0; t < REACH_DISTANCE; t += STEP) {
      const point = origin.clone().addScaledVector(dir, t);
      const bx = Math.floor(point.x), by = Math.floor(point.y), bz = Math.floor(point.z);
      const id = this.world.getBlockId(bx, by, bz);

      if (id !== 0) {
        return { x: bx, y: by, z: bz, placeAt: lastEmpty };
      }
      lastEmpty = { x: bx, y: by, z: bz };
    }
    return null;
  }

  _onMouseDown(e) {
    if (!this.enabled || document.pointerLockElement == null) return;

    if (e.button === 0) this._breakBlock();
    else if (e.button === 2) this._placeOrInteract();
  }

  _breakBlock() {
    const target = this.hoveredBlock;
    if (!target) return;

    const id = this.world.getBlockId(target.x, target.y, target.z);
    const block = getBlock(id);
    if (!block || block.unbreakable) return;

    this.world.setBlockId(target.x, target.y, target.z, getBlock('air').id);
    this._rebuildAffectedChunks(target.x, target.z);

    audio.play(`block.break.${block.texture}`);
    audio.play('block.break.generic', { volume: 0.4 });

    const dropId = block.drops || block.texture || null;
    if (dropId) this.inventory.addItem(dropId, 1);
  }

  _placeOrInteract() {
    const target = this.hoveredBlock;
    if (!target) return;

    const targetId = this.world.getBlockId(target.x, target.y, target.z);
    const targetBlock = getBlock(targetId);

    if (targetBlock?.workstation) {
      this.onOpenWorkstation?.(targetBlock.workstation, target);
      return;
    }

    if (!target.placeAt) return;
    const stack = this.inventory.getSelectedStack();
    if (!stack) return;

    const blockToPlace = getBlock(stack.item);
    if (!blockToPlace) return; // held item isn't a placeable block (tool/food/etc.)

    const { x, y, z } = target.placeAt;
    this.world.setBlockId(x, y, z, blockToPlace.id);
    this._rebuildAffectedChunks(x, z);
    this.inventory.removeFromSelected(1);

    audio.play('block.place.generic', { volume: 0.4 });
  }

  _rebuildAffectedChunks(x, z) {
    const { cx, cz } = this.world.worldToChunkCoords(x, z);
    this.chunkManager.rebuildChunk(cx, cz);
    // Also rebuild neighbor chunks if the edit was on a chunk boundary,
    // since face-culling meshing depends on neighbor data.
    const localX = ((x % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;
    if (localX === 0) this.chunkManager.rebuildChunk(cx - 1, cz);
    if (localX === 15) this.chunkManager.rebuildChunk(cx + 1, cz);
    if (localZ === 0) this.chunkManager.rebuildChunk(cx, cz - 1);
    if (localZ === 15) this.chunkManager.rebuildChunk(cx, cz + 1);
  }
}
