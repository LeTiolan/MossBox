/* =========================================================
   MossBox — Custom Cursor
   A glowing white circle replaces the OS cursor across every
   menu. It glows slightly brighter whenever hovering a
   `.btn` / `.slot` / interactive element, and hides entirely
   while pointer-lock gameplay is active (the in-game
   crosshair takes over at that point).
   ========================================================= */

export function initCustomCursor() {
  const cursorEl = document.getElementById('custom-cursor');

  document.addEventListener('mousemove', (e) => {
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('.btn, .slot, input[type="range"], .keybind-key-btn')) {
      cursorEl.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.btn, .slot, input[type="range"], .keybind-key-btn')) {
      cursorEl.classList.remove('cursor-hover');
    }
  });

  document.addEventListener('pointerlockchange', () => {
    cursorEl.classList.toggle('cursor-locked', !!document.pointerLockElement);
  });
}
