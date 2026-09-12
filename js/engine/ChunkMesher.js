/* =========================================================
   MossBox — Chunk Mesher
   Converts raw chunk block-id data into renderable geometry.

   PERFORMANCE: geometry is bucketed by render CATEGORY (see
   TextureManager.js — opaque/cutout/fluid/foliage), not by
   individual block type. Every chunk emits at most 4 draw
   calls total now, regardless of how many different block
   types it contains — previously it was one draw call per
   distinct block type (stone, dirt, grass, flowers, water,
   leaves... often 6-10+ per chunk), which was the single
   biggest GPU cost at wide render distances. Per-block color
   is preserved via a per-vertex color attribute instead of a
   per-block material.

   Face culling itself (skip faces touching a solid neighbor)
   is unchanged — it still checks the real per-block registry
   data, only the *output bucket* differs.
   ========================================================= */

import { CHUNK_SIZE, WORLD_HEIGHT } from './World.js';
import { getBlock } from '../config/blocks.js';
import { textureManager } from './TextureManager.js';

// Face definitions: direction, corner offsets (CCW), and normal.
const FACES = [
  { dir: [1, 0, 0],  normal: [1, 0, 0],  corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { dir: [-1, 0, 0], normal: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { dir: [0, 1, 0],  normal: [0, 1, 0],  corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
  { dir: [0, -1, 0], normal: [0, -1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] },
  { dir: [0, 0, 1],  normal: [0, 0, 1],  corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { dir: [0, 0, -1], normal: [0, 0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
];

// Cache THREE.Color -> [r,g,b] per block id so we're not re-parsing the
// same hex string thousands of times across a chunk.
const _colorCache = new Map();
function colorFor(block) {
  let c = _colorCache.get(block.id);
  if (!c) {
    const tc = new THREE.Color(block.color || '#ffffff');
    c = [tc.r, tc.g, tc.b];
    _colorCache.set(block.id, c);
  }
  return c;
}

export class ChunkMesher {
  /**
   * Builds a THREE.Group containing at most 4 meshes total (one per
   * render category actually present in this chunk).
   */
  static buildChunkMesh(world, cx, cz) {
    const data = world.getOrGenerateChunk(cx, cz);
    const group = new THREE.Group();
    group.name = `chunk_${cx}_${cz}`;

    // Only scan the chunk's actual non-air y-range (plus one block of
    // padding on each side) instead of the full 0..256 — skips huge
    // stretches of empty sky that never needed checking at all.
    const range = world.getChunkYRange(cx, cz);
    if (!range) return group;
    const yStart = Math.max(0, range.minY - 1);
    const yEnd = Math.min(WORLD_HEIGHT - 1, range.maxY + 1);

    // category -> { positions:[], normals:[], uvs:[], colors:[], indices:[] }
    const geometryBuckets = new Map();

    const getWorldBlock = (wx, y, wz) => world.getBlockId(wx, y, wz);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        for (let y = yStart; y <= yEnd; y++) {
          const id = data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
          if (id === 0) continue; // air

          const block = getBlock(id);
          if (!block) continue;

          const category = textureManager.categoryFor(block);
          const color = colorFor(block);

          // Cross-shaped blocks (grass/flowers/cane) get their own simple geometry.
          if (block.cross) {
            this._addCrossGeometry(geometryBuckets, category, color, lx, y, lz);
            continue;
          }

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];
            const neighborId = getWorldBlock(nx, ny, nz);
            const neighbor = getBlock(neighborId);

            // Cull face if neighbor is solid & opaque (or same transparent type, e.g. water-water).
            const neighborBlocksFace =
              neighbor && neighbor.id !== 0 &&
              (!neighbor.transparent || neighbor.id === id) &&
              !neighbor.cross;

            if (neighborBlocksFace) continue;

            this._addFace(geometryBuckets, category, color, face, lx, y, lz, block.heightFraction);
          }
        }
      }
    }

    // TODO(greedy-meshing): merge adjacent coplanar faces of the same
    // category+color into larger quads before building BufferGeometry —
    // a further reduction in vertex count (not draw calls, which the
    // category-bucketing above already handles). Left as a follow-up.

    for (const [category, bucket] of geometryBuckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
      geometry.setIndex(bucket.indices);

      const material = textureManager.getCategoryMaterial(category);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      group.add(mesh);
    }

    return group;
  }

  static _addFace(buckets, category, color, face, lx, y, lz, heightFraction) {
    const bucket = this._bucketFor(buckets, category);
    const startIndex = bucket.positions.length / 3;
    const h = heightFraction ?? 1;

    for (const corner of face.corners) {
      const cy = corner[1] === 1 ? h : 0;
      bucket.positions.push(lx + corner[0], y + cy, lz + corner[2]);
      bucket.normals.push(...face.normal);
      bucket.colors.push(color[0], color[1], color[2]);
    }
    bucket.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    bucket.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
  }

  static _addCrossGeometry(buckets, category, color, lx, y, lz) {
    const bucket = this._bucketFor(buckets, category);
    const planes = [
      [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
      [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]],
    ];
    for (const plane of planes) {
      const startIndex = bucket.positions.length / 3;
      for (const [dx, dy, dz] of plane) {
        bucket.positions.push(lx + dx, y + dy, lz + dz);
        bucket.normals.push(0, 1, 0);
        bucket.colors.push(color[0], color[1], color[2]);
      }
      bucket.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      bucket.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
    }
  }

  static _bucketFor(buckets, category) {
    if (!buckets.has(category)) {
      buckets.set(category, { positions: [], normals: [], uvs: [], colors: [], indices: [] });
    }
    return buckets.get(category);
  }
}
