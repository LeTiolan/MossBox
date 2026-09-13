/* =========================================================
   MossBox — HUD
   Renders the hotbar, hearts, and hunger shanks, and keeps
   them in sync with Inventory / player health & hunger state.
   ========================================================= */

import { getBlock } from '../config/blocks.js';
import { getItemColor, getItemName } from '../config/itemColors.js';
import { showToast } from './Toast.js';

export class HUD {
  constructor(inventory) {
    this.inventory = inventory;
    this.hotbarEl = document.getElementById('hotbar');
    this.heartsEl = document.getElementById('hearts-row');
    this.hungerEl = document.getElementById('hunger-row');

    this.health = 20; // 10 hearts x 2
    this.hunger = 20; // 10 shanks x 2

    inventory.onChange(() => this.renderHotbar());
    this.renderHotbar();
    this.renderHealth();
    this.renderHunger();
  }

  renderHotbar() {
    this.hotbarEl.innerHTML = '';
    this.inventory.hotbar.forEach((stack, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === this.inventory.selectedHotbarIndex ? ' selected' : '');

      if (stack) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const block = getBlock(stack.item);
        icon.style.backgroundColor = block?.color || getItemColor(stack.item);
        slot.appendChild(icon);

        if (stack.count > 1) {
          const count = document.createElement('div');
          count.className = 'slot-count';
          count.textContent = stack.count;
          slot.appendChild(count);
        }
      }

      slot.addEventListener('click', () => {
        this.inventory.selectHotbarSlot(i);
        if (stack) showToast(getItemName(stack.item));
      });
      this.hotbarEl.appendChild(slot);
    });
  }

  renderHealth() {
    this.heartsEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('div');
      const filled = this.health >= (i + 1) * 2;
      heart.className = 'heart' + (filled ? '' : ' empty');
      this.heartsEl.appendChild(heart);
    }
  }

  renderHunger() {
    this.hungerEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const shank = document.createElement('div');
      const filled = this.hunger >= (i + 1) * 2;
      shank.className = 'shank' + (filled ? '' : ' empty');
      this.hungerEl.appendChild(shank);
    }
  }

  setHealth(value) {
    this.health = Math.max(0, Math.min(20, value));
    this.renderHealth();
  }

  setHunger(value) {
    this.hunger = Math.max(0, Math.min(20, value));
    this.renderHunger();
  }
}
