/* =========================================================
   MossBox — Crafting Resolver
   Shared shape-matching logic used by both the inventory's
   2x2 grid and the Crafting Table's 3x3 grid. A recipe
   matches regardless of *where* it's placed in the grid —
   both the player's layout and each recipe's shape are
   trimmed of empty border rows/columns before comparing, the
   same way Minecraft's own crafting works. A recipe whose
   trimmed shape is bigger than the available grid (e.g. a
   full 3x3 furnace shape attempted in the 2x2 inventory grid)
   simply never matches there — which is what naturally routes
   3x3 recipes to the Crafting Table without any special-casing.
   ========================================================= */

import { RECIPES } from '../config/recipes.js';

function trim(grid) {
  let rows = grid.map((r) => [...r]);
  const isRowEmpty = (r) => r.every((c) => c === null);

  while (rows.length && isRowEmpty(rows[0])) rows.shift();
  while (rows.length && isRowEmpty(rows[rows.length - 1])) rows.pop();
  if (!rows.length) return [];

  const isColEmpty = (colIndex) => rows.every((r) => r[colIndex] === null);
  while (rows[0].length && isColEmpty(0)) rows = rows.map((r) => r.slice(1));
  while (rows[0].length && isColEmpty(rows[0].length - 1)) rows = rows.map((r) => r.slice(0, -1));

  return rows;
}

function shapesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/**
 * @param {Array<{item:string,count:number}|null>} slots  flat slot array
 * @param {number} rows
 * @param {number} cols
 * @returns {{item:string,count:number}|null} the recipe result, or null
 */
export function matchRecipe(slots, rows, cols) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push(slots.slice(r * cols, r * cols + cols).map((s) => s?.item ?? null));
  }

  const trimmedGrid = trim(grid);
  if (!trimmedGrid.length) return null;

  for (const recipe of RECIPES) {
    const recipeShape = recipe.grid.map((row) => row.map((v) => v ?? null));
    const trimmedRecipe = trim(recipeShape);
    if (shapesEqual(trimmedGrid, trimmedRecipe)) return recipe.result;
  }
  return null;
}

/** Consumes exactly one of each ingredient currently placed in the grid. */
export function consumeOne(slots) {
  for (let i = 0; i < slots.length; i++) {
    const stack = slots[i];
    if (!stack) continue;
    stack.count -= 1;
    if (stack.count <= 0) slots[i] = null;
  }
}
