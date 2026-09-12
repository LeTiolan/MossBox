/* =========================================================
   MossBox — Crafting Recipes
   Each recipe is a shape-matched grid (nulls = empty slot)
   plus a result. The crafting engine (engine/Crafting.js)
   normalizes the player's grid and compares it against these
   shapes, trying both the 2x2 and 3x3 forms.
   ========================================================= */

export const RECIPES = [
  // ---- Basics ----
  { grid: [['wood_log']], result: { item: 'planks', count: 4 } },
  { grid: [['planks'], ['planks']], result: { item: 'stick', count: 4 } },
  { grid: [['coal'], ['stick']], result: { item: 'torch', count: 4 } },
  {
    grid: [
      ['iron_ingot', null, 'iron_ingot'],
      [null, 'iron_ingot', null],
    ],
    result: { item: 'bucket', count: 1 },
  },

  // ---- Blocks ----
  { grid: [['planks', 'planks'], ['planks', 'planks']], result: { item: 'crafting_table', count: 1 } },
  {
    grid: [
      ['cobblestone', 'cobblestone', 'cobblestone'],
      ['cobblestone', null,          'cobblestone'],
      ['cobblestone', 'cobblestone', 'cobblestone'],
    ],
    result: { item: 'furnace', count: 1 },
  },
  {
    grid: [
      ['planks', 'planks', 'planks'],
      ['planks', null,     'planks'],
      ['planks', 'planks', 'planks'],
    ],
    result: { item: 'chest', count: 1 },
  },
  {
    grid: [
      ['leaves', 'leaves', 'leaves'],
      ['planks', 'planks', 'planks'],
    ],
    result: { item: 'bed', count: 1 },
  },

  // ---- Tools (pattern shown for wood; same shape reused per material) ----
  ...['wood', 'stone', 'iron', 'gold', 'diamond'].flatMap((mat) => {
    const M = mat === 'wood' ? 'planks' : mat === 'stone' ? 'cobblestone' : `${mat}_ingot`;
    return [
      { grid: [[M, M, M], [null, 'stick', null], [null, 'stick', null]], result: { item: `${mat}_pickaxe`, count: 1 } },
      { grid: [[M, M], [M, 'stick'], [null, 'stick']], result: { item: `${mat}_axe`, count: 1 } },
      { grid: [[M], [M], ['stick']], result: { item: `${mat}_sword`, count: 1 } },
      { grid: [[M], ['stick'], ['stick']], result: { item: `${mat}_shovel`, count: 1 } },
      { grid: [[M, M], [null, 'stick'], [null, 'stick']], result: { item: `${mat}_hoe`, count: 1 } },
    ];
  }),

  // ---- Food ----
  { grid: [['wheat', 'wheat', 'wheat']], result: { item: 'bread', count: 1 } },
  { grid: [['gold_ingot', 'gold_ingot', 'gold_ingot'], ['gold_ingot', 'apple', 'gold_ingot'], ['gold_ingot', 'gold_ingot', 'gold_ingot']], result: { item: 'golden_apple', count: 1 } },
  { grid: [['gold_ingot', 'gold_ingot', 'gold_ingot'], ['gold_ingot', 'carrot', 'gold_ingot'], ['gold_ingot', 'gold_ingot', 'gold_ingot']], result: { item: 'golden_carrot', count: 1 } },
];

// Smelting recipes for the Furnace (raw item -> smelted item + burn ticks needed).
export const SMELTING_RECIPES = {
  iron_ore:   { result: 'iron_ingot',   ticks: 200 },
  gold_ore:   { result: 'gold_ingot',   ticks: 200 },
  raw_beef:   { result: 'cooked_beef',  ticks: 200 },
  sand:       { result: 'glass',        ticks: 200 },
};

// How many burn ticks each fuel item provides.
export const FUEL_VALUES = {
  planks: 150,
  wood_log: 300,
  coal: 1600,
  stick: 50,
};
