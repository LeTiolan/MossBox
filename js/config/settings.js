/* =========================================================
   MossBox — Settings
   Persisted user preferences: render distance, FOV, volumes.
   ========================================================= */

const STORAGE_KEY = 'mossbox_settings_v1';

const DEFAULTS = {
  renderDistance: 6, // chunks
  fov: 75,
  volumeMaster: 80,
  volumeMusic: 60,
  volumeSfx: 80,
};

class SettingsStore {
  constructor() {
    this.values = this._load();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULTS, ...(saved || {}) };
    } catch {
      return { ...DEFAULTS };
    }
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
