console.log('[Scene] ConfirmScene loaded');

import { GameScene } from './GameScene.js';
import { State } from '../core/State.js';

export class ConfirmScene {
  constructor(sceneManager, loop, levelNum) {
    this.name = 'ConfirmScene';
    this.sm = sceneManager;
    this.loop = loop;
    this.levelNum = levelNum;
    this.buttons = [];
  }

  onEnter() {
    this._buildUI();
  }

  _buildUI() {
    const w = this.loop.width;
    const h = this.loop.height;
    const btnW = Math.min(200, w * 0.45);
    const btnH = 50;
    const gap = 16;
    const totalH = btnH * 2 + gap;
    const startY = h * 0.5;

    this.buttons = [
      {
        x: w / 2 - btnW / 2, y: startY,
        w: btnW, h: btnH, label: '▶  СТАРТ',
        color: '#0f0', action: () => this._startGame(),
      },
      {
        x: w / 2 - btnW / 2, y: startY + btnH + gap,
        w: btnW, h: btnH, label: '←  НАЗАД',
        color: '#888', action: () => this.sm.pop(),
      },
    ];
  }

  _startGame() {
    State.resetForGame();
    State.selectedLevel = this.levelNum;
    this.sm.replace(new GameScene(this.sm, this.loop, this.levelNum));
  }

  update(dt) {}

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    ctx.fillStyle = '#333';
    const boxW = Math.min(300, w * 0.7);
    const boxH = 200;
    const bx = w / 2 - boxW / 2;
    const by = h * 0.2;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(24, w * 0.05)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`УРОВЕНЬ ${this.levelNum}`, w / 2, by + 40);

    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.min(14, w * 0.028)}px monospace`;
    ctx.fillText('Ворота: + - * /  (изменяют юниты)', w / 2, by + 80);
    ctx.fillText('Уклоняйтесь от врагов-блоков!', w / 2, by + 100);
    ctx.fillText('Все операции округляются вниз', w / 2, by + 120);

    for (const btn of this.buttons) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.fillStyle = btn.color;
      ctx.font = `bold ${Math.min(18, btn.h * 0.38)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

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
