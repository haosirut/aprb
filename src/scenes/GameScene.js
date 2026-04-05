console.log('[Scene] GameScene loaded');

import { State, applyGateMath } from '../core/State.js';
import { Spawner } from '../core/Spawner.js';
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

    const w = loop.width;
    const h = loop.height;

    this.player = new Player(w, h, State.playerUnits);
    this.spawner = new Spawner(levelNum);
    this.gates = [];
    this.enemies = [];
    this.bullets = [];

    this.shootTimer = 0;
    this.shootInterval = 0.4;
    this.finished = false;
    this.touching = false;
    this.touchZoneRatio = 0.15;
  }

  onEnter() {
    console.log(`[Core] GameScene entered for level ${this.levelNum}`);
  }

  onResize(w, h) {
    this.player.onResize(w, h);
  }

  update(dt) {
    if (this.finished) return;

    const w = this.loop.width;
    const h = this.loop.height;

    // Спавн новых объектов
    const spawned = this.spawner.update(dt, w);
    for (const s of spawned) {
      if (s.type === 'gate') {
        this.gates.push(new Gate(s.x, s.y, s.width, s.height, s.pillarWidth, s.type, s.value, s.fallSpeed));
      } else if (s.type === 'enemy') {
        this.enemies.push(new Enemy(
          s.x, s.y, s.width, s.height, s.rows, s.cols,
          s.squareSize, s.squares, s.totalHP, s.activeSquares, s.laneWidth, s.fallSpeed,
        ));
      }
    }

    // Ворота
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      gate.update(dt);
      if (gate.isOffScreen(h)) {
        this.gates.splice(i, 1);
        continue;
      }
      if (gate.checkCollision(this.player.x, this.player.y, this.player.radius)) {
        State.playerUnits = applyGateMath(State.playerUnits, gate.type, gate.value);
        this.player.setUnits(State.playerUnits);
        State.gatesPassed++;
        if (State.playerUnits <= 0) {
          this._checkDefeat();
        }
      }
    }

    // Враги: обновление + коллизия с игроком
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, w, h);
      if (enemy.isOffScreen(h)) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (!enemy.alive) {
        this.enemies.splice(i, 1);
        continue;
      }
      const hit = enemy.checkPlayerCollision(this.player.x, this.player.y, this.player.radius);
      if (hit) {
        State.playerUnits = Math.max(1, Math.floor(State.playerUnits - Math.floor(hit.hp)));
        this.player.setUnits(State.playerUnits);
        enemy.squares[hit.row][hit.col].active = false;
        enemy.activeSquares--;
        enemy.displayedHP = Math.max(0, enemy.displayedHP - Math.floor(hit.hp));
        if (enemy.activeSquares <= 0) {
          enemy.alive = false;
          this.enemies.splice(i, 1);
        }
        if (State.playerUnits <= 1) {
          this._checkDefeat();
        }
      }
    }

    // Пули
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(dt);
      if (!bullet.alive) {
        this.bullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy.alive) continue;
        const sq = enemy.checkBulletCollision(bullet.x, bullet.y, bullet.radius);
        if (sq) {
          bullet.alive = false;
          this.bullets.splice(i, 1);
          enemy.hitSquare(sq.row, sq.col);
          if (!enemy.alive) {
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Автострельба
    this.shootTimer += dt;
    const hasEnemiesOnScreen = this.enemies.some(e => e.alive && e.y > 0 && e.y < h);
    if (this.shootTimer >= this.shootInterval && hasEnemiesOnScreen) {
      this.shootTimer = 0;
      this.bullets.push(new Bullet(this.player.x, this.player.y - this.player.radius));
    }

    // Игрок
    this.player.update(dt, w);

    // Прогресс
    State.levelProgress = this.spawner.progress;

    // Победа
    if (this.spawner.finished && this.enemies.length === 0 && this.gates.length === 0) {
      this._checkVictory();
    }
  }

  _checkDefeat() {
    if (this.finished) return;
    this.finished = true;
    State.gameState = 'lost';
    State.lastResult = 'lost';
    setTimeout(() => {
      this.sm.replace(new ResultScene(this.sm, this.loop));
    }, 500);
  }

  _checkVictory() {
    if (this.finished) return;
    this.finished = true;
    State.gameState = 'won';
    State.lastResult = 'won';
    setTimeout(() => {
      this.sm.replace(new ResultScene(this.sm, this.loop));
    }, 500);
  }

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (const gate of this.gates) {
      gate.render(ctx, w, h);
    }

    for (const enemy of this.enemies) {
      enemy.render(ctx, w, h);
    }

    for (const bullet of this.bullets) {
      bullet.render(ctx, w, h);
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
    ctx.fillText(`Units: ${State.playerUnits}`, 16, 16);

    const barW = Math.min(180, w * 0.35);
    const barH = 10;
    const barX = w - barW - 16;
    const barY = 20;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = '#22c55e';
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
    this._handleTouch(x, y);
  }

  onPointerMove(x, y) {
    if (this.touching) {
      this._handleTouch(x, y);
    }
  }

  onPointerUp() {
    this.touching = false;
  }

  _handleTouch(x, y) {
    const h = this.loop.height;
    const touchZoneStart = h * (1 - this.touchZoneRatio);
    if (y >= touchZoneStart) {
      this.player.targetX = x;
    }
  }
}
