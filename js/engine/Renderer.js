/* =========================================================
   MossBox — Renderer
   Owns the Three.js scene, camera, renderer, and lighting.
   Chunk LOD fog-blending (distant chunks fade into sky color)
   is implemented via THREE.Fog matched to the render distance.
   ========================================================= */

export class Renderer {
  constructor(canvas, { fov = 75, renderDistanceChunks = 6 } = {}) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.skyColor = 0xbcdcff;
    this.scene.background = new THREE.Color(this.skyColor);

    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 80, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this._setupLighting();
    this.setRenderDistance(renderDistanceChunks);

    window.addEventListener('resize', () => this._onResize());
  }

  _setupLighting() {
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(120, 200, 80);
    this.scene.add(sun);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x445544, 0.55);
    this.scene.add(ambient);
  }

  setFOV(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Fog distance scales with render distance so distant chunk pop-in blends into sky. */
  setRenderDistance(chunks) {
    const CHUNK_SIZE = 16;
    const far = chunks * CHUNK_SIZE * 0.9;
    const near = Math.max(far * 0.4, 24);
    this.scene.fog = new THREE.Fog(this.skyColor, near, far);
    this.camera.far = far * 1.6;
    this.camera.updateProjectionMatrix();
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
