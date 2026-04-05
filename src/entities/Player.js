console.log('[Entity] Player loaded');

export class Player {
  constructor(canvasWidth, canvasHeight) {
    this.width = canvasWidth / 5;
    this.height = this.width;
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = canvasHeight * 0.95;
    this.targetX = this.x;
    this.flashTimer = 0;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  setUnits(val) {
    this.flashTimer = 0.15;
  }

  update(dt, canvasWidth, canvasHeight) {
    this.y = canvasHeight * 0.95;
    this.width = canvasWidth / 5;
    this.height = this.width;

    const lerpSpeed = 12;
    this.x += (this.targetX - this.x) * lerpSpeed * dt;

    const minX = 0;
    const maxX = canvasWidth - this.width;
    this.x = Math.max(minX, Math.min(maxX, this.x));

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  onResize(newWidth, newHeight) {
    this.width = newWidth / 5;
    this.height = this.width;
    this.y = newHeight * 0.95;
    const maxX = newWidth - this.width;
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.targetX = this.x;
  }

  render(ctx) {
    ctx.save();
    const alpha = this.flashTimer > 0 ? 0.5 + 0.5 * Math.sin(this.flashTimer * 30) : 1;
    ctx.globalAlpha = alpha;

    ctx.fillStyle = '#fff';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.restore();
  }
}
