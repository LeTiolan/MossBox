/* =========================================================
   MossBox — Chunk Manager
   Keeps loaded chunks in one of three explicit phases, the
   same three Minecraft itself uses:

     1. VISIBLE   — in the camera's view frustum. Rendered.
     2. PAUSED    — within render distance, mesh built and
                    kept in memory, but currently out of view
                    (behind the player, etc). group.visible is
                    set false so Three.js skips it in the
                    render list entirely — this is the "not
                    rendered at all" behavior, not just relying
                    on per-mesh bounding-sphere culling.
     3. UNLOADED  — outside render distance. Mesh geometry is
                    disposed and the chunk is dropped from
                    memory entirely; re-entering it regenerates
                    from the world seed + any saved edits.

   There's no per-chunk simulation yet (fluid flow, mob AI) to
   gate on phase 1 vs 2, but the phases themselves are real and
   in place — a future simulation system can check
   `group.visible` (or a dedicated phase field) to decide what
   to tick, without touching this file's load/unload logic.
   ========================================================= */

import { CHUNK_SIZE } from './World.js';
import { ChunkMesher } from './ChunkMesher.js';

export class ChunkManager {
  constructor(world, scene, renderDistanceChunks = 6, camera = null) {
    this.world = world;
    this.scene = scene;
    this.camera = camera;
    this.renderDistance = renderDistanceChunks;
    this.loadedMeshes = new Map(); // "cx,cz" -> THREE.Group (phase 1 or 2)
    this._lastPlayerChunk = { cx: null, cz: null };

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
   * Call every frame. Load/unload (phase 1|2 <-> phase 3) only runs when
   * the player crosses a chunk boundary — that part is unchanged from
   * before. Visibility (phase 1 <-> phase 2) is re-evaluated every frame
   * regardless, since the camera can rotate without the player moving.
   */
  update(playerWorldX, playerWorldZ) {
    const cx = Math.floor(playerWorldX / CHUNK_SIZE);
    const cz = Math.floor(playerWorldZ / CHUNK_SIZE);

    if (cx !== this._lastPlayerChunk.cx || cz !== this._lastPlayerChunk.cz) {
      this._lastPlayerChunk = { cx, cz };
      this._updateLoadedChunks(cx, cz);
    }

    this._updateVisibility();
  }

  _updateLoadedChunks(cx, cz) {
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
  }

  /** Rebuild a single chunk's mesh (called after a block edit). */
  rebuildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.loadedMeshes.has(key)) this._unloadChunk(key);
    this._loadChunk(cx, cz, key);
  }
}
