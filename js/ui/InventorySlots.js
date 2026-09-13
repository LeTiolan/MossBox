/* =========================================================
   MossBox — Inventory Slot Helpers
   Shared between InventoryUI (the full inventory screen) and
   any workstation screen (Crafting Table, Furnace, Chest) so
   the player's backpack + hotbar can be rendered and clicked
   consistently everywhere, with items able to move between a
   workstation's own slots (crafting grid, fuel slot, etc.) and
   the player's inventory via one shared "held stack".

   Also provides drag-distribute: after picking up a stack with
   one click, holding the mouse/trackpad button down and
   dragging across several empty (or same-item) slots spreads
   the stack evenly across all of them — the same gesture
   Minecraft's own inventory uses, and essential for splitting
   materials across a crafting grid without clicking one at a
   time.
   ========================================================= */

import { getBlock } from '../config/blocks.js';
import { getItemColor, getItemName } from '../config/itemColors.js';
import { showToast } from './Toast.js';

let heldIconEl = null;
function getHeldIconEl() {
  if (!heldIconEl) heldIconEl = document.getElementById('held-item-icon');
  return heldIconEl;
}

// One shared listener keeps the icon glued to the cursor whenever it's
// visible; it's a no-op while nothing is held, so this is safe to run
// unconditionally for the lifetime of the page.
document.addEventListener('mousemove', (e) => {
  const el = getHeldIconEl();
  if (!el || el.classList.contains('hidden')) return;
  el.style.left = `${e.clientX}px`;
  el.style.top = `${e.clientY}px`;
});

/** Shows/hides and re-colors the floating held-item icon to match `held.current`. */
export function syncHeldCursorIcon(held) {
  const el = getHeldIconEl();
  if (!el) return;
  if (held.current) {
    const block = getBlock(held.current.item);
    el.style.backgroundColor = block?.color || getItemColor(held.current.item);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/**
 * Creates a drag-distribute controller for one screen (Inventory or
 * Workstation — each screen makes its own, since each has its own `held`
 * holder). Call `wireSlot(el, arrayRef, index)` on every slot element
 * that should support drag-distribute, right after building it.
 *
 * Gesture: click a stack to pick it up (already handled elsewhere via
 * each slot's onClick), then press and hold the mouse/trackpad button
 * down and drag across several empty or same-item slots — releasing
 * spreads the held stack evenly across every slot visited.
 */
export function createDragController(held, onAnyChange) {
  let mouseIsDown = false;
  let visited = []; // [{ arrayRef, index }]

  function alreadyVisited(arrayRef, index) {
    return visited.some((v) => v.arrayRef === arrayRef && v.index === index);
  }

  function tryVisit(arrayRef, index) {
    if (!held.current || alreadyVisited(arrayRef, index)) return;
    const existing = arrayRef[index];
    // Only allow dragging over empty slots or slots already holding the
    // same item — a slot with something else in it just gets skipped.
    if (!existing || existing.item === held.current.item) {
      visited.push({ arrayRef, index });
    }
  }

  function distribute() {
    const stack = held.current;
    const total = stack.count;
    const n = visited.length;
    const perSlot = Math.max(1, Math.floor(total / n));
    let remaining = total;

    for (const { arrayRef, index } of visited) {
      if (remaining <= 0) break;
      const give = Math.min(perSlot, remaining);
      const existing = arrayRef[index];
      if (existing) {
        existing.count += give;
      } else {
        arrayRef[index] = { item: stack.item, count: give };
      }
      remaining -= give;
    }

    held.current = remaining > 0 ? { item: stack.item, count: remaining } : null;
    onAnyChange();
  }

  document.addEventListener('mouseup', () => {
    // Only treat it as a distribute-drag if MORE than one slot was
    // visited — a single slot with no movement is just a normal click,
    // already handled by that slot's own onClick handler.
    if (mouseIsDown && visited.length > 1 && held.current) {
      distribute();
    }
    mouseIsDown = false;
    visited = [];
  });

  return {
    wireSlot(el, arrayRef, index) {
      el.addEventListener('mousedown', () => {
        mouseIsDown = true;
        tryVisit(arrayRef, index);
      });
      el.addEventListener('mouseenter', () => {
        if (mouseIsDown) tryVisit(arrayRef, index);
      });
    },
  };
}

const MAX_STACK = 64;

/**
 * Click-to-place logic that MERGES into a matching stack instead of
 * blindly swapping — clicking a slot that already holds the same item
 * (and isn't full) adds to it instead of exchanging the two stacks,
 * which used to destroy whatever was already there. Any overflow beyond
 * MAX_STACK stays in `held.current`; a fully different item still does
 * a plain swap, same as before.
 */
export function placeOrMerge(held, slots, i) {
  const target = slots[i];

  if (held.current && target && target.item === held.current.item) {
    const space = MAX_STACK - target.count;
    const move = Math.min(space, held.current.count);
    target.count += move;
    held.current.count -= move;
    held.current = held.current.count > 0 ? held.current : null;
    return;
  }

  const prev = held.current;
  held.current = target;
  slots[i] = prev;
}

export function buildSlotEl(stack, onClick) {
  const el = document.createElement('div');
  el.className = 'slot';
  if (stack) {
    const icon = document.createElement('div');
    icon.className = 'slot-icon';
    const block = getBlock(stack.item);
    icon.style.backgroundColor = block?.color || getItemColor(stack.item);
    el.appendChild(icon);

    if (stack.count > 1) {
      const count = document.createElement('div');
      count.className = 'slot-count';
      count.textContent = stack.count;
      el.appendChild(count);
    }
  }
  el.addEventListener('click', () => {
    // Momentarily show the item's name whenever a slot with something in
    // it is clicked, same spirit as switching hotbar slots below.
    if (stack) showToast(getItemName(stack.item));
    onClick();
  });
  return el;
}

/**
 * Renders the player's backpack + hotbar into the given container
 * elements. `held` is a shared mutable holder ({ current: stack|null })
 * so whatever screen is calling this can also let items flow into its
 * own slots (a crafting grid, a fuel slot, etc.) using the same "click to
 * pick up, click elsewhere to place" held-item pattern. `onAnyChange` is
 * called after every swap so the caller can re-render dependent UI (e.g.
 * a crafting output slot that might now match a different recipe).
 * `dragController` (from createDragController) is optional — pass it to
 * enable drag-distribute across the backpack/hotbar too.
 */
export function renderPlayerGrids(backpackEl, hotbarEl, inventory, held, onAnyChange, dragController) {
  const place = (slots, i) => {
    placeOrMerge(held, slots, i);
    onAnyChange();
  };

  syncHeldCursorIcon(held);

  backpackEl.innerHTML = '';
  inventory.backpack.forEach((stack, i) => {
    const el = buildSlotEl(stack, () => place(inventory.backpack, i));
    dragController?.wireSlot(el, inventory.backpack, i);
    backpackEl.appendChild(el);
  });

  hotbarEl.innerHTML = '';
  inventory.hotbar.forEach((stack, i) => {
    const el = buildSlotEl(stack, () => place(inventory.hotbar, i));
    dragController?.wireSlot(el, inventory.hotbar, i);
    hotbarEl.appendChild(el);
  });
}
