/* =========================================================
   MossBox — Keybinds
   Default control mapping (mirrors Minecraft) + a small
   manager that handles persistence (localStorage) and
   conflict detection for the Keybinds menu.
   ========================================================= */

// action -> { label, key, mouse }
// `key` uses KeyboardEvent.code values ('KeyW', 'Space', etc).
// `mouse` uses 'left' | 'right' | 'middle' for mouse-based actions.
export const DEFAULT_KEYBINDS = {
  moveForward:   { label: 'Move Forward',        key: 'KeyW' },
  moveBackward:  { label: 'Move Backward',       key: 'KeyS' },
  moveLeft:      { label: 'Strafe Left',         key: 'KeyA' },
  moveRight:     { label: 'Strafe Right',        key: 'KeyD' },
  jump:          { label: 'Jump',                key: 'Space' },
  sneak:         { label: 'Sneak',               key: 'ShiftLeft' },
  sprint:        { label: 'Sprint / Run',        key: 'ControlLeft' },
  dropItem:      { label: 'Drop Selected Item',  key: 'KeyQ' },
  inventory:     { label: 'Open Inventory',      key: 'KeyE' },
  chat:          { label: 'Open Chat',           key: 'KeyT' },
  perspective:   { label: 'Toggle Perspective',  key: 'F5' },
  fullscreen:    { label: 'Toggle Fullscreen',   key: 'F11' },
  screenshot:    { label: 'Take Screenshot',     key: 'F2' },
  pause:         { label: 'Pause / Menu',        key: 'Escape' },

  hotbar1: { label: 'Hotbar Slot 1', key: 'Digit1' },
  hotbar2: { label: 'Hotbar Slot 2', key: 'Digit2' },
  hotbar3: { label: 'Hotbar Slot 3', key: 'Digit3' },
  hotbar4: { label: 'Hotbar Slot 4', key: 'Digit4' },
  hotbar5: { label: 'Hotbar Slot 5', key: 'Digit5' },
  hotbar6: { label: 'Hotbar Slot 6', key: 'Digit6' },
  hotbar7: { label: 'Hotbar Slot 7', key: 'Digit7' },
  hotbar8: { label: 'Hotbar Slot 8', key: 'Digit8' },
  hotbar9: { label: 'Hotbar Slot 9', key: 'Digit9' },

  // Mouse actions are fixed to the Minecraft convention but listed here
  // so the Keybinds menu can display them (currently non-remappable).
  destroyBlock:  { label: 'Destroy / Attack', mouse: 'left',   fixed: true },
  placeOrUse:    { label: 'Place / Interact', mouse: 'right',  fixed: true },
};

const STORAGE_KEY = 'mossbox_keybinds_v1';

class KeybindManager {
  constructor() {
    this.bindings = this._load();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return structuredClone(DEFAULT_KEYBINDS);
      // Merge saved keys on top of defaults so new actions in future
      // updates don't break old save data.
      const merged = structuredClone(DEFAULT_KEYBINDS);
      for (const action in saved) {
        if (merged[action]) merged[action].key = saved[action].key;
      }
      return merged;
    } catch {
      return structuredClone(DEFAULT_KEYBINDS);
    }
  }

  save() {
    const toSave = {};
    for (const action in this.bindings) {
      if (this.bindings[action].fixed) continue;
      toSave[action] = { key: this.bindings[action].key };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }

  resetToDefault() {
    this.bindings = structuredClone(DEFAULT_KEYBINDS);
    this.save();
  }

  /** Returns the action name currently using `code`, or null. */
  findConflict(code, excludingAction) {
    for (const action in this.bindings) {
      if (action === excludingAction) continue;
      const b = this.bindings[action];
      if (!b.fixed && b.key === code) return action;
    }
    return null;
  }

  rebind(action, code) {
    if (!this.bindings[action] || this.bindings[action].fixed) return false;
    this.bindings[action].key = code;
    this.save();
    return true;
  }

  getAction(code) {
    for (const action in this.bindings) {
      if (this.bindings[action].key === code) return action;
    }
    return null;
  }
}

export const keybindManager = new KeybindManager();
