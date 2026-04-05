console.log('[Scene] LevelSelectScene loaded');

import { ConfirmScene } from './ConfirmScene.js';

export class LevelSelectScene {
  constructor(sceneManager, loop) {
    this.name = 'LevelSelectScene';
    this.sm = sceneManager;
    this.loop = loop;
    this.buttons = [];
    this.backBtn = null;
  }

  onEnter() {
    this._buildGrid();
  }

  _buildGrid() {
    const w = this.loop.width;
    const h = this.loop.height;
    const cols = 5;
    const rows = 2;
    const cellSize = Math.min(60, (w - 40) / cols);
    const totalW = cols * cellSize + (cols - 1) * 8;
    const totalH = rows * cellSize + (rows - 1) * 8;
    const startX = (w - totalW) / 2;
    const startY = h * 0.3;

    this.buttons = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const levelNum = r * cols + c + 1;
        const bx = startX + c * (cellSize + 8);
        const by = startY + r * (cellSize + 8);
        const active = levelNum === 1;
        this.buttons.push({
          x: bx, y: by, w: cellSize, h: cellSize,
          label: `${levelNum}`,
          active: active,
          action: active ? () => this._goConfirm(levelNum) : null,
        });
      }
    }

    const btnW = Math.min(160, w * 0.4);
    const btnH = 44;
    this.backBtn = { x: w / 2 - btnW / 2, y: h * 0.78, w: btnW, h: btnH, label: '← НАЗАД', action: () => this.sm.pop() };
  }

  _goConfirm(levelNum) {
    this.sm.push(new ConfirmScene(this.sm, this.loop, levelNum));
  }

  update(dt) {}

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(32, w * 0.06)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ВЫБОР УРОВНЯ', w / 2, h * 0.15);

    for (const btn of this.buttons) {
      if (btn.active) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
        ctx.fillStyle = '#0f0';
      } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
        ctx.fillStyle = '#333';
      }
      ctx.font = `bold ${Math.min(20, btn.w * 0.35)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    const back = this.backBtn;
    if (back) {
      ctx.fillStyle = '#222';
      ctx.fillRect(back.x, back.y, back.w, back.h);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(back.x, back.y, back.w, back.h);
      ctx.fillStyle = '#888';
      ctx.font = `bold ${Math.min(16, back.h * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(back.label, back.x + back.w / 2, back.y + back.h / 2);
    }

    ctx.restore();
  }

  onPointerDown(x, y) {
    if (this.backBtn && _hitTest(x, y, this.backBtn)) {
      this.backBtn.action();
      return true;
    }
    for (const btn of this.buttons) {
      if (btn.active && _hitTest(x, y, btn)) {
        btn.action();
        return true;
      }
    }
    return false;
  }

  onPointerMove() {}
  onPointerUp() {}
}

function _hitTest(x, y, btn) {
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}
