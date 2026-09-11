/* =========================================================
   MossBox — Toast Notifications
   Small pop-up messages that appear above the hotbar and fade
   out on their own (item pickups, crafted items, etc). Call
   showToast('some message') from anywhere — no setup needed.
   ========================================================= */

const MAX_VISIBLE = 3;
const LIFETIME_MS = 1800;

export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);

  // Cap how many stack up at once so a rapid burst (e.g. mining a vein)
  // doesn't pile toasts forever — oldest just gets dropped early.
  while (container.children.length > MAX_VISIBLE) {
    container.removeChild(container.firstChild);
  }

  setTimeout(() => el.remove(), LIFETIME_MS);
}
