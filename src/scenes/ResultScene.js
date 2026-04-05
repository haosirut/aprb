console.log('[Scene] ResultScene loaded');

import { State } from '../core/State.js';
import { MenuScene } from './MenuScene.js';

export class ResultScene {
  constructor(sceneManager, loop) {
    this.name = 'ResultScene';
    this.sm = sceneManager;
    this.loop = loop;
    this.buttons = [];
  }

  onEnter() {
    this._buildUI();
  }

  _buildUI() {
    const w = this.loop.width;
    const h = this.loop.height;
    const btnW = Math.min(240, w * 0.55);
    const btnH = 50;
    const startY = h * 0.6;

    this.buttons = [
      {
        x: w / 2 - btnW / 2, y: startY,
        w: btnW, h: btnH, label: 'В МЕНЮ',
        color: '#888', action: () => this._goMenu(),
      },
    ];
  }

  _goMenu() {
    State.reset();
    this.sm.clearAndPush(new MenuScene(this.sm, this.loop));
  }

  update(dt) {}

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    const boxW = Math.min(300, w * 0.7);
    const boxH = 160;
    const bx = w / 2 - boxW / 2;
    const by = h * 0.15;

    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#f00';
    ctx.font = `bold ${Math.min(40, w * 0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ПОРАЖЕНИЕ', w / 2, by + 45);

    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.min(16, w * 0.03)}px monospace`;
    ctx.fillText('Все юниты потеряны', w / 2, by + 90);
    ctx.fillText(`Осталось HP: ${Math.floor(State.playerUnits)}`, w / 2, by + 115);

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
