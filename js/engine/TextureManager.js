/* =========================================================
   MossBox — Texture Manager
   PERFORMANCE REWRITE: instead of one material per distinct
   block type (meaning every chunk could rack up 8-10+ draw
   calls just from having stone, dirt, grass, flowers, water,
   leaves, etc. all present), every block now falls into one
   of 4 shared categories, each with exactly ONE material
   reused across the entire game:

     opaque      — solid non-transparent blocks (stone, dirt,
                   moss, wood, ores, sand, planks, cactus...)
     cutout      — cross-shaped decor (tall grass, flowers,
                   sugar cane, dead bush)
     fluid       — water, lava
     foliage     — leaves, glass, glass_pane

   Since one material can't have a different color per block,
   each vertex now carries its own RGB color (from that
   block's registry `color`) instead — this is exactly the
   category of optimization behind Minecraft's Sodium/
   "Fabulously Optimized"-style mods: draw-call count is the
   single biggest lever on weak integrated GPUs, far more than
   triangle count for a voxel game at this scale.

   TRADEOFF: this removes the earlier "auto-upgrade to a real
   PNG texture per block" behavior — different blocks sharing
   one material can't each have their own texture image without
   a texture ATLAS (one shared sheet + a per-block UV offset,
   still compatible with one material per category). That's the
   standard real solution and a reasonable follow-up, just a
   larger separate task than this performance pass. For now
   every block still renders as its registry color, just via
   vertex colors instead of a per-block material.
   ========================================================= */

class TextureManager {
  constructor() {
    this._materials = {
      opaque: new THREE.MeshLambertMaterial({ vertexColors: true }),
      cutout: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      fluid: new THREE.MeshLambertMaterial({
        vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
      }),
      foliage: new THREE.MeshLambertMaterial({
        vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      }),
    };
  }

  /** Which of the 4 shared materials a given block should render with. */
  categoryFor(block) {
    if (!block) return 'opaque';
    if (block.fluid) return 'fluid';
    if (block.transparent) return 'foliage'; // leaves, glass, glass_pane
    if (block.cross) return 'cutout';
    return 'opaque';
  }

  getCategoryMaterial(category) {
    return this._materials[category] || this._materials.opaque;
  }
}

export const textureManager = new TextureManager();
