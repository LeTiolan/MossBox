/* =========================================================
   MossBox — Block Registry
   Single source of truth for every block in the game.

   TEXTURE HOOK:
   Each block has a `color` (used right now for flat-shaded
   cubes) and a `texture` field that is currently null. Once
   16x16 texture files exist, drop them in
   /assets/textures/blocks/<textureKey>.png and the renderer
   (see engine/TextureManager.js) will automatically prefer
   the image over the flat color — no other code changes
   needed.
   ========================================================= */

export const BLOCKS = {
  air:        { id: 0,  name: 'Air',        color: null,      solid: false, transparent: true },

  moss:       { id: 1,  name: 'Moss Block', color: '#5b8a3a', solid: true,  tillable: true,  texture: 'moss' },
  dirt:       { id: 2,  name: 'Dirt',       color: '#7a5230', solid: true,  tillable: true,  texture: 'dirt' },
  stone:      { id: 3,  name: 'Stone',      color: '#8a8a8f', solid: true,  drops: 'cobblestone', texture: 'stone' },
  cobblestone:{ id: 4,  name: 'Cobblestone',color: '#767679', solid: true,  texture: 'cobblestone' },
  bedrock:    { id: 5,  name: 'Bedrock',    color: '#232323', solid: true,  unbreakable: true, texture: 'bedrock' },

  sand:       { id: 6,  name: 'Sand',       color: '#e3d29b', solid: true,  gravity: true, texture: 'sand' },
  sandstone:  { id: 7,  name: 'Sandstone',  color: '#d8c489', solid: true,  texture: 'sandstone' },
  gravel:     { id: 8,  name: 'Gravel',     color: '#9a9a92', solid: true,  gravity: true, drops: 'flint', texture: 'gravel' },
  obsidian:   { id: 9,  name: 'Obsidian',   color: '#241429', solid: true,  requiresTool: 'diamond_pickaxe', texture: 'obsidian' },

  water:      { id: 10, name: 'Water',      color: '#3a76c9', solid: false, transparent: true, fluid: true, flowDistance: 7, texture: 'water' },
  lava:       { id: 11, name: 'Lava',       color: '#e0631f', solid: false, transparent: true, fluid: true, flowDistance: 3, lightLevel: 15, damage: 4, texture: 'lava' },

  wood_log:   { id: 12, name: 'Wood Log',   color: '#6b4a2b', solid: true,  texture: 'wood_log' },
  leaves:     { id: 13, name: 'Leaves',     color: '#3f7a34', solid: true,  transparent: true, drops: 'apple', texture: 'leaves' },
  tall_grass: { id: 14, name: 'Tall Grass', color: '#6fae4a', solid: false, cross: true, drops: 'wheat_seeds', texture: 'tall_grass' },
  flower_red: { id: 15, name: 'Red Flower', color: '#c1453d', solid: false, cross: true, texture: 'flower_red' },
  flower_yellow:{ id:16,name: 'Yellow Flower',color:'#e0c93f',solid: false, cross: true, texture: 'flower_yellow' },
  cactus:     { id: 17, name: 'Cactus',     color: '#4f9e3c', solid: true,  damage: 1, texture: 'cactus' },
  sugar_cane: { id: 18, name: 'Sugar Cane', color: '#9fdc7c', solid: false, cross: true, requiresWaterAdjacent: true, texture: 'sugar_cane' },
  pumpkin:    { id: 19, name: 'Pumpkin',    color: '#d9791f', solid: true,  texture: 'pumpkin' },
  melon:      { id: 20, name: 'Melon',      color: '#4d7a2e', solid: true,  drops: 'melon_slice', texture: 'melon' },
  dead_bush:  { id: 21, name: 'Dead Bush',  color: '#8a6a3d', solid: false, cross: true, texture: 'dead_bush' },
  farmland:   { id: 22, name: 'Farmland',   color: '#5a3d22', solid: true,  heightFraction: 0.9375, texture: 'farmland' },

  coal_ore:   { id: 23, name: 'Coal Ore',   color: '#4a4a4a', solid: true,  drops: 'coal', texture: 'coal_ore' },
  iron_ore:   { id: 24, name: 'Iron Ore',   color: '#c9a184', solid: true,  requiresTool: 'stone_pickaxe', requiresSmelting: true, texture: 'iron_ore' },
  gold_ore:   { id: 25, name: 'Gold Ore',   color: '#e8d349', solid: true,  requiresTool: 'iron_pickaxe',  requiresSmelting: true, texture: 'gold_ore' },
  diamond_ore:{ id: 26, name: 'Diamond Ore',color: '#63e0d6', solid: true,  requiresTool: 'iron_pickaxe',  texture: 'diamond_ore' },

  planks:     { id: 27, name: 'Planks',     color: '#c9a15a', solid: true, texture: 'planks' },
  stone_bricks:{id: 28, name: 'Stone Bricks',color:'#7d7d81', solid: true, texture: 'stone_bricks' },
  glass:      { id: 29, name: 'Glass',      color: '#bfe4f2', solid: true, transparent: true, texture: 'glass' },

  iron_block:   { id: 30, name: 'Block of Iron',   color: '#e4e4e4', solid: true, texture: 'iron_block' },
  gold_block:   { id: 31, name: 'Block of Gold',   color: '#f5da3c', solid: true, texture: 'gold_block' },
  diamond_block:{ id: 32, name: 'Block of Diamond',color: '#5be3d3', solid: true, texture: 'diamond_block' },

  torch:      { id: 33, name: 'Torch',      color: '#ffcf5c', solid: false, lightLevel: 14, texture: 'torch' },
  slab:       { id: 34, name: 'Slab',       color: '#b6b6ba', solid: true,  heightFraction: 0.5, texture: 'slab' },
  stairs:     { id: 35, name: 'Stairs',     color: '#b6b6ba', solid: true,  texture: 'stairs' },
  door:       { id: 36, name: 'Door',       color: '#9c7a45', solid: true,  texture: 'door' },
  ladder:     { id: 37, name: 'Ladder',     color: '#8a6a3d', solid: false, texture: 'ladder' },
  glass_pane: { id: 38, name: 'Glass Pane', color: '#bfe4f2', solid: true,  transparent: true, texture: 'glass_pane' },

  crafting_table: { id: 39, name: 'Crafting Table', color: '#a97c45', solid: true, workstation: 'crafting', texture: 'crafting_table' },
  furnace:        { id: 40, name: 'Furnace',        color: '#6e6e6e', solid: true, workstation: 'furnace',  texture: 'furnace' },
  chest:          { id: 41, name: 'Chest',          color: '#9c6b32', solid: true, workstation: 'chest',    texture: 'chest' },
};

// Reverse lookup by numeric id (used by chunk data arrays, which store ids).
export const BLOCKS_BY_ID = Object.fromEntries(
  Object.values(BLOCKS).map((b) => [b.id, b])
);

export function getBlock(idOrKey) {
  if (typeof idOrKey === 'number') return BLOCKS_BY_ID[idOrKey];
  return BLOCKS[idOrKey];
}
