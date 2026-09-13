/* =========================================================
   MossBox — Item Color Fallback
   Real blocks already have a registered color in blocks.js.
   Non-block items (sticks, ingots, tools, food...) had none,
   so every single one fell back to the same flat gray — which
   made a successful craft of a stick or a torch or a tool look
   visually identical to "nothing happened," since only block-
   shaped results (planks, cobblestone, crafting table...) had
   any real color to show. This generates a distinct, STABLE
   color per item name (same item always gets the same color,
   different items always look different) so every crafted
   result is visually distinguishable, without needing to hand-
   maintain a giant color table for every item as new ones get
   added.
   ========================================================= */

import { getBlock } from './blocks.js';

const _cache = new Map();

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Returns a CSS color string for any item key — block or not. */
export function getItemColor(itemKey) {
  const block = getBlock(itemKey);
  if (block?.color) return block.color;

  if (_cache.has(itemKey)) return _cache.get(itemKey);

  const hash = hashString(itemKey || 'unknown');
  const hue = hash % 360;
  const color = `hsl(${hue}, 65%, 55%)`;
  _cache.set(itemKey, color);
  return color;
}

/** Returns a human-readable display name for any item key — block or not. */
export function getItemName(itemKey) {
  const block = getBlock(itemKey);
  if (block?.name) return block.name;
  if (!itemKey) return 'Unknown';
  return itemKey
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
