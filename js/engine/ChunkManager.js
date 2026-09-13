/* =========================================================
   MossBox — Chunk Manager
   Keeps loaded chunks in one of three explicit phases, the
   same three Minecraft itself uses:

     1. VISIBLE   — in the camera's view frustum. Rendered.
     2. PAUSED    — within render distance, mesh built and
                    kept in memory, but currently out of view.
                    group.visible is set false so Three.js
                    skips it in the render list entirely.
     3. UNLOADED  — outside render distance. Mesh geometry is
                    disposed and the chunk is dropped from
                    memory entirely.

   PERFORMANCE FIX: chunk *loading* (generation + meshing) is
   now spread across multiple frames via a time-budgeted queue,
   instead of generating and meshing an entire new ring of
   chunks synchronously in a single frame. That single-frame
   burst was the exact cause of multi-second freezes whenever
   the player crossed a chunk boundary (confirmed by the freeze
   happening at exactly 16 blocks — one chunk width — of
   movement). Nearest-to-the-player chunks are loaded first, so
   the immediate surroundings still pop in quickly even though
   the far edge of render distance may take a few extra frames.

   There's no per-chunk simulation yet (fluid flow, mob AI) to
   gate on phase 1 vs 2, but the phases themselves are real and
   in place — a future simulation system can check
   `group.visible` to decide what to tick, without touching
   this file's load/unload logic.
   ========================================================= */

import { CHUNK_SIZE } from './World.js';
import { ChunkMesher } from './ChunkMesher.js';

const LOAD_BUDGET_MS = 5; // max time to spend loading chunks per frame
const LOAD_MAX_PER_FRAME = 1; // lowered from 2 — a single chunk can already blow the frame budget on weak hardware, so loading two back-to-back was still causing visible dips

export class ChunkManager {
  constructor(world, scene, renderDistanceChunks = 6, camera = null) {
    this.world = world;
    this.scene = scene;
    this.camera = camera;
    this.renderDistance = renderDistanceChunks;
    this.loadedMeshes = new Map(); // "cx,cz" -> THREE.Group (phase 1 or 2)
    this._lastPlayerChunk = { cx: null, cz: null };

    // Time-budgeted load queue — see PERFORMANCE FIX above.
    this._loadQueue = []; // [{ kx, kz, key, distSq }], nearest first
    this._queuedKeys = new Set();

    // Reused across frames to avoid allocating a new Frustum/Matrix4 every
    // visibility check.
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
  }

  setRenderDistance(chunks) {
    this.renderDistance = chunks;
    this._lastPlayerChunk = { cx: null, cz: null }; // force refresh
  }

  /**
   * Call every frame. Deciding WHICH chunks are wanted only runs when the
   * player crosses a chunk boundary. Actually loading them is spread
   * across frames via _processLoadQueue(), which always runs. Visibility
   * (phase 1 <-> phase 2) is also re-evaluated every frame, since the
   * camera can rotate without the player moving.
   */
  update(playerWorldX, playerWorldZ) {
    const cx = Math.floor(playerWorldX / CHUNK_SIZE);
    const cz = Math.floor(playerWorldZ / CHUNK_SIZE);

    if (cx !== this._lastPlayerChunk.cx || cz !== this._lastPlayerChunk.cz) {
      this._lastPlayerChunk = { cx, cz };
      this._updateWantedChunks(cx, cz);
    }

    this._processLoadQueue();
    this._updateVisibility();
  }

  /** Figures out which chunks should be loaded/unloaded, queues new loads (nearest first). */
  _updateWantedChunks(cx, cz) {
    const wanted = new Set();
    const r = this.renderDistance;
    const newlyNeeded = [];

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > r * r) continue; // circular render distance, not square
        const kx = cx + dx, kz = cz + dz;
        const key = `${kx},${kz}`;
        wanted.add(key);
        if (!this.loadedMeshes.has(key) && !this._queuedKeys.has(key)) {
          newlyNeeded.push({ kx, kz, key, distSq });
        }
      }
    }

    // Nearest first, so the player's immediate surroundings finish
    // loading before farther-out chunks even though it's spread over
    // several frames.
    newlyNeeded.sort((a, b) => a.distSq - b.distSq);
    for (const entry of newlyNeeded) {
      this._loadQueue.push(entry);
      this._queuedKeys.add(entry.key);
    }

    // Drop any now-irrelevant queued-but-not-yet-loaded entries (player
    // moved again before they got processed).
    this._loadQueue = this._loadQueue.filter((e) => wanted.has(e.key));
    this._queuedKeys = new Set(this._loadQueue.map((e) => e.key));

    for (const key of [...this.loadedMeshes.keys()]) {
      if (!wanted.has(key)) this._unloadChunk(key);
    }
  }

  /** Loads a few queued chunks this frame, bounded by time and count. */
  _processLoadQueue() {
    if (this._loadQueue.length === 0) return;

    const start = performance.now();
    let loadedCount = 0;

    while (
      this._loadQueue.length > 0 &&
      loadedCount < LOAD_MAX_PER_FRAME &&
      performance.now() - start < LOAD_BUDGET_MS
    ) {
      const { kx, kz, key } = this._loadQueue.shift();
      this._queuedKeys.delete(key);
      if (this.loadedMeshes.has(key)) continue; // already loaded, skip
      this._loadChunk(kx, kz, key);
      loadedCount++;
    }
  }

  /** Phase 1 <-> phase 2: toggle each loaded chunk's visibility against the camera frustum. */
  _updateVisibility() {
    if (!this.camera) return;

    this._projScreenMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    for (const group of this.loadedMeshes.values()) {
      group.visible = this._frustum.intersectsBox(this._boundingBoxFor(group));
    }
  }

  /** Chunk bounds never change after the mesh is built — compute once, cache on the group. */
  _boundingBoxFor(group) {
    if (!group.userData.boundingBox) {
      group.userData.boundingBox = new THREE.Box3().setFromObject(group);
    }
    return group.userData.boundingBox;
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

    // FO-style memory optimization: also drop the underlying chunk DATA
    // (not just the visual mesh) now that it's out of render distance,
    // instead of every chunk ever visited staying in memory forever.
    const [cx, cz] = key.split(',').map(Number);
    this.world.evictChunkData(cx, cz);
  }

  /**
   * Rebuild a single chunk's mesh (called after a block edit). Stays
   * immediate/unqueued — this only ever touches the edited chunk plus up
   * to 4 boundary neighbors, cheap enough not to need spreading, and a
   * player breaking/placing a block needs to see it change right away.
   */
  rebuildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.loadedMeshes.has(key)) this._unloadChunk(key);
    this._loadChunk(cx, cz, key);
  }
}
