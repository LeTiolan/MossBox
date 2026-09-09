/* =========================================================
   MossBox — Settings Menu
   Wires the sliders in #settings-menu to the settings store
   and applies live changes to the renderer/audio manager.
   ========================================================= */

import { settings } from '../config/settings.js';
import { audio } from '../audio/AudioManager.js';

export class SettingsMenu {
  constructor({ onRenderDistanceChange, onFovChange }) {
    this.onRenderDistanceChange = onRenderDistanceChange;
    this.onFovChange = onFovChange;

    this.els = {
      renderDistance: document.getElementById('setting-render-distance'),
      fov: document.getElementById('setting-fov'),
      volMaster: document.getElementById('setting-vol-master'),
      volMusic: document.getElementById('setting-vol-music'),
      volSfx: document.getElementById('setting-vol-sfx'),
    };
    this.valEls = {
      renderDistance: document.getElementById('val-render-distance'),
      fov: document.getElementById('val-fov'),
      volMaster: document.getElementById('val-vol-master'),
      volMusic: document.getElementById('val-vol-music'),
      volSfx: document.getElementById('val-vol-sfx'),
    };

    this._loadIntoInputs();
    this._bind();
  }

  _loadIntoInputs() {
    this.els.renderDistance.value = settings.get('renderDistance');
    this.els.fov.value = settings.get('fov');
    this.els.volMaster.value = settings.get('volumeMaster');
    this.els.volMusic.value = settings.get('volumeMusic');
    this.els.volSfx.value = settings.get('volumeSfx');
    this._refreshLabels();
  }

  _refreshLabels() {
    this.valEls.renderDistance.textContent = this.els.renderDistance.value;
    this.valEls.fov.textContent = this.els.fov.value;
    this.valEls.volMaster.textContent = this.els.volMaster.value;
    this.valEls.volMusic.textContent = this.els.volMusic.value;
    this.valEls.volSfx.textContent = this.els.volSfx.value;
  }

  _bind() {
    this.els.renderDistance.addEventListener('input', () => {
      const val = Number(this.els.renderDistance.value);
      settings.set('renderDistance', val);
      this._refreshLabels();
      this.onRenderDistanceChange?.(val);
    });

    this.els.fov.addEventListener('input', () => {
      const val = Number(this.els.fov.value);
      settings.set('fov', val);
      this._refreshLabels();
      this.onFovChange?.(val);
    });

    const applyVolumes = () => {
      audio.setVolumes({
        master: Number(this.els.volMaster.value) / 100,
        music: Number(this.els.volMusic.value) / 100,
        sfx: Number(this.els.volSfx.value) / 100,
      });
    };

    this.els.volMaster.addEventListener('input', () => {
      settings.set('volumeMaster', Number(this.els.volMaster.value));
      this._refreshLabels();
      applyVolumes();
    });
    this.els.volMusic.addEventListener('input', () => {
      settings.set('volumeMusic', Number(this.els.volMusic.value));
      this._refreshLabels();
      applyVolumes();
    });
    this.els.volSfx.addEventListener('input', () => {
      settings.set('volumeSfx', Number(this.els.volSfx.value));
      this._refreshLabels();
      applyVolumes();
    });

    applyVolumes();
  }
}
