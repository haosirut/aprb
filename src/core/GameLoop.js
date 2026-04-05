console.log('[Core] GameLoop loaded');

export class GameLoop {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.lastTime = 0;
    this.deltaTime = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / 60;
    this.updateCallback = null;
    this.renderCallback = null;
    this._rafId = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    console.log(`[Core] Canvas resized: ${this.width}x${this.height} (dpr: ${dpr})`);
  }

  onUpdate(cb) {
    this.updateCallback = cb;
  }

  onRender(cb) {
    this.renderCallback = cb;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
    console.log('[Core] GameLoop started');
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    console.log('[Core] GameLoop stopped');
  }

  _loop(now) {
    if (!this.running) return;
    this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedDt) {
      if (this.updateCallback) this.updateCallback(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    if (this.renderCallback) this.renderCallback(this.ctx, this.width, this.height);

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }
}
