/* =========================================================
   MossBox â€” Inventory, Crafting & Workstation UIs
   ========================================================= */
#inventory-screen, #workstation-screen {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(5px);
}

.inventory-panel, .workstation-panel {
  min-width: 420px;
  gap: 18px;
}

.slot {
  width: 44px;
  height: 44px;
  background: var(--slot-bg);
  border: 2px solid var(--slot-border);
  border-radius: 8px;
  position: relative;
  transition: transform 150ms var(--ease-soft), box-shadow 150ms var(--ease-soft);
}

.slot:hover {
  border-color: rgba(255,255,255,0.5);
}

.slot.dragging-over {
  box-shadow: 0 0 10px rgba(255,255,255,0.6);
  transform: scale(1.06);
}

.slot .slot-icon {
  position: absolute;
  inset: 5px;
  border-radius: 5px;
}

/* ---- Held-item cursor icon ---- */
/* Follows the mouse while an item is "picked up" from a slot (see
   ui/InventorySlots.js). Sits above the custom cursor so it reads as
   "this is what you're carrying", not a replacement for the cursor. */
#held-item-icon {
  position: fixed;
  top: 0;
  left: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 10000;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
}
#held-item-icon.hidden {
  display: none;
}

.slot .slot-count {
  position: absolute;
  right: 2px;
  bottom: 0;
  font-size: 0.65rem;
  text-shadow: 1px 1px 0 #000;
  z-index: 1;
}

.crafting-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.crafting-grid {
  display: grid;
  grid-template-columns: repeat(2, 44px);
  grid-template-rows: repeat(2, 44px);
  gap: 6px;
}

.crafting-grid-3x3 {
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
}

.crafting-arrow {
  font-size: 1.6rem;
  opacity: 0.8;
}

.armor-and-player {
  display: flex;
  justify-content: center;
}

.armor-slots {
  display: grid;
  grid-template-columns: repeat(4, 44px);
  gap: 6px;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(9, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 6px;
  justify-content: center;
}

.hotbar-grid {
  display: grid;
  grid-template-columns: repeat(9, 44px);
  gap: 6px;
  justify-content: center;
}

/* ---- Furnace workstation ---- */
.furnace-layout {
  display: flex;
  align-items: center;
  gap: 24px;
}

.furnace-fire {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe29a 0%, #ffb347 55%, #ff8a3d 100%);
  box-shadow: 0 0 18px 4px rgba(255, 179, 71, 0.65);
  animation: fire-flicker 1.1s ease-in-out infinite alternate;
}

@keyframes fire-flicker {
  from { transform: scale(0.95); opacity: 0.85; }
  to   { transform: scale(1.05); opacity: 1; }
}

.furnace-progress-track {
  width: 90px;
  height: 8px;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  overflow: hidden;
}

.furnace-progress-fill {
  height: 100%;
  width: 0%;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255,255,255,0.8);
  transition: width 200ms linear;
}
