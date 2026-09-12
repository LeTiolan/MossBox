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

/**
 * Picks a biome from a low-frequency noise value in [-1, 1].
 * SUPERSEDED: World.js no longer calls this — land-biome selection now
 * comes from BiomeGenerator.js's cellular region map (classic pre-1.18-
 * style hard-edged regions instead of this smooth moisture gradient).
 * Left in place as a simpler reference implementation / fallback.
 */
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
  const top = surfaceY;

  switch (biome) {
    case BIOME.DESERT:
      stack.push({ y: top, block: 'sand' });
      for (let y = top - 1; y > top - 4; y--) stack.push({ y, block: 'sand' });
      for (let y = top - 4; y >= 1; y--) stack.push({ y, block: 'sandstone' });
      break;

    case BIOME.LAKE:
      // Lakebed material only — water itself is added by the universal
      // sea-level fill below, same as any other biome that dips below it.
      stack.push({ y: top, block: 'sand' });
      for (let y = top - 1; y > top - 3; y--) stack.push({ y, block: 'gravel' });
      for (let y = top - 3; y >= 1; y--) stack.push({ y, block: 'stone' });
      break;

    case BIOME.FOREST:
    case BIOME.PLAINS:
    default:
      stack.push({ y: top, block: 'moss' });
      for (let y = top - 1; y > top - 4; y--) stack.push({ y, block: 'dirt' });
      for (let y = top - 4; y >= 1; y--) stack.push({ y, block: 'stone' });
      break;
  }

  // Universal sea-level fill: ANY column whose actual surface sits below
  // sea level gets water up to sea level — not just LAKE-tagged columns.
  // This is what makes shorelines meet the water smoothly at biome
  // boundaries instead of leaving a mismatched edge or an artificial flat
  // shelf (the previous Math.max(surfaceY, SEA_LEVEL - 4) clamp above is
  // gone for the same reason — it forced every biome's land up to a
  // minimum height regardless of its real elevation).
  if (top < SEA_LEVEL) {
    for (let y = top + 1; y <= SEA_LEVEL; y++) stack.push({ y, block: 'water' });
  }

  stack.push({ y: 0, block: 'bedrock' });
  return stack;
}

// SUPERSEDED: World.js no longer reads this — vegetation is now placed
// per-chunk in real patches/clusters (VEGETATION_ATTEMPTS in World.js)
// instead of this per-column independent chance model, which produced
// scattered coverage across most of a chunk's 256 columns even at small
// percentages. Left here as a simpler reference implementation.
export const BIOME_SURFACE_DECOR = {
  [BIOME.PLAINS]: [
    { block: 'tall_grass', chance: 0.01 },
    { block: 'flower_red', chance: 0.0012 },
    { block: 'flower_yellow', chance: 0.0012 },
    { block: 'pumpkin', chance: 0.001 },
  ],
  [BIOME.FOREST]: [
    // Tree trunks are placed separately in World.js via a spaced grid,
    // not this per-column chance roll — see TREE_CELL_SIZE there.
    { block: 'tall_grass', chance: 0.006 },
  ],
  [BIOME.DESERT]: [
    { block: 'cactus', chance: 0.0004 },
    { block: 'dead_bush', chance: 0.003 },
  ],
  [BIOME.LAKE]: [
    { block: 'sugar_cane', chance: 0.008 },
  ],
};

export { SEA_LEVEL };
