/* =========================================================
   MossBox — World
   Owns all chunk data and procedural generation. Rendering
   lives in Chunk.js (mesh building); this file is pure data
   + the save system described in the design doc: only
   player-modified blocks are ever persisted, everything else
   regenerates deterministically from BLOCK.seed.
   ========================================================= */

import { SimplexNoise } from './Noise.js';
import { buildColumn, SEA_LEVEL, BIOME } from './Biomes.js';
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
// Widened from 7/0.4 for noticeably sparser, more natural-looking forests.
const TREE_CELL_SIZE = 10;
const TREE_CELL_CHANCE = 0.3;

// How negative the height noise needs to be for a point to become a Lake
// rather than land. Deliberately a middle ground: -0.25 (original) made
// ponds rare but let land pop up mid-lake at the boundary; -0.12 (the
// shoreline-continuity fix) solved that but made ponds too common.
const LAKE_THRESHOLD = -0.32; // tightened again — was still producing too much water relative to land

// Vegetation is generated per-CHUNK now, not per-column — a chunk rolls
// whether it gets a patch at all, then places a small cluster around one
// random anchor point. This is much closer to how Minecraft actually
// places vegetation (and reads as real, sparse patches) than the old
// model of an independent chance roll on every single column, which
// looked "rare" as a percentage but still scattered vegetation across a
// large fraction of every chunk's 256 columns.
const VEGETATION_ATTEMPTS = {
  [BIOME.PLAINS]: [
    { block: 'tall_grass', chunkChance: 0.35, clusterMin: 1, clusterMax: 1, salt: 500 },
    { block: 'flower_red', chunkChance: 0.05, clusterMin: 1, clusterMax: 1, salt: 510 },
    { block: 'flower_yellow', chunkChance: 0.05, clusterMin: 1, clusterMax: 1, salt: 520 },
    { block: 'pumpkin', chunkChance: 0.02, clusterMin: 1, clusterMax: 1, salt: 530 },
  ],
  [BIOME.FOREST]: [
    { block: 'tall_grass', chunkChance: 0.2, clusterMin: 1, clusterMax: 1, salt: 540 },
  ],
  [BIOME.DESERT]: [
    { block: 'cactus', chunkChance: 0.2, clusterMin: 2, clusterMax: 3, salt: 550 },
    { block: 'dead_bush', chunkChance: 0.15, clusterMin: 1, clusterMax: 1, salt: 560 },
  ],
  [BIOME.LAKE]: [
    { block: 'sugar_cane', chunkChance: 0.15, clusterMin: 1, clusterMax: 2, salt: 570 },
  ],
};

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

    // Same edits, indexed by chunk ("cx,cz" -> Set of "x,y,z" keys) so a
    // freshly-regenerated chunk can cheaply reapply just its own edits
    // instead of scanning every edit in the whole world. This is what
    // makes evictChunkData() below safe: a chunk can be fully dropped
    // from memory and later regenerated from the seed without losing
    // anything the player changed in it.
    this.modifiedBlocksByChunk = this._buildChunkEditIndex(this.modifiedBlocks);
  }

  _buildChunkEditIndex(modifiedBlocks) {
    const index = new Map();
    for (const modKey of modifiedBlocks.keys()) {
      const [xStr, , zStr] = modKey.split(',');
      const { cx, cz } = this.worldToChunkCoords(Number(xStr), Number(zStr));
      const chunkKey = this._chunkKey(cx, cz);
      if (!index.has(chunkKey)) index.set(chunkKey, new Set());
      index.get(chunkKey).add(modKey);
    }
    return index;
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

        const { biome, surfaceY, isDryLand } = this._biomeAndHeightAt(wx, wz);

        const column = buildColumn(biome, surfaceY);
        for (const { y, block } of column) {
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          this._setLocal(data, lx, y, lz, getBlock(block).id);
        }

        // Vegetation and trees are no longer placed here — see
        // _generateVegetationPatches(), called once per chunk after this
        // main loop finishes, for why the per-column model was replaced.

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

    this._generateVegetationPatches(data, cx, cz);

    // Reapply any player edits that fall inside this chunk. Needed
    // because evictChunkData() (below) can drop a chunk from memory
    // entirely — when it's regenerated later, the base terrain alone
    // wouldn't include whatever the player broke/placed here before.
    const chunkKey = this._chunkKey(cx, cz);
    const edits = this.modifiedBlocksByChunk.get(chunkKey);
    if (edits) {
      for (const modKey of edits) {
        const [xStr, yStr, zStr] = modKey.split(',');
        const y = Number(yStr);
        if (y < 0 || y >= WORLD_HEIGHT) continue;
        const lx = ((Number(xStr) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((Number(zStr) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        this._setLocal(data, lx, y, lz, Number(this.modifiedBlocks.get(modKey)));
      }
    }

    return data;
  }

  /**
   * FO-style memory optimization ("FerriteCore"-style reduced footprint):
   * drops a chunk's block-data array from memory once it's out of render
   * distance, instead of keeping every chunk ever visited forever. Safe
   * because regeneration is fully deterministic from the seed, and the
   * reapply-edits step above means player changes are never lost.
   * modifiedBlocks / modifiedBlocksByChunk are intentionally NOT touched
   * here — they're the persisted source of truth, independent of which
   * chunks happen to be in memory right now.
   */
  evictChunkData(cx, cz) {
    const key = this._chunkKey(cx, cz);
    this.chunks.delete(key);
    this.chunkBounds.delete(key);
  }

  /** Shared biome/height lookup used both by the main terrain loop above and the vegetation pass below. */
  _biomeAndHeightAt(wx, wz) {
    const h = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 5 });

    // Lake placement stays tied to actual terrain height (a real local
    // dip), not the cellular region map — otherwise a "Lake" region
    // could land on a hilltop with no water anywhere near it. Land
    // biomes (Plains/Forest/Desert) come from BiomeGenerator's jittered-
    // Voronoi regions: classic pre-1.18-style hard-edged, irregularly-
    // shaped biome blobs instead of a smooth blended gradient.
    const biome = h < LAKE_THRESHOLD ? BIOME.LAKE : this.biomeGenerator.getBiome(wx, wz);

    // Plains/Desert/Lake all re-sample height with fewer octaves and a
    // smaller amplitude than Forest's jagged hills. Plains: flat, open
    // ground. Desert: same, PLUS a fixed +8 offset so it can never dip
    // below sea level at all — deserts randomly sprouting small ponds
    // wasn't just "too much water", it was genuinely illogical terrain.
    // Lake: capping depth keeps lakebeds shallow instead of letting some
    // lakes plunge down into true cave territory.
    let heightSample = h;
    let amplitude = 24;
    let offset = 0;
    if (biome === BIOME.DESERT) {
      heightSample = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 2 });
      amplitude = 5;
      offset = 8; // guarantees surfaceY stays above SEA_LEVEL even at the noise minimum
    } else if (biome === BIOME.PLAINS) {
      heightSample = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 2 });
      amplitude = 6;
    } else if (biome === BIOME.LAKE) {
      heightSample = this.heightNoise.fbm2D(wx * 0.01, wz * 0.01, { octaves: 2 });
      amplitude = 8;
    }
    const surfaceY = Math.floor(SEA_LEVEL + offset + heightSample * amplitude);
    return { biome, surfaceY, isDryLand: surfaceY >= SEA_LEVEL };
  }

  /**
   * Places grass/flower/cactus/dead-bush/sugar-cane patches and trees,
   * once per chunk rather than as an independent roll on every column
   * (see VEGETATION_ATTEMPTS above for why). Runs after the main terrain
   * loop has fully populated `data`, since it needs to look up the real
   * ground surface at arbitrary points within the chunk.
   */
  _generateVegetationPatches(data, cx, cz) {
    const centerWx = cx * CHUNK_SIZE + 8;
    const centerWz = cz * CHUNK_SIZE + 8;
    const { biome: centerBiome } = this._biomeAndHeightAt(centerWx, centerWz);

    const attempts = VEGETATION_ATTEMPTS[centerBiome];
    if (attempts) {
      for (const spec of attempts) {
        if (this._hashRandom(cx, cz, spec.salt) > spec.chunkChance) continue;

        const anchorLx = Math.floor(this._hashRandom(cx, cz, spec.salt + 1) * CHUNK_SIZE);
        const anchorLz = Math.floor(this._hashRandom(cx, cz, spec.salt + 2) * CHUNK_SIZE);
        const clusterSize = spec.clusterMin +
          Math.floor(this._hashRandom(cx, cz, spec.salt + 3) * (spec.clusterMax - spec.clusterMin + 1));

        for (let i = 0; i < clusterSize; i++) {
          const lx = anchorLx + Math.floor(this._hashRandom(cx * 31 + i, cz, spec.salt + 10 + i) * 3) - 1;
          const lz = anchorLz + Math.floor(this._hashRandom(cx, cz * 31 + i, spec.salt + 20 + i) * 3) - 1;
          if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

          const surfaceY = this._findSurfaceY(data, lx, lz);
          if (surfaceY == null || surfaceY < SEA_LEVEL) continue; // dry land only

          if (spec.block === 'cactus') {
            // Height variation (3-4 blocks) per the request — cacti were
            // previously always exactly 1 block tall.
            const height = 3 + Math.floor(this._hashRandom(cx * 17 + lx, cz * 17 + lz, spec.salt + 30 + i) * 2);
            for (let h = 0; h < height; h++) {
              this._setLocal(data, lx, surfaceY + 1 + h, lz, getBlock('cactus').id);
            }
          } else {
            this._setLocal(data, lx, surfaceY + 1, lz, getBlock(spec.block).id);
          }
        }
      }
    }

    // Trees: candidate positions are jittered world-space cells (same
    // trick as BiomeGenerator's region jitter) for real minimum spacing
    // between trunks. Only the 2-3 cells that actually overlap this
    // chunk are checked, rather than testing every column against every
    // cell as the old per-column version did.
    const chunkMinWx = cx * CHUNK_SIZE;
    const chunkMinWz = cz * CHUNK_SIZE;
    const minCellX = Math.floor(chunkMinWx / TREE_CELL_SIZE);
    const maxCellX = Math.floor((chunkMinWx + CHUNK_SIZE - 1) / TREE_CELL_SIZE);
    const minCellZ = Math.floor(chunkMinWz / TREE_CELL_SIZE);
    const maxCellZ = Math.floor((chunkMinWz + CHUNK_SIZE - 1) / TREE_CELL_SIZE);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        if (this._hashRandom(cellX, cellZ, 403) >= TREE_CELL_CHANCE) continue;

        const jx = cellX * TREE_CELL_SIZE + Math.floor(this._hashRandom(cellX, cellZ, 401) * TREE_CELL_SIZE);
        const jz = cellZ * TREE_CELL_SIZE + Math.floor(this._hashRandom(cellX, cellZ, 402) * TREE_CELL_SIZE);

        const lx = jx - chunkMinWx;
        const lz = jz - chunkMinWz;
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue; // jittered outside this chunk

        const { biome, surfaceY, isDryLand } = this._biomeAndHeightAt(jx, jz);
        if (biome !== BIOME.FOREST || !isDryLand) continue;

        this._placeTree(data, lx, surfaceY + 1, lz, jx, jz);
      }
    }
  }

  /** Scans downward for the first solid ground block (skips air, water, leaves, cross-decor). */
  _findSurfaceY(data, lx, lz) {
    for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
      const id = this._getLocal(data, lx, y, lz);
      if (id === 0) continue;
      const block = getBlock(id);
      if (!block || block.fluid || block.cross) continue;
      return y;
    }
    return null;
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

    const topY = baseY + height - 1; // topmost log

    // Vanilla-oak-style layered canopy: this is the same basic silhouette
    // as Minecraft's own default oak tree — two 5x5 layers with the four
    // corners trimmed off (an octagon-ish square, not a plain diamond),
    // then a 3x3-minus-corners layer, then a plus-shaped one-block cap.
    const CANOPY_LAYERS = [
      { dy: -2, radius: 2, trimCorners: true },
      { dy: -1, radius: 2, trimCorners: true },
      { dy: 0, radius: 1, trimCorners: true },
      { dy: 1, radius: 1, plusOnly: true },
    ];

    for (const layer of CANOPY_LAYERS) {
      const y = topY + layer.dy;
      for (let dx = -layer.radius; dx <= layer.radius; dx++) {
        for (let dz = -layer.radius; dz <= layer.radius; dz++) {
          if (layer.plusOnly && dx !== 0 && dz !== 0) continue;
          if (layer.trimCorners && Math.abs(dx) === layer.radius && Math.abs(dz) === layer.radius) continue;

          const x = lx + dx, z = lz + dz;
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
    const chunkKey = this._chunkKey(cx, cz);
    if (!this.modifiedBlocksByChunk.has(chunkKey)) this.modifiedBlocksByChunk.set(chunkKey, new Set());
    this.modifiedBlocksByChunk.get(chunkKey).add(modKey);

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
