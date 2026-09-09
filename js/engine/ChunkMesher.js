/* =========================================================
   MossBox — Chunk Mesher
   Converts raw chunk block-id data into renderable geometry.

   Technique: per-chunk face culling (skip faces touching a
   solid neighbor) with all visible faces of the same block
   type merged into a single BufferGeometry — one draw call
   per block type per chunk rather than one per cube. This is
   the stepping stone to full greedy meshing (merging coplanar
   quads of the same type into fewer, larger quads); the TODO
   below marks exactly where that optimization would slot in.
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

export class ChunkMesher {
  /**
   * Builds a THREE.Group containing one mesh per distinct block
   * type present in this chunk.
   */
  static buildChunkMesh(world, cx, cz) {
    const data = world.getOrGenerateChunk(cx, cz);
    const group = new THREE.Group();
    group.name = `chunk_${cx}_${cz}`;

    // blockId -> { positions:[], normals:[], uvs:[] }
    const geometryBuckets = new Map();

    const getWorldBlock = (wx, y, wz) => world.getBlockId(wx, y, wz);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const id = data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
          if (id === 0) continue; // air

          const block = getBlock(id);
          if (!block) continue;

          // Cross-shaped blocks (grass/flowers/cane) get their own simple geometry.
          if (block.cross) {
            this._addCrossGeometry(geometryBuckets, id, lx, y, lz);
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

            this._addFace(geometryBuckets, id, face, lx, y, lz, block.heightFraction);
          }
        }
      }
    }

    // TODO(greedy-meshing): instead of emitting one quad per visible face,
    // merge adjacent coplanar faces of the same block+size into larger
    // quads here before building BufferGeometry. Left as a follow-up
    // optimization pass — current approach already collapses draw calls
    // to one-per-block-type-per-chunk, which is enough for the target
    // render distances at 60 FPS.

    for (const [blockId, buckets] of geometryBuckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(buckets.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buckets.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buckets.uvs, 2));
      geometry.setIndex(buckets.indices);

      const material = textureManager.getMaterialFor(Number(blockId));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.blockId = Number(blockId);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      group.add(mesh);
    }

    return group;
  }

  static _addFace(buckets, blockId, face, lx, y, lz, heightFraction) {
    const bucket = this._bucketFor(buckets, blockId);
    const startIndex = bucket.positions.length / 3;
    const h = heightFraction ?? 1;

    for (const corner of face.corners) {
      const cy = corner[1] === 1 ? h : 0;
      bucket.positions.push(lx + corner[0], y + cy, lz + corner[2]);
      bucket.normals.push(...face.normal);
    }
    bucket.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    bucket.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
  }

  static _addCrossGeometry(buckets, blockId, lx, y, lz) {
    const bucket = this._bucketFor(buckets, blockId);
    const planes = [
      [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
      [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]],
    ];
    for (const plane of planes) {
      const startIndex = bucket.positions.length / 3;
      for (const [dx, dy, dz] of plane) {
        bucket.positions.push(lx + dx, y + dy, lz + dz);
        bucket.normals.push(0, 1, 0);
      }
      bucket.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      bucket.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
      // Cross planes are double-sided so material.side is set to DoubleSide
      // for transparent/cross blocks in TextureManager.
    }
  }

  static _bucketFor(buckets, blockId) {
    if (!buckets.has(blockId)) {
      buckets.set(blockId, { positions: [], normals: [], uvs: [], indices: [] });
    }
    return buckets.get(blockId);
  }
}
