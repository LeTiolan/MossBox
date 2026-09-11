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
import { showToast } from '../ui/Toast.js';

const REACH_DISTANCE = 5;
const STEP = 0.05;

// Fluids can only be collected with a bucket, and only placed back down
// via a filled bucket — mining or placing them bare-handed is a no-op,
// same as vanilla Minecraft. Keyed by fluid block id so water and lava
// share one code path below instead of two near-duplicate branches.
const FLUID_BUCKET_ITEMS = {
  [getBlock('water').id]: { emptyItem: 'bucket', filledItem: 'water_bucket', fluidBlock: 'water' },
  [getBlock('lava').id]: { emptyItem: 'bucket', filledItem: 'lava_bucket', fluidBlock: 'lava' },
};

// Tool-tier gating for blocks.js's requiresTool field (e.g. 'stone_pickaxe').
// A higher tier always satisfies a lower requirement, same as Minecraft —
// only the tool *type* (pickaxe/axe/etc, parsed from the item name) has to
// match exactly.
const TOOL_TIER_RANK = { wood: 0, stone: 1, iron: 2, gold: 3, diamond: 4 };

function meetsToolRequirement(requiresTool, heldItem) {
  if (!requiresTool) return true;
  if (!heldItem) return false;
  const [reqTier, reqType] = requiresTool.split('_');
  const [heldTier, heldType] = heldItem.split('_');
  if (heldType !== reqType) return false;
  return (TOOL_TIER_RANK[heldTier] ?? -1) >= (TOOL_TIER_RANK[reqTier] ?? 0);
}

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

    const stack = this.inventory.getSelectedStack();

    // Fluids: only scoop-able with an empty bucket in hand — otherwise
    // left-click does nothing at all, it isn't "minable" like a solid.
    const fluidInfo = FLUID_BUCKET_ITEMS[id];
    if (fluidInfo) {
      if (stack?.item !== fluidInfo.emptyItem) return;

      this.world.setBlockId(target.x, target.y, target.z, getBlock('air').id);
      this._rebuildAffectedChunks(target.x, target.z);
      this.inventory.removeFromSelected(1);
      this.inventory.addItem(fluidInfo.filledItem, 1);
      audio.play('block.place.generic', { volume: 0.4 });
      showToast(`Filled ${fluidInfo.filledItem.replace('_', ' ')}`);
      return;
    }

    // Tool-tier gating: blocks.js already defines requiresTool on several
    // ores (e.g. iron_ore needs at least a stone_pickaxe) — this was never
    // actually enforced anywhere before now, so mining worked regardless
    // of what you held.
    if (block.requiresTool && !meetsToolRequirement(block.requiresTool, stack?.item)) {
      showToast(`Need a ${block.requiresTool.replace('_', ' ')}`);
      return;
    }

    this.world.setBlockId(target.x, target.y, target.z, getBlock('air').id);
    this._rebuildAffectedChunks(target.x, target.z);

    audio.play(`block.break.${block.texture}`);
    audio.play('block.break.generic', { volume: 0.4 });

    const dropId = block.drops || block.texture || null;
    if (dropId) {
      this.inventory.addItem(dropId, 1);
      const dropBlock = getBlock(dropId);
      showToast(`+1 ${dropBlock?.name || dropId}`);
    }
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

    // Filled buckets are a special case: they place a fluid source block
    // and return to an empty bucket, rather than being a placeable block
    // themselves (they have no entry in the block registry at all).
    const filledFluid = Object.values(FLUID_BUCKET_ITEMS).find((f) => f.filledItem === stack.item);
    if (filledFluid) {
      const { x, y, z } = target.placeAt;
      this.world.setBlockId(x, y, z, getBlock(filledFluid.fluidBlock).id);
      this._rebuildAffectedChunks(x, z);
      this.inventory.removeFromSelected(1);
      this.inventory.addItem(filledFluid.emptyItem, 1);
      audio.play('block.place.generic', { volume: 0.4 });
      return;
    }

    const blockToPlace = getBlock(stack.item);
    if (!blockToPlace) return; // held item isn't a placeable block (tool/food/etc.)
    if (FLUID_BUCKET_ITEMS[blockToPlace.id]) return; // fluids are never directly placeable — only via a filled bucket

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
