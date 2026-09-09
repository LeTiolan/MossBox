/* =========================================================
   MossBox — Mob Definitions
   Data only. Behavior (wander/chase/attack) lives in
   engine/Mobs.js so new mobs can be added here without
   touching AI code, as long as they reuse one of the
   existing `behavior` types.
   ========================================================= */

export const MOBS = {
  cow: {
    name: 'Cow',
    behavior: 'passive',
    health: 10,
    size: { w: 1, h: 1.4, d: 1 },
    colors: { body: '#e8e2d0', spots: '#4a3626', udder: '#e8a0b0' },
    spawnsOn: ['moss'],
    spawnLightMin: 0, // any light
    wanderRadius: 8,
    panicOnHit: true,
    milkable: true,
    drops: [
      { item: 'raw_beef', min: 1, max: 3 },
      { item: 'leather',  min: 0, max: 2 },
    ],
  },

  zombie: {
    name: 'Zombie',
    behavior: 'hostile',
    health: 20,
    size: { w: 1, h: 2, d: 1 },
    colors: { skin: '#5b7a4a', shirt: '#3a5a9c' },
    spawnLightMax: 7,
    chaseRadius: 16,
    moveStyle: 'limp',
    attackDamage: 2,
    drops: [
      { item: 'potato', min: 0, max: 1 },
      { item: 'carrot', min: 0, max: 1 },
    ],
  },

  spider: {
    name: 'Spider',
    behavior: 'hostile',
    health: 16,
    size: { w: 1, h: 1, d: 2 },
    colors: { body: '#2e2117', eyes: '#ff3b3b' },
    spawnLightMax: 7,
    chaseRadius: 16,
    moveStyle: 'fast',
    canClimb: true,
    canLeap: true,
    attackDamage: 2,
    drops: [
      { item: 'string', min: 1, max: 2 },
    ],
  },
};

// Combat constants shared by all mobs + the player.
export const COMBAT = {
  raycastBlocks: 3,
  knockbackForce: 4,
  hitTintDurationMs: 150,
  invincibilityMs: 500,
};
