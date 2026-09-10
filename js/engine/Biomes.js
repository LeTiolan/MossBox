/* =========================================================
   MossBox — Biome Definitions & Column Generation
   Decides, per (x,z) surface column, which biome applies and
   what the vertical block stack looks like. Kept separate
   from World.js so new biomes can be added without touching
   chunk-management code.
   ========================================================= */

export const BIOME = {
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  LAKE: 'lake',
};

const SEA_LEVEL = 64;

/** Picks a biome id from a low-frequency noise value in [-1, 1]. */
export function pickBiome(moistureNoise, heightNoise) {
  if (heightNoise < -0.25) return BIOME.LAKE;
  if (moistureNoise < -0.35) return BIOME.DESERT;
  if (moistureNoise > 0.3) return BIOME.FOREST;
  return BIOME.PLAINS;
}

/**
 * Builds the vertical block stack for one surface column.
 * Returns an array of { y, block } from bedrock up through
 * whatever decoration sits on the surface.
 */
export function buildColumn(biome, surfaceY) {
  const stack = [];
  const top = Math.max(surfaceY, SEA_LEVEL - 4);

  switch (biome) {
    case BIOME.DESERT:
      stack.push({ y: top, block: 'sand' });
      for (let y = top - 1; y > top - 4; y--) stack.push({ y, block: 'sand' });
      for (let y = top - 4; y >= 1; y--) stack.push({ y, block: 'sandstone' });
      break;

    case BIOME.LAKE:
      // Lakebed: sand/gravel/dirt shore blend, filled with water up to sea level.
      stack.push({ y: top, block: 'sand' });
      for (let y = top - 1; y > top - 3; y--) stack.push({ y, block: 'gravel' });
      for (let y = top - 3; y >= 1; y--) stack.push({ y, block: 'stone' });
      for (let y = top + 1; y <= SEA_LEVEL; y++) stack.push({ y, block: 'water' });
      break;

    case BIOME.FOREST:
    case BIOME.PLAINS:
    default:
      stack.push({ y: top, block: 'moss' });
      for (let y = top - 1; y > top - 4; y--) stack.push({ y, block: 'dirt' });
      for (let y = top - 4; y >= 1; y--) stack.push({ y, block: 'stone' });
      break;
  }

  stack.push({ y: 0, block: 'bedrock' });
  return stack;
}

export const BIOME_SURFACE_DECOR = {
  [BIOME.PLAINS]: [
    { block: 'tall_grass', chance: 0.03 },
    { block: 'flower_red', chance: 0.004 },
    { block: 'flower_yellow', chance: 0.004 },
    { block: 'pumpkin', chance: 0.002 },
  ],
  [BIOME.FOREST]: [
    { block: 'wood_log', chance: 0.02, isTreeTrunk: true },
    { block: 'tall_grass', chance: 0.015 },
  ],
  [BIOME.DESERT]: [
    { block: 'cactus', chance: 0.01 },
    { block: 'dead_bush', chance: 0.008 },
  ],
  [BIOME.LAKE]: [
    { block: 'sugar_cane', chance: 0.02 },
  ],
};

export { SEA_LEVEL };
