console.log('[Entity] Player loaded');

export class Player {
  constructor(canvasWidth, canvasHeight, units) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.units = units;
    this.targetX = canvasWidth / 2;
    this.x = canvasWidth / 2;
    this.y = canvasHeight * 0.95;
    this.padding = 10;
    this.size = this._calcSize();
    this.flashTimer = 0;
  }

  _calcSize() {
    return 20 + this.units * 2;
  }

  get radius() {
    return this.size / 2;
  }

  setUnits(val) {
    this.units = Math.max(0, val);
    this.flashTimer = 0.15;
  }

  update(dt, canvasWidth) {
    this.canvasWidth = canvasWidth;
    const lerpSpeed = 12;
    this.x += (this.targetX - this.x) * lerpSpeed * dt;
    const minX = this.radius + this.padding;
    const maxX = canvasWidth - this.radius - this.padding;
    this.x = Math.max(minX, Math.min(maxX, this.x));

    const targetSize = this._calcSize();
    this.size += (targetSize - this.size) * 8 * dt;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  onResize(newWidth, newHeight) {
    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;
    this.y = newHeight * 0.95;
    const minX = this.radius + this.padding;
    const maxX = newWidth - this.radius - this.padding;
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.targetX = this.x;
  }

  render(ctx) {
    ctx.save();
    const alpha = this.flashTimer > 0 ? 0.5 + 0.5 * Math.sin(this.flashTimer * 30) : 1;
    ctx.globalAlpha = alpha;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.max(10, this.size / 3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.units, this.x, this.y);

    ctx.restore();
  }
}
