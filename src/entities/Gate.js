console.log('[Entity] Gate loaded');

import { State } from '../core/State.js';

const GATE_COLORS = {
  '+': '#22c55e',
  '-': '#ef4444',
  '*': '#3b82f6',
  '/': '#f97316',
};

export class Gate {
  constructor(x, y, width, height, pillarWidth, type, value, fallSpeed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pillarWidth = pillarWidth;
    this.type = type;
    this.value = value;
    this.speed = fallSpeed;
    this.passed = false;
    this.flashTimer = 0;
  }

  get effectZone() {
    return { x: this.x + this.pillarWidth, w: this.width - 2 * this.pillarWidth };
  }

  update(dt) {
    this.y += this.speed * dt;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.height;
  }

  render(ctx, _canvasW, canvasH) {
    if (this.y < -this.height - 50 || this.y > canvasH + this.height + 50) return;

    ctx.save();

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(this.x, this.y, this.pillarWidth, this.height);
    ctx.fillRect(this.x + this.width - this.pillarWidth, this.y, this.pillarWidth, this.height);

    const baseColor = GATE_COLORS[this.type] || '#888';
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : baseColor;
    ctx.fillRect(this.x + this.pillarWidth, this.y, this.width - 2 * this.pillarWidth, this.height);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ez = this.effectZone;
    const centerX = ez.x + ez.w / 2;
    ctx.fillText(`${this.type}${this.value}`, centerX, this.y + this.height / 2);

    ctx.restore();
  }

  checkCollision(playerX, playerY, playerRadius) {
    if (this.passed) return false;

    if (playerY - playerRadius > this.y + this.height) return false;
    if (playerY + playerRadius < this.y) return false;

    const ez = this.effectZone;
    if (playerX > ez.x && playerX < ez.x + ez.w) {
      this.passed = true;
      this.flashTimer = 0.15;

      State.gateHistory.push({ type: this.type, value: this.value });
      if (State.gateHistory.length > 2) State.gateHistory.shift();

      return true;
    }

    return false;
  }
}
