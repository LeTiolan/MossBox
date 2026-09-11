/* =========================================================
   MossBox — Workstation UI
   Renders the interior of #workstation-screen for whichever
   workstation the player opened. Currently implements the
   Crafting Table's 3x3 grid, WITH the player's backpack and
   hotbar shown alongside it (via ui/InventorySlots.js) so
   items can actually be moved in from inventory — matching
   how the main Inventory screen works. Furnace and Chest can
   follow the same pattern: give them their own <template> in
   index.html, a matching _build*Layout() here, and a
   dedicated Inventory field to read/write.
   ========================================================= */

import { matchRecipe, consumeOne } from '../engine/Crafting.js';
import { buildSlotEl, renderPlayerGrids, syncHeldCursorIcon } from './InventorySlots.js';
import { getBlock } from '../config/blocks.js';
import { showToast } from './Toast.js';

export class WorkstationUI {
  constructor(inventory, { onClose } = {}) {
    this.inventory = inventory;
    this.onClose = onClose;
    this.screenEl = document.getElementById('workstation-screen');
    this.panelEl = document.getElementById('workstation-panel');
    this.held = { current: null }; // shared with the backpack/hotbar grids below
  }

  open(type) {
    if (type === 'crafting') {
      this._buildCraftingTableLayout();
    } else {
      this._buildComingSoonLayout(type);
    }
    this.screenEl.classList.remove('hidden');
  }

  close() {
    if (this.held.current) {
      this.inventory.addItem(this.held.current.item, this.held.current.count);
      this.held.current = null;
      syncHeldCursorIcon(this.held);
    }
    this.screenEl.classList.add('hidden');
    this.onClose?.();
  }

  isOpen() {
    return !this.screenEl.classList.contains('hidden');
  }

  _buildComingSoonLayout(type) {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    this.panelEl.innerHTML = `
      <h2>${label}</h2>
      <p style="text-align:center; opacity:0.75;">This workstation isn't wired up yet.</p>
      <div class="menu-btn-row">
        <button class="btn clacky" id="btn-workstation-close">Close</button>
      </div>
    `;
    document.getElementById('btn-workstation-close').addEventListener('click', () => this.close());
  }

  _buildCraftingTableLayout() {
    const template = document.getElementById('workstation-crafting-template');
    this.panelEl.innerHTML = '';
    this.panelEl.appendChild(template.content.cloneNode(true));

    this.gridEl = this.panelEl.querySelector('[data-role="grid"]');
    this.outputEl = this.panelEl.querySelector('[data-role="output"]');
    this.backpackEl = this.panelEl.querySelector('[data-role="backpack"]');
    this.hotbarEl = this.panelEl.querySelector('[data-role="hotbar"]');
    this.panelEl.querySelector('[data-role="close"]').addEventListener('click', () => this.close());

    this._render();
  }

  _render() {
    renderPlayerGrids(this.backpackEl, this.hotbarEl, this.inventory, this.held, () => this._render());
    this._renderCraftingGrid();
  }

  _renderCraftingGrid() {
    this.gridEl.innerHTML = '';
    this.inventory.craftingGrid3x3.forEach((stack, i) => {
      this.gridEl.appendChild(buildSlotEl(stack, () => {
        const prev = this.held.current;
        this.held.current = this.inventory.craftingGrid3x3[i];
        this.inventory.craftingGrid3x3[i] = prev;
        this._render();
      }));
    });
    this._updateCraftingOutput();
  }

  _updateCraftingOutput() {
    this.outputEl.innerHTML = '';
    const result = matchRecipe(this.inventory.craftingGrid3x3, 3, 3);
    const slotEl = buildSlotEl(result ? { item: result.item, count: result.count } : null, () => {
      if (!result) return;
      this.inventory.addItem(result.item, result.count);
      consumeOne(this.inventory.craftingGrid3x3);
      showToast(`Crafted ${getBlock(result.item)?.name || result.item}`);
      this._render();
    });
    this.outputEl.appendChild(slotEl);
  }
}
