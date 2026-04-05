console.log('[Scene] GameScene loaded');

import { State } from '../core/State.js';
import { generateLevel } from '../core/LevelGenerator.js';
import { Player } from '../entities/Player.js';
import { Gate } from '../entities/Gate.js';
import { Enemy } from '../entities/Enemy.js';
import { Bullet } from '../entities/Bullet.js';
import { ResultScene } from './ResultScene.js';

export class GameScene {
  constructor(sceneManager, loop, levelNum) {
    this.name = 'GameScene';
    this.sm = sceneManager;
    this.loop = loop;
    this.levelNum = levelNum;

    const levelData = generateLevel(levelNum);
    this.levelLength = levelData.length;
    this.scrollSpeed = 120;

    this.player = new Player(loop.width / 2, loop.height * 0.8, State.units);
    this.cameraY = 0;

    this.gates = levelData.objects
      .filter(o => o.type === 'gate')
      .map(o => new Gate(o.x, o.y, o.gapWidth, o.value, loop.width));

    this.enemies = levelData.objects
      .filter(o => o.type === 'enemy')
      .map(o => new Enemy(o.x, o.y, o.hp, o.damage, o.speed, o.size));

    this.bullets = [];
    this.shootTimer = 0;
    this.shootInterval = 0.4;
    this.finished = false;
    this.touching = false;
  }

  onEnter() {
    console.log(`[Core] GameScene entered for level ${this.levelNum}`);
  }

  update(dt) {
    if (this.finished) return;

    const w = this.loop.width;
    const h = this.loop.height;

    this.cameraY += this.scrollSpeed * dt;
    const progress = this.cameraY / this.levelLength;
    State.levelProgress = Math.min(progress, 1);

    this.player.update(dt, w);

    // Gates are in world-space; only camera moves, gates stay at their generated y
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      if (gate.y < this.cameraY - 100) {
        this.gates.splice(i, 1);
        continue;
      }
      if (!gate.passed) {
        const result = gate.checkCollision(this.player.x, this.player.y, this.player.size / 2, this.cameraY);
        if (result === 'pass') {
          this.player.setUnits(this.player.units + gate.value);
          State.units = this.player.units;
          this._checkDefeat();
        } else if (result === 'wall') {
          this.player.setUnits(this.player.units - 1);
          State.units = this.player.units;
          this._checkDefeat();
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, w);
      if (enemy.y < this.cameraY - 100) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (enemy.checkCollision(this.player.x, this.player.y, this.player.size / 2, this.cameraY)) {
        this.player.setUnits(this.player.units - enemy.damage);
        State.units = this.player.units;
        enemy.alive = false;
        this.enemies.splice(i, 1);
        this._checkDefeat();
      }
    }

    this.shootTimer += dt;
    const hasEnemiesOnScreen = this.enemies.some(e => {
      const screenY = e.y - this.cameraY;
      return screenY > 0 && screenY < h;
    });
    if (this.shootTimer >= this.shootInterval && hasEnemiesOnScreen) {
      this.shootTimer = 0;
      // Bullet world-y = cameraY + player screen-y - player radius
      const worldY = this.cameraY + this.player.y - this.player.size / 2;
      this.bullets.push(new Bullet(this.player.x, worldY));
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(dt);
      if (!bullet.alive) {
        this.bullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (bullet.checkCollision(this.enemies[j])) {
          bullet.alive = false;
          this.bullets.splice(i, 1);
          this.enemies[j].hit();
          if (!this.enemies[j].alive) {
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    if (State.levelProgress >= 1) {
      this._checkVictory();
    }
  }

  _checkDefeat() {
    if (this.player.units <= 0) {
      this.finished = true;
      State.gameState = 'lost';
      State.lastResult = 'lost';
      State.units = 0;
      setTimeout(() => {
        this.sm.replace(new ResultScene(this.sm, this.loop));
      }, 500);
    }
  }

  _checkVictory() {
    if (!this.finished) {
      this.finished = true;
      State.gameState = 'won';
      State.lastResult = 'won';
      setTimeout(() => {
        this.sm.replace(new ResultScene(this.sm, this.loop));
      }, 500);
    }
  }

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (const gate of this.gates) {
      gate.render(ctx, this.cameraY, w, h);
    }

    for (const enemy of this.enemies) {
      enemy.render(ctx, this.cameraY, w, h);
    }

    for (const bullet of this.bullets) {
      bullet.render(ctx, this.cameraY, w, h);
    }

    this.player.render(ctx);

    this._renderHUD(ctx, w, h);
  }

  _renderHUD(ctx, w, h) {
    ctx.save();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(20, w * 0.04)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Units: ${State.units}`, 16, 16);

    const barW = Math.min(180, w * 0.35);
    const barH = 10;
    const barX = w - barW - 16;
    const barY = 20;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = '#0f0';
    ctx.fillRect(barX, barY, barW * State.levelProgress, barH);

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#888';
    ctx.font = `${Math.min(12, w * 0.025)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(State.levelProgress * 100)}%`, barX + barW / 2, barY + barH + 14);

    ctx.restore();
  }

  onPointerDown(x, y) {
    this.touching = true;
    this.player.targetX = x;
  }

  onPointerMove(x, y) {
    if (this.touching) {
      this.player.targetX = x;
    }
  }

  onPointerUp() {
    this.touching = false;
  }
}
