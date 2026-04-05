console.log('[Scene] MenuScene loaded');

import { GameScene } from './GameScene.js';
import { State } from '../core/State.js';

export class MenuScene {
  constructor(sceneManager, loop) {
    this.name = 'MenuScene';
    this.sm = sceneManager;
    this.loop = loop;
    this.buttons = [];
  }

  onEnter() {
    this._buildButtons();
  }

  _buildButtons() {
    const w = this.loop.width;
    const h = this.loop.height;
    const btnW = Math.min(260, w * 0.6);
    const btnH = 60;
    const cx = w / 2 - btnW / 2;
    this.buttons = [
      { x: cx, y: h / 2, w: btnW, h: btnH, label: '▶  ИГРАТЬ', action: () => this._startGame() },
    ];
  }

  _startGame() {
    State.resetForGame();
    this.sm.push(new GameScene(this.sm, this.loop));
  }

  update(dt) {}

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(48, w * 0.08)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GATE RUNNER', w / 2, h * 0.25);

    ctx.fillStyle = '#666';
    ctx.font = `${Math.min(16, w * 0.03)}px monospace`;
    ctx.fillText('Infinite Edition', w / 2, h * 0.25 + Math.min(48, w * 0.08) + 10);

    for (const btn of this.buttons) {
      ctx.fillStyle = '#222';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      ctx.fillStyle = '#0f0';
      ctx.font = `bold ${Math.min(22, btn.h * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    ctx.fillStyle = '#444';
    ctx.font = `${Math.min(12, w * 0.025)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Touch to control \u2022 Survive the gates!', w / 2, h * 0.88);

    ctx.restore();
  }

  onPointerDown(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.action();
        return true;
      }
    }
    return false;
  }

  onPointerMove() {}
  onPointerUp() {}
}
