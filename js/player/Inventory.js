/* =========================================================
   MossBox — Inventory
   Pure data model for the 9-slot hotbar, 27-slot backpack,
   4 armor slots, and 2x2 crafting grid. UI rendering lives in
   ui/HUD.js and ui/InventoryUI.js; this file just tracks state
   and fires a callback so the UI can re-render on change.
   ========================================================= */

const HOTBAR_SIZE = 9;
const BACKPACK_SIZE = 27;

export class Inventory {
  constructor() {
    this.hotbar = new Array(HOTBAR_SIZE).fill(null);
    this.backpack = new Array(BACKPACK_SIZE).fill(null);
    this.armor = { helmet: null, chestplate: null, leggings: null, boots: null };
    this.craftingGrid = new Array(4).fill(null); // 2x2, usable anywhere (inventory or crafting table)
    this.craftingGrid3x3 = new Array(9).fill(null); // 3x3, Crafting Table only

    this.selectedHotbarIndex = 0;
    this._onChangeCallbacks = [];

    // Give the player a starting torch + planks so the demo isn't empty-handed.
    this.hotbar[0] = { item: 'planks', count: 16 };
    this.hotbar[1] = { item: 'torch', count: 8 };
  }

  onChange(cb) { this._onChangeCallbacks.push(cb); }
  _notify() { this._onChangeCallbacks.forEach((cb) => cb(this)); }

  selectHotbarSlot(index) {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.selectedHotbarIndex = index;
    this._notify();
  }

  getSelectedStack() {
    return this.hotbar[this.selectedHotbarIndex];
  }

  /** Adds an item, stacking onto existing hotbar/backpack stacks first. Returns leftover count that didn't fit. */
  addItem(item, count = 1, maxStack = 64) {
    let remaining = count;
    const allSlots = [...this.hotbar, ...this.backpack];

    for (const slots of [this.hotbar, this.backpack]) {
      for (let i = 0; i < slots.length && remaining > 0; i++) {
        const stack = slots[i];
        if (stack && stack.item === item && stack.count < maxStack) {
          const space = maxStack - stack.count;
          const add = Math.min(space, remaining);
          stack.count += add;
          remaining -= add;
        }
      }
    }

    for (const slots of [this.hotbar, this.backpack]) {
      for (let i = 0; i < slots.length && remaining > 0; i++) {
        if (!slots[i]) {
          const add = Math.min(maxStack, remaining);
          slots[i] = { item, count: add };
          remaining -= add;
        }
      }
    }

    this._notify();
    return remaining;
  }

  removeFromSelected(count = 1) {
    const stack = this.getSelectedStack();
    if (!stack) return;
    stack.count -= count;
    if (stack.count <= 0) this.hotbar[this.selectedHotbarIndex] = null;
    this._notify();
  }

  dropSelected() {
    const stack = this.getSelectedStack();
    if (!stack) return null;
    this.hotbar[this.selectedHotbarIndex] = null;
    this._notify();
    return stack; // caller (Interaction.js) can spawn a physical item entity later
  }
}
