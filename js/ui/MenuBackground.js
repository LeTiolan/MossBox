/* =========================================================
   MossBox — Menu Background
   A slow 3D panning camera drifting past floating moss-green
   cubes, purely decorative, behind the main menu panel.
   ========================================================= */

export class MenuBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c2029);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040, 1.2));

    this.cubes = [];
    const colors = [0x5b8a3a, 0x7a5230, 0x8a8a8f, 0xc9a15a];
    for (let i = 0; i < 30; i++) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
      const cube = new THREE.Mesh(geo, mat);
      cube.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 16, -Math.random() * 30 - 5);
      this.scene.add(cube);
      this.cubes.push(cube);
    }

    this._time = 0;
    window.addEventListener('resize', () => this._onResize());
    this._animate = this._animate.bind(this);
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._animate();
  }

  stop() { this._running = false; }

  _animate() {
    if (!this._running) return;
    requestAnimationFrame(this._animate);
    this._time += 0.004;

    this.camera.position.x = Math.sin(this._time) * 6;
    this.camera.position.y = Math.sin(this._time * 0.6) * 2;
    this.camera.lookAt(0, 0, -20);

    for (const cube of this.cubes) {
      cube.rotation.x += 0.002;
      cube.rotation.y += 0.003;
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
