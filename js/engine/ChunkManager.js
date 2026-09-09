/* =========================================================
   MossBox — Chunk Manager
   Keeps the set of rendered chunk meshes in sync with the
   player's position and the current render-distance setting.
   Handles the "unload hidden/rear chunks" side of the render
   distance tech described in the design doc; true frustum
   culling is delegated to Three.js's own per-object culling
   plus the coarse radius check here.
   ========================================================= */

import { CHUNK_SIZE } from './World.js';
import { ChunkMesher } from './ChunkMesher.js';

export class ChunkManager {
  constructor(world, scene, renderDistanceChunks = 6) {
    this.world = world;
    this.scene = scene;
    this.renderDistance = renderDistanceChunks;
    this.loadedMeshes = new Map(); // "cx,cz" -> THREE.Group
    this._lastPlayerChunk = { cx: null, cz: null };
  }

  setRenderDistance(chunks) {
    this.renderDistance = chunks;
    this._lastPlayerChunk = { cx: null, cz: null }; // force refresh
  }

  /** Call every frame (cheap early-out if the player hasn't crossed a chunk boundary). */
  update(playerWorldX, playerWorldZ) {
    const cx = Math.floor(playerWorldX / CHUNK_SIZE);
    const cz = Math.floor(playerWorldZ / CHUNK_SIZE);

    if (cx === this._lastPlayerChunk.cx && cz === this._lastPlayerChunk.cz) return;
    this._lastPlayerChunk = { cx, cz };

    const wanted = new Set();
    const r = this.renderDistance;

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r) continue; // circular render distance, not square
        const kx = cx + dx, kz = cz + dz;
        const key = `${kx},${kz}`;
        wanted.add(key);
        if (!this.loadedMeshes.has(key)) {
          this._loadChunk(kx, kz, key);
        }
      }
    }

    for (const key of [...this.loadedMeshes.keys()]) {
      if (!wanted.has(key)) this._unloadChunk(key);
    }
  }

  _loadChunk(cx, cz, key) {
    const group = ChunkMesher.buildChunkMesh(this.world, cx, cz);
    this.scene.add(group);
    this.loadedMeshes.set(key, group);
  }

  _unloadChunk(key) {
    const group = this.loadedMeshes.get(key);
    if (!group) return;
    this.scene.remove(group);
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    this.loadedMeshes.delete(key);
  }

  /** Rebuild a single chunk's mesh (called after a block edit). */
  rebuildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.loadedMeshes.has(key)) this._unloadChunk(key);
    this._loadChunk(cx, cz, key);
  }
}
