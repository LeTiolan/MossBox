/* =========================================================
   MossBox — World
   Owns all chunk data and procedural generation. Rendering
   lives in Chunk.js (mesh building); this file is pure data
   + the save system described in the design doc: only
   player-modified blocks are ever persisted, everything else
   regenerates deterministically from BLOCK.seed.
   ========================================================= */

import { SimplexNoise } from './Noise.js';
import { buildColumn, BIOME_SURFACE_DECOR, SEA_LEVEL, BIOME } from './Biomes.js';
import { BiomeGenerator } from './BiomeGenerator.js';
import { getBlock } from '../config/blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 256;
export const WORLD_HALF_EXTENT = 1500; // 3000x3000 world, centered on origin

const ORE_RULES = [
  { block: 'coal_ore',    minY: 5,  maxY: 255, attemptsPerChunk: 20, veinMin: 5,  veinMax: 15 },
  { block: 'iron_ore',    minY: 5,  maxY: 64,  attemptsPerChunk: 10, veinMin: 4,  veinMax: 8  },
  { block: 'gold_ore',    minY: 5,  maxY: 32,  attemptsPerChunk: 2,  veinMin: 2,  veinMax: 6  },
  { block: 'diamond_ore', minY: 5,  maxY: 15,  attemptsPerChunk: 1,  veinMin: 1,  veinMax: 4  },
];

// Tree spacing: one candidate trunk position per cell, so trees keep a
// real minimum distance apart instead of an independent per-column roll.
const TREE_CELL_SIZE = 7;
const TREE_CELL_CHANCE = 0.4; // fraction of cells that actually get a tree

// Cavern wall ore seeding: which ore each roll can turn a cavern-adjacent
// stone block into, and how likely any single wall cell is to seed at
// all. Diamond is weighted much higher here than its normal vein rate —
// this is specifically what makes caverns read as "richer" than tunnels.
const CAVERN_ORE_CHANCE = 0.09;
const CAVERN_ORE_WEIGHTS = [
  { block: 'coal_ore', weight: 30 },
  { block: 'iron_ore', weight: 30 },
  { block: 'gold_ore', weight: 20 },
  { block: 'diamond_ore', weight: 20 },
];
const CAVERN_ORE_TOTAL_WEIGHT = CAVERN_ORE_WEIGHTS.reduce((s, o) => s + o.weight, 0);

// The 6 face-adjacent neighbors of a carved cavern cell — checked for
// stone to seed ore onto the cavern's walls.
const CAVERN_WALL_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

const SAVE_KEY = 'mossbox_world_v1';

export class World {
  /** @param {number} seed */
  constructor(seed = Date.now() & 0xffffffff) {
    this.seed = seed;
    this.heightNoise = new SimplexNoise(seed);
    this.caveNoise = new SimplexNoise(seed + 2);
    this.oreNoise = new SimplexNoise(seed + 3);
    this.biomeGenerator = new BiomeGenerator(seed + 4);
    this.cavernNoise = new SimplexNoise(seed + 5); // large rare open-cavern pockets

    // Loaded chunk data: "cx,cz" -> Uint16Array(CHUNK_SIZE*WORLD_HEIGHT*CHUNK_SIZE)
    this.chunks = new Map();

    // "cx,cz" -> { minY, maxY } of the lowest/highest non-air block in that
    // chunk. Lets ChunkMesher skip scanning the huge stretches of empty
    // sky and (once we're several blocks under the surface) featureless
    // buried stone that every chunk otherwise has — see buildChunkMesh().
    this.chunkBounds = new Map();

    // Player-modified blocks only, keyed "x,y,z" -> blockId (0 = air/removed).
    // This is the only thing that gets persisted to disk.
    this.modifiedBlocks = this._loadModifications();
  }

  // ---------------------------------------------------------------
  // Persistence — only diffs are ever saved
  // ---------------------------------------------------------------

  _loadModifications() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return new Map();
      // NOTE: swap JSON.stringify/parse for LZ-String's compress/decompress
      // here once assets/lib/lz-string.js is included — the data shape
      // (a plain object of "x,y,z" -> id) doesn't need to change at all.
      const obj = JSON.parse(raw);
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  saveModifications() {
    const obj = Object.fromEntries(this.modifiedBlocks);
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
  }

  // ---------------------------------------------------------------
  // Chunk generation
  // ---------------------------------------------------------------

  _chunkKey(cx, cz) { return `${cx},${cz}`; }

  getOrGenerateChunk(cx, cz) {
    const key = this._chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);

    const data = this._generateChunk(cx, cz);
    this.chunks.set(key, data);
    this.chunkBounds.set(key, this._computeBounds(data));
    return data;
  }

  /** Single flat pass over the chunk's block ids to find its non-air y-range. */
  _computeBounds(data) {
    let minY = -1;
    let maxY = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) continue;
      const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
      if (minY === -1 || y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minY, maxY };
  }

  /**
   * Y-range actually worth meshing for this chunk: { minY, maxY } of its
   * non-air blocks, or null if the chunk is fully empty. ChunkMesher uses
   * this instead of always scanning 0..WORLD_HEIGHT, which is most of the
   * per-chunk mesh-build cost — deep buried stone and the empty sky above
   * the surface never need a face-culling check at all.
   */
  getChunkYRange(cx, cz) {
    const key = this._chunkKey(cx, cz);
    if (!this.chunks.has(key)) this.getOrGenerateChunk(cx, cz);
    const bounds = this.chunkBounds.get(key);
    return bounds && bounds.minY !== -1 ? bounds : null;
  }

  _generateChunk(cx, cz) {
    const data = new Uint16Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const airId = getBlock('air').id;
    data.fill(airId);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        const h = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 5 });

        // Lake placement stays tied to actual terrain height (a real local
        // dip), not the cellular region map below — otherwise a "Lake"
        // region could land on a hilltop with no water anywhere near it.
        // Land biomes (Plains/Forest/Desert) come from BiomeGenerator's
        // jittered-Voronoi regions: classic pre-1.18-style hard-edged,
        // irregularly-shaped biome blobs instead of a smooth blended
        // gradient. See BiomeGenerator.js for why.
        const biome = h < -0.25 ? BIOME.LAKE : this.biomeGenerator.getBiome(wx, wz);

        // Plains and Desert re-sample height with fewer octaves (less
        // high-frequency jitter) and a much smaller amplitude, so they
        // read as open, gently-rolling ground instead of sharing Forest's
        // jagged hill noise. Forest/Lake keep the original full-detail h.
        let heightSample = h;
        let amplitude = 24;
        if (biome === BIOME.PLAINS || biome === BIOME.DESERT) {
          heightSample = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 2 });
          amplitude = 6;
        }
        const surfaceY = Math.floor(SEA_LEVEL + heightSample * amplitude);

        const column = buildColumn(biome, surfaceY);
        for (const { y, block } of column) {
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          this._setLocal(data, lx, y, lz, getBlock(block).id);
        }

        // Surface decoration (grass/flowers/cacti) — trees are handled
        // separately below via a spaced grid, not this per-column roll.
        const decorTable = BIOME_SURFACE_DECOR[biome] || [];
        const decorRoll = this._hashRandom(wx, wz, 99);
        let acc = 0;
        for (const d of decorTable) {
          acc += d.chance;
          if (decorRoll < acc) {
            this._setLocal(data, lx, surfaceY + 1, lz, getBlock(d.block).id);
            break;
          }
        }

        // Trees: one candidate position per TREE_CELL_SIZE-block cell,
        // jittered within it (same trick as BiomeGenerator's region
        // jitter) — guarantees real minimum spacing between trunks,
        // instead of the old per-column independent chance that let
        // trees spawn right next to each other.
        if (biome === BIOME.FOREST) {
          const cellX = Math.floor(wx / TREE_CELL_SIZE);
          const cellZ = Math.floor(wz / TREE_CELL_SIZE);
          const jx = cellX * TREE_CELL_SIZE + Math.floor(this._hashRandom(cellX, cellZ, 401) * TREE_CELL_SIZE);
          const jz = cellZ * TREE_CELL_SIZE + Math.floor(this._hashRandom(cellX, cellZ, 402) * TREE_CELL_SIZE);
          const cellHasTree = this._hashRandom(cellX, cellZ, 403) < TREE_CELL_CHANCE;
          if (cellHasTree && wx === jx && wz === jz) {
            this._placeTree(data, lx, surfaceY + 1, lz, wx, wz);
          }
        }

        // Caves: ridged "worm" tunnels (abs(noise) near zero) read as
        // natural snaking passages rather than blobby "swiss cheese"
        // carving. A separate, much lower-frequency noise field rarely
        // opens a tunnel into a wide cavern instead. Caves are dry by
        // default now — no automatic water/lava flooding — with only a
        // very rare isolated deep lava pocket for flavor. A small
        // fraction of columns allow their shaft to breach the surface.
        const allowsSurfaceBreach = this._hashRandom(wx, wz, 777) < 0.015;
        const caveCeiling = allowsSurfaceBreach
          ? Math.min(surfaceY + 1, WORLD_HEIGHT - 1)
          : Math.min(surfaceY - 2, WORLD_HEIGHT);

        const cavernCellsThisColumn = [];

        for (let y = 5; y < caveCeiling; y++) {
          const tunnel = Math.abs(this.caveNoise.noise3D(wx * 0.05, y * 0.09, wz * 0.05));
          const isTunnel = tunnel < 0.045;

          const cavernVal = this.cavernNoise.noise3D(wx * 0.02, y * 0.025, wz * 0.02);
          const isCavern = cavernVal > 0.8 && y < 40; // caverns only appear deep

          if (!isTunnel && !isCavern) continue;

          const current = this._getLocal(data, lx, y, lz);
          if (current !== getBlock('stone').id && current !== getBlock('dirt').id) continue;

          // Rare isolated deep lava pocket — not a blanket flood, just an
          // occasional single-cell hazard, same spirit as vanilla lava
          // pools deep underground.
          const isRareLavaPocket = y < 8 && this._hashRandom(wx, wz, y + 9001) < 0.015;
          this._setLocal(data, lx, y, lz, isRareLavaPocket ? getBlock('lava').id : getBlock('air').id);

          if (isCavern && !isRareLavaPocket) cavernCellsThisColumn.push(y);
        }

        // Cavern walls get a boosted, localized ore/gem pass — carved
        // cavern cells check their stone neighbors and sometimes turn
        // them into ore right there, so caverns naturally read as richer
        // than an ordinary tunnel instead of every column sharing one
        // flat global ore rate.
        for (const cy of cavernCellsThisColumn) {
          for (const [dx, dy, dz] of CAVERN_WALL_OFFSETS) {
            const nx = lx + dx, ny = cy + dy, nz = lz + dz;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT) continue;
            if (this._getLocal(data, nx, ny, nz) !== getBlock('stone').id) continue;
            const roll = this._hashRandom(wx + nx, wz + nz, ny + 4200);
            if (roll > CAVERN_ORE_CHANCE) continue;
            const ore = this._pickCavernOre(wx, wz, ny);
            this._setLocal(data, nx, ny, nz, getBlock(ore).id);
          }
        }

        // Ores: replace stone only, per the vein rules table.
        for (const rule of ORE_RULES) {
          const attempts = rule.attemptsPerChunk;
          for (let a = 0; a < attempts; a++) {
            const roll = this._hashRandom(wx, wz, a * 7 + rule.block.length);
            if (roll > 0.02) continue; // sparse per-column chance per attempt
            const veinSize = rule.veinMin + Math.floor(this._hashRandom(wx, wz, a + 500) * (rule.veinMax - rule.veinMin));
            const centerY = rule.minY + Math.floor(this._hashRandom(wx, wz, a + 900) * (rule.maxY - rule.minY));
            for (let v = 0; v < veinSize; v++) {
              const oy = centerY + (v % 3) - 1;
              if (oy < 0 || oy >= WORLD_HEIGHT) continue;
              if (this._getLocal(data, lx, oy, lz) === getBlock('stone').id) {
                this._setLocal(data, lx, oy, lz, getBlock(rule.block).id);
              }
            }
          }
        }
      }
    }

    return data;
  }

  _placeTree(data, lx, baseY, lz, wx, wz) {
    // Deterministic (seeded) height instead of Math.random() — the old
    // version silently broke the "identical regeneration from the same
    // seed" guarantee described at the top of this file. Taller range
    // (8-12 vs the old 5-7) per the request for taller trees.
    const height = 8 + Math.floor(this._hashRandom(wx, wz, 555) * 5);
    for (let i = 0; i < height; i++) {
      this._setLocal(data, lx, baseY + i, lz, getBlock('wood_log').id);
    }
    // Simple leaf canopy crown.
    const topY = baseY + height;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (Math.abs(dx) + Math.abs(dz) > 3) continue;
          const x = lx + dx, y = topY + dy, z = lz + dz;
          if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;
          if (this._getLocal(data, x, y, z) === getBlock('air').id) {
            this._setLocal(data, x, y, z, getBlock('leaves').id);
          }
        }
      }
    }
  }

  /** Weighted-random ore pick for cavern-wall seeding (see CAVERN_ORE_WEIGHTS). */
  _pickCavernOre(wx, wz, y) {
    const roll = this._hashRandom(wx, wz, y + 6600) * CAVERN_ORE_TOTAL_WEIGHT;
    let acc = 0;
    for (const entry of CAVERN_ORE_WEIGHTS) {
      acc += entry.weight;
      if (roll < acc) return entry.block;
    }
    return CAVERN_ORE_WEIGHTS[0].block;
  }

  /** Deterministic pseudo-random in [0,1) from world coords + salt (no Math.random dependency on seed). */
  _hashRandom(x, z, salt) {
    const n = this.oreNoise.noise2D((x + salt * 13.37) * 0.5, (z - salt * 7.77) * 0.5);
    return (n + 1) / 2;
  }

  _index(lx, y, lz) { return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx; }
  _getLocal(data, lx, y, lz) { return data[this._index(lx, y, lz)]; }
  _setLocal(data, lx, y, lz, id) { data[this._index(lx, y, lz)] = id; }

  // ---------------------------------------------------------------
  // Public world-space block access (used by raycasting, physics, UI)
  // ---------------------------------------------------------------

  worldToChunkCoords(x, z) {
    return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
  }

  getBlockId(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return getBlock('air').id;

    const modKey = `${x},${y},${z}`;
    if (this.modifiedBlocks.has(modKey)) return Number(this.modifiedBlocks.get(modKey));

    const { cx, cz } = this.worldToChunkCoords(x, z);
    const data = this.getOrGenerateChunk(cx, cz);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return this._getLocal(data, lx, y, lz);
  }

  /** Player-driven change (break/place). Always recorded in the diff map. */
  setBlockId(x, y, z, id, { persist = true } = {}) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const modKey = `${x},${y},${z}`;
    this.modifiedBlocks.set(modKey, id);

    const { cx, cz } = this.worldToChunkCoords(x, z);
    const data = this.getOrGenerateChunk(cx, cz);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    this._setLocal(data, lx, y, lz, id);

    // Keep the cached mesh-range in sync. Only ever expands it — if this
    // was the chunk's only block at that y-level, the range stays a
    // little wider than strictly necessary rather than shrinking, which
    // is always safe (just a couple of extra empty layers to scan, never
    // a missed block).
    if (id !== 0) {
      const key = this._chunkKey(cx, cz);
      const bounds = this.chunkBounds.get(key) || { minY: -1, maxY: -1 };
      if (bounds.minY === -1 || y < bounds.minY) bounds.minY = y;
      if (y > bounds.maxY) bounds.maxY = y;
      this.chunkBounds.set(key, bounds);
    }

    if (persist) this.saveModifications();
  }

  isWithinWorldBounds(x, z) {
    return Math.abs(x) <= WORLD_HALF_EXTENT && Math.abs(z) <= WORLD_HALF_EXTENT;
  }
}
