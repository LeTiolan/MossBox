/* =========================================================
   MossBox — On-Page Error Overlay (temporary diagnostic tool)
   Plain script (NOT type="module") loaded BEFORE main.js, so
   it's guaranteed to run even if main.js or something it
   imports fails to load entirely. Catches:
     - regular JS runtime errors
     - module loading failures (missing file, bad import, etc)
     - unhandled promise rejections
   and shows them in a red box at the top of the page instead
   of only logging to a devtools console you may not have
   access to.

   REMOVE THIS FILE (and its <script> tag in index.html) once
   the game loads correctly — it's a diagnostic tool, not part
   of the game itself.
   ========================================================= */

(function () {
  function ensureOverlay() {
    let el = document.getElementById('debug-error-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'debug-error-overlay';
      el.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0',
        'max-height:70vh', 'overflow:auto',
        'background:#4a0000', 'color:#ffdede',
        'font-family:monospace', 'font-size:13px', 'line-height:1.4',
        'padding:14px 18px', 'z-index:999999',
        'white-space:pre-wrap', 'word-break:break-word',
        'border-bottom:4px solid #ff4444', 'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  function showError(title, detail) {
    const el = ensureOverlay();
    const entry = document.createElement('div');
    entry.style.cssText = 'margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #772222;';
    const heading = document.createElement('div');
    heading.style.cssText = 'font-weight:bold; color:#ffb3b3; margin-bottom:4px;';
    heading.textContent = '⚠ ' + title;
    entry.appendChild(heading);
    const body = document.createElement('div');
    body.textContent = detail;
    entry.appendChild(body);
    el.appendChild(entry);
  }

  window.addEventListener('error', function (e) {
    const detail =
      'File: ' + (e.filename || 'unknown') +
      '\nLine: ' + (e.lineno || '?') + ':' + (e.colno || '?') +
      (e.error && e.error.stack ? '\n\n' + e.error.stack : '');
    showError('JavaScript Error: ' + e.message, detail);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    const reason = e.reason;
    const detail = reason && reason.stack ? reason.stack : String(reason);
    showError('Unhandled Promise Rejection', detail);
  });
})();
