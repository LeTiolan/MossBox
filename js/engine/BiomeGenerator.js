/* =========================================================
   MossBox — Classic-Style Biome Regions
   Pre-1.18 Minecraft picked biomes from a low-resolution grid
   of hard-edged, irregularly-shaped regions (its "GenLayer"
   pipeline: island/zoom/edge/mix/smooth passes applied to a
   small seed grid), rather than the smooth continuous noise
   gradient modern Minecraft (and MossBox, until now) blends
   biomes with.

   Since MossBox's world is unbounded (chunks generate forever
   in every direction) rather than a fixed-size map, we can't
   pre-bake and "zoom" a finite grid the way the original
   layers did. This reaches the same visible result — solid
   blobby regions with hard borders, no gradient — a different
   way: a jittered Voronoi diagram. Each region has a fixed
   biome and an irregular jittered boundary, computed directly
   from world coordinates with no stored map needed, so it
   works at infinite range.
   ========================================================= */

import { BIOME } from './Biomes.js';

const CELL_SIZE = 380; // approx. world-block size of one biome region (larger = bigger contiguous regions)

// Land biomes only — Lake placement stays tied to actual terrain height
// (see World.js), so lakes only ever appear where the ground truly dips
// below sea level rather than as a region that might land on a hilltop.
const BIOME_WEIGHTS = [
  { biome: BIOME.PLAINS, weight: 4 },
  { biome: BIOME.FOREST, weight: 3 },
  { biome: BIOME.DESERT, weight: 2 },
];
const TOTAL_WEIGHT = BIOME_WEIGHTS.reduce((sum, b) => sum + b.weight, 0);

/** Cheap deterministic hash of (seed, cx, cz) -> a float in [0, 1). */
function hash01(seed, cx, cz) {
  let h = seed | 0;
  h = Math.imul(h ^ cx, 0x27d4eb2d);
  h = Math.imul(h ^ cz, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function biomeForCell(seed, cx, cz) {
  const r = hash01(seed, cx, cz) * TOTAL_WEIGHT;
  let acc = 0;
  for (const entry of BIOME_WEIGHTS) {
    acc += entry.weight;
    if (r < acc) return entry.biome;
  }
  return BIOME.PLAINS;
}

export class BiomeGenerator {
  constructor(seed) {
    this.seed = seed;
  }

  /**
   * Returns the land biome (PLAINS/FOREST/DESERT) for the given world
   * block coordinates — a jittered-Voronoi lookup against the 3x3 grid
   * cells surrounding this point, so region borders are irregular blobs
   * rather than a plain square grid or a smooth gradient.
   */
  getBiome(worldX, worldZ) {
    const baseCx = Math.floor(worldX / CELL_SIZE);
    const baseCz = Math.floor(worldZ / CELL_SIZE);

    let bestDistSq = Infinity;
    let bestBiome = BIOME.PLAINS;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = baseCx + dx;
        const cz = baseCz + dz;

        // Jitter this cell's effective "center" within its square so
        // region boundaries are irregular instead of straight grid lines.
        const jx = (cx + hash01(this.seed, cx, cz)) * CELL_SIZE;
        const jz = (cz + hash01(this.seed + 1, cx, cz)) * CELL_SIZE;

        const ddx = worldX - jx;
        const ddz = worldZ - jz;
        const distSq = ddx * ddx + ddz * ddz;

        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestBiome = biomeForCell(this.seed, cx, cz);
        }
      }
    }

    return bestBiome;
  }
}
