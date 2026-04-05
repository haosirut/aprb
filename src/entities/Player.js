console.log('[Entity] Player loaded');

export class Player {
  constructor(x, y, units) {
    this.x = x;
    this.y = y;
    this.units = units;
    this.targetX = x;
    this.size = this._calcSize();
    this.padding = 15;
    this.flashTimer = 0;
  }

  _calcSize() {
    return 20 + this.units * 2;
  }

  setUnits(val) {
    this.units = Math.max(0, val);
    this.flashTimer = 0.15;
  }

  update(dt, width) {
    const lerpSpeed = 12;
    this.x += (this.targetX - this.x) * lerpSpeed * dt;
    this.x = Math.max(this.padding + this.size / 2, Math.min(width - this.padding - this.size / 2, this.x));

    const targetSize = this._calcSize();
    this.size += (targetSize - this.size) * 8 * dt;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  render(ctx) {
    ctx.save();
    const alpha = this.flashTimer > 0 ? 0.5 + 0.5 * Math.sin(this.flashTimer * 30) : 1;
    ctx.globalAlpha = alpha;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.max(10, this.size / 3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.units, this.x, this.y);

    ctx.restore();
  }
}
