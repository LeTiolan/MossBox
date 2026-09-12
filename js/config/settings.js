/* =========================================================
   MossBox — Settings
   Persisted user preferences: render distance, FOV, volumes.
   ========================================================= */

const STORAGE_KEY = 'mossbox_settings_v1';

const DEFAULTS = {
  renderDistance: 5, // chunks
  fov: 75,
  volumeMaster: 80,
  volumeMusic: 60,
  volumeSfx: 80,
};

const MAX_RENDER_DISTANCE = 8; // matches index.html's slider max

class SettingsStore {
  constructor() {
    this.values = this._load();
  }

  _load() {
    let merged;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      merged = { ...DEFAULTS, ...(saved || {}) };
    } catch {
      merged = { ...DEFAULTS };
    }

    // Clamp a returning player's already-saved value in case it predates
    // the render-distance cap being lowered (was 12, now 8) — otherwise
    // the stored number stays too high even though the slider itself
    // would visually clamp to the new max.
    if (merged.renderDistance > MAX_RENDER_DISTANCE) {
      merged.renderDistance = MAX_RENDER_DISTANCE;
    }

    return merged;
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
  }

  set(key, value) {
    this.values[key] = value;
    this.save();
  }

  get(key) {
    return this.values[key];
  }
}

export const settings = new SettingsStore();
