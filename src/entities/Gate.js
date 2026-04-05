console.log('[Entity] Gate loaded');

import { State } from '../core/State.js';

const GATE_COLORS = {
  '+': '#22c55e',
  '-': '#ef4444',
  '*': '#3b82f6',
  '/': '#f97316',
};

const debug = true;
let _drawFrame = 0;

export class Gate {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.w = config.w;
    this.h = config.h || 40;
    this.type = config.type;
    this.value = config.value;
    this.passed = false;
    this.speed = 150;
    this.pillarWidth = 10;
    this.lanes = config.lanes || 0;
    this.flashTimer = 0;
  }

  get effectZone() {
    return { x: this.x + this.pillarWidth, w: this.w - 2 * this.pillarWidth };
  }

  getColor() {
    return GATE_COLORS[this.type] || '#888';
  }

  update(dt) {
    this.y += this.speed * dt;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.h;
  }

  draw(ctx, canvasH) {
    if (this.y > canvasH + this.h) return;

    _drawFrame++;
    if (debug && _drawFrame % 60 === 0) {
      console.log('[RENDER] Drawing gate:', this.type, 'y:', this.y.toFixed(1), 'passed:', this.passed);
    }

    const pillarW = this.pillarWidth;
    const effColor = this.flashTimer > 0 ? '#ffffff' : this.getColor();

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(this.x, this.y, pillarW, this.h);
    ctx.fillRect(this.x + this.w - pillarW, this.y, pillarW, this.h);

    ctx.fillStyle = effColor;
    ctx.fillRect(this.x + pillarW, this.y, this.w - pillarW * 2, this.h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.type}${this.value}`, this.x + this.w / 2, this.y + this.h / 2);
  }

  checkCollision(playerX, playerY, playerRadius) {
    if (this.passed) return false;

    if (playerY - playerRadius > this.y + this.h) return false;
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
