/* =========================================================
   MossBox — Screen Manager
   Thin helper for showing/hiding the top-level full-screen
   overlays (main menu, settings, keybinds, pause). Keeps the
   "only one screen visible at a time" rule in one place.
   ========================================================= */

const SCREEN_IDS = ['main-menu', 'settings-menu', 'keybinds-menu', 'pause-menu'];

export class ScreenManager {
  show(id) {
    for (const sid of SCREEN_IDS) {
      document.getElementById(sid).classList.toggle('hidden', sid !== id);
    }
  }

  hideAll() {
    for (const sid of SCREEN_IDS) {
      document.getElementById(sid).classList.add('hidden');
    }
  }
}
