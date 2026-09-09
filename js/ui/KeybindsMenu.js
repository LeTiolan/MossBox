/* =========================================================
   MossBox — Keybinds Menu
   Renders one row per remappable action. Clicking a key
   button enters "listening" mode; the next keypress becomes
   the new binding, unless it's already used elsewhere, in
   which case a warning flashes and the rebind is rejected.
   ========================================================= */

import { keybindManager } from '../config/keybinds.js';

const KEY_LABELS = {
  Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc',
};

function labelForCode(code) {
  if (!code) return '—';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export class KeybindsMenu {
  constructor() {
    this.listEl = document.getElementById('keybind-list');
    this.warningEl = document.getElementById('keybind-conflict-warning');
    this._listeningAction = null;

    document.getElementById('btn-keybinds-reset').addEventListener('click', () => {
      keybindManager.resetToDefault();
      this.render();
    });

    document.addEventListener('keydown', (e) => this._onKeyDown(e));

    this.render();
  }

  render() {
    this.listEl.innerHTML = '';
    for (const action in keybindManager.bindings) {
      const binding = keybindManager.bindings[action];
      const row = document.createElement('div');
      row.className = 'keybind-row-label';
      row.textContent = binding.label;

      const btn = document.createElement('button');
      btn.className = 'btn clacky keybind-key-btn';
      btn.textContent = binding.fixed
        ? (binding.mouse === 'left' ? 'Left Click' : 'Right Click')
        : labelForCode(binding.key);

      if (!binding.fixed) {
        btn.addEventListener('click', () => this._startListening(action, btn));
      } else {
        btn.disabled = true;
        btn.style.opacity = 0.6;
      }

      this.listEl.appendChild(row);
      this.listEl.appendChild(btn);
    }
  }

  _startListening(action, btnEl) {
    this._listeningAction = action;
    this._listeningBtn = btnEl;
    btnEl.textContent = 'Press a key…';
    btnEl.classList.add('listening');
  }

  _onKeyDown(e) {
    if (!this._listeningAction) return;
    e.preventDefault();

    const conflict = keybindManager.findConflict(e.code, this._listeningAction);
    if (conflict) {
      this._showConflictWarning();
      this._listeningBtn.classList.remove('listening');
      this._listeningBtn.textContent = labelForCode(keybindManager.bindings[this._listeningAction].key);
      this._listeningAction = null;
      return;
    }

    keybindManager.rebind(this._listeningAction, e.code);
    this._listeningAction = null;
    this.render();
  }

  _showConflictWarning() {
    this.warningEl.classList.remove('hidden');
    clearTimeout(this._warnTimeout);
    this._warnTimeout = setTimeout(() => this.warningEl.classList.add('hidden'), 2200);
  }
}
