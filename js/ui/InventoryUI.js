/* =========================================================
   MossBox — Inventory Screen UI
   The full-screen inventory opened with 'E'. Renders the
   backpack grid, armor slots, a mirrored hotbar, and the 2x2
   crafting grid. Backpack/hotbar rendering is shared with
   WorkstationUI via ui/InventorySlots.js so both screens stay
   in sync and support the same click-to-pick-up/place pattern,
   plus drag-distribute (pick up a stack, then drag across
   several slots to spread it evenly — see InventorySlots.js).
   ========================================================= */

import { matchRecipe, consumeOne } from '../engine/Crafting.js';
import { buildSlotEl, renderPlayerGrids, syncHeldCursorIcon, createDragController } from './InventorySlots.js';
import { getBlock } from '../config/blocks.js';
import { showToast } from './Toast.js';

export class InventoryUI {
  constructor(inventory) {
    this.inventory = inventory;
    this.screenEl = document.getElementById('inventory-screen');
    this.backpackEl = document.getElementById('inventory-grid');
    this.hotbarMirrorEl = document.getElementById('inventory-hotbar-grid');
    this.armorEl = document.getElementById('armor-slots');
    this.craftingGridEl = document.getElementById('crafting-grid');
    this.craftingOutputEl = document.getElementById('crafting-output');

    this.held = { current: null }; // item currently "picked up" by the cursor
    this.dragController = createDragController(this.held, () => this.render());

    inventory.onChange(() => this.render());
    this.render();
  }

  open() { this.screenEl.classList.remove('hidden'); this.render(); }

  close() {
    // Return anything mid-pickup AND anything still sitting in the
    // crafting grid — previously only the held item was returned, so
    // leftover crafting-grid ingredients would just sit there invisibly
    // until the screen was reopened.
    if (this.held.current) {
      this.inventory.addItem(this.held.current.item, this.held.current.count);
      this.held.current = null;
      syncHeldCursorIcon(this.held);
    }
    for (let i = 0; i < this.inventory.craftingGrid.length; i++) {
      const stack = this.inventory.craftingGrid[i];
      if (stack) {
        this.inventory.addItem(stack.item, stack.count);
        this.inventory.craftingGrid[i] = null;
      }
    }
    this.screenEl.classList.add('hidden');
  }
  isOpen() { return !this.screenEl.classList.contains('hidden'); }
  toggle() { this.isOpen() ? this.close() : this.open(); }

  render() {
    renderPlayerGrids(this.backpackEl, this.hotbarMirrorEl, this.inventory, this.held, () => this.render(), this.dragController);
    this._renderArmor();
    this._renderCrafting();
  }

  _renderArmor() {
    this.armorEl.innerHTML = '';
    for (const key of ['helmet', 'chestplate', 'leggings', 'boots']) {
      this.armorEl.appendChild(buildSlotEl(this.inventory.armor[key], () => {
        const prev = this.held.current;
        this.held.current = this.inventory.armor[key];
        this.inventory.armor[key] = prev;
        this.render();
      }));
      // No drag-distribute wiring here — armor pieces aren't stackable,
      // so "spreading a stack across slots" doesn't apply to them.
    }
  }

  _renderCrafting() {
    this.craftingGridEl.innerHTML = '';
    this.inventory.craftingGrid.forEach((stack, i) => {
      const el = buildSlotEl(stack, () => {
        const prev = this.held.current;
        this.held.current = this.inventory.craftingGrid[i];
        this.inventory.craftingGrid[i] = prev;
        this.render();
      });
      this.dragController.wireSlot(el, this.inventory.craftingGrid, i);
      this.craftingGridEl.appendChild(el);
    });
    this._updateCraftingOutput();
  }

  _updateCraftingOutput() {
    this.craftingOutputEl.innerHTML = '';
    const result = matchRecipe(this.inventory.craftingGrid, 2, 2);
    const slotEl = buildSlotEl(result ? { item: result.item, count: result.count } : null, () => {
      if (!result) return;
      this.inventory.addItem(result.item, result.count);
      consumeOne(this.inventory.craftingGrid);
      showToast(`Crafted ${getBlock(result.item)?.name || result.item}`);
      this.render();
    });
    this.craftingOutputEl.appendChild(slotEl);
  }
}
