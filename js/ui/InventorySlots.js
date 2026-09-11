/* =========================================================
   MossBox â€” Inventory Slot Helpers
   Shared between InventoryUI (the full inventory screen) and
   any workstation screen (Crafting Table, Furnace, Chest) so
   the player's backpack + hotbar can be rendered and clicked
   consistently everywhere, with items able to move between a
   workstation's own slots (crafting grid, fuel slot, etc.) and
   the player's inventory via one shared "held stack".
   ========================================================= */

import { getBlock } from '../config/blocks.js';

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
    el.style.backgroundColor = block?.color || '#999';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

export function buildSlotEl(stack, onClick) {
  const el = document.createElement('div');
  el.className = 'slot';
  if (stack) {
    const icon = document.createElement('div');
    icon.className = 'slot-icon';
    const block = getBlock(stack.item);
    icon.style.backgroundColor = block?.color || '#999';
    el.appendChild(icon);

    if (stack.count > 1) {
      const count = document.createElement('div');
      count.className = 'slot-count';
      count.textContent = stack.count;
      el.appendChild(count);
    }
  }
  el.addEventListener('click', onClick);
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
 */
export function renderPlayerGrids(backpackEl, hotbarEl, inventory, held, onAnyChange) {
  const swap = (slots, i) => {
    const prev = held.current;
    held.current = slots[i];
    slots[i] = prev;
    onAnyChange();
  };

  syncHeldCursorIcon(held);

  backpackEl.innerHTML = '';
  inventory.backpack.forEach((stack, i) => {
    backpackEl.appendChild(buildSlotEl(stack, () => swap(inventory.backpack, i)));
  });

  hotbarEl.innerHTML = '';
  inventory.hotbar.forEach((stack, i) => {
    hotbarEl.appendChild(buildSlotEl(stack, () => swap(inventory.hotbar, i)));
  });
}
