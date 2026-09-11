/* =========================================================
   MossBox — Texture Manager
   Right now every block renders as a single flat color
   (per its `color` field in config/blocks.js). To add real
   16x16 pixel-art textures later:

     1. Drop a PNG at /assets/textures/blocks/<textureKey>.png
        (the `texture` field on each block in blocks.js is
        already the key to use).
     2. Nothing else changes — getMaterialFor() below checks
        for the file first and only falls back to the flat
        color if it's missing.

   Materials are cached per block id so we only build each
   one once.
   ========================================================= */

import { BLOCKS_BY_ID } from '../config/blocks.js';

const TEXTURE_BASE = 'assets/textures/blocks/';

class TextureManager {
  constructor() {
    this._materialCache = new Map(); // blockId -> THREE.Material
    this._loader = new THREE.TextureLoader();
    this._checkedPaths = new Set(); // avoid repeat 404 spam
  }

  /**
   * Returns a THREE.Material for the given block id. Uses a flat
   * MeshLambertMaterial colored per the registry until a matching
   * texture file is dropped into assets/textures/blocks/.
   */
  getMaterialFor(blockId) {
    if (this._materialCache.has(blockId)) return this._materialCache.get(blockId);

    const block = BLOCKS_BY_ID[blockId];
    const isTransparent = !!block?.transparent;
    const isCross = !!block?.cross;

    const material = new THREE.MeshLambertMaterial({
      color: block?.color ? new THREE.Color(block.color) : 0xffffff,
      transparent: isTransparent || isCross,
      opacity: block?.opacity ?? (isTransparent ? (block.fluid ? 0.75 : 0.85) : 1),
      side: (isTransparent || isCross) ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: isCross ? 0.5 : 0,
    });

    this._materialCache.set(blockId, material);

    // Attempt to upgrade to a real texture in the background. If the
    // file 404s, THREE's loader just fires onError and we keep the
    // flat color — no crash, no console spam beyond one info line.
    if (block?.texture) {
      const path = `${TEXTURE_BASE}${block.texture}.png`;
      this._loader.load(
        path,
        (tex) => {
          tex.magFilter = THREE.NearestFilter; // keep pixel-art crisp
          tex.minFilter = THREE.NearestFilter;
          material.map = tex;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        },
        undefined,
        () => this._warnMissingOnce(path)
      );
    }

    return material;
  }

  invalidate(blockId) {
    this._materialCache.delete(blockId);
  }

  _warnMissingOnce(path) {
    if (this._checkedPaths.has(path)) return;
    this._checkedPaths.add(path);
    console.info(`[TextureManager] No texture at "${path}" yet — using flat color.`);
  }
}

export const textureManager = new TextureManager();
