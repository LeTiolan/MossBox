/* =========================================================
   MossBox — Performance Overlay (temporary diagnostic tool)
   Shows FPS and chunk counts directly on screen, since devtools
   may not be available to check this the normal way. Creates
   its own DOM element at runtime — no index.html/CSS changes
   needed, so there's nothing to copy/paste incorrectly.

   What to look for once this is on screen:
     - FPS steady and just a bit low overall -> general rendering
       cost (try lowering Render Distance in Settings).
     - FPS fine most of the time but drops hard for a moment when
       walking toward unexplored terrain -> chunk *generation*
       cost (this is the "stutter when moving into new areas"
       issue noted in earlier fixes — a bigger fix for this would
       move generation off the main thread).
     - "Generated chunks" climbing continuously and never
       shrinking while playing in one area for a while -> a
       memory-related slowdown building up over time.

   REMOVE THIS FILE (and its two lines in main.js) once you're
   done diagnosing — it's a diagnostic tool, not part of the
   game itself.
   ========================================================= */

export class PerfOverlay {
  constructor(chunkManager, world) {
    this.chunkManager = chunkManager;
    this.world = world;

    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px',
      'background:rgba(0,0,0,0.65)', 'color:#5cff5c',
      'font-family:monospace', 'font-size:12px', 'line-height:1.5',
      'padding:8px 12px', 'border-radius:6px',
      'z-index:9998', 'white-space:pre', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(this.el);

    this._frameCount = 0;
    this._lastFpsCalc = performance.now();
    this._fps = 0;
    this._minFps = Infinity;
    this._lastTextUpdate = 0;
  }

  /** Call once per frame from the game loop. */
  update() {
    this._frameCount++;
    const now = performance.now();
    const elapsed = now - this._lastFpsCalc;

    if (elapsed >= 500) {
      this._fps = Math.round((this._frameCount * 1000) / elapsed);
      this._minFps = Math.min(this._minFps, this._fps);
      this._frameCount = 0;
      this._lastFpsCalc = now;
    }

    // Only touch the DOM a few times a second — updating every single
    // frame would make the overlay itself a source of the lag it's
    // trying to measure.
    if (now - this._lastTextUpdate >= 250) {
      this._lastTextUpdate = now;
      this.el.textContent =
        `FPS: ${this._fps}  (lowest seen: ${this._minFps === Infinity ? '-' : this._minFps})\n` +
        `Rendered chunks: ${this.chunkManager.loadedMeshes.size}\n` +
        `Generated chunks in memory: ${this.world.chunks.size}`;
    }
  }
}
