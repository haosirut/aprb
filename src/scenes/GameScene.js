console.log('[Scene] GameScene loaded');

import { State, applyGateMath } from '../core/State.js';
import { Spawner } from '../core/Spawner.js';
import { Player } from '../entities/Player.js';
import { Gate } from '../entities/Gate.js';
import { Enemy } from '../entities/Enemy.js';
import { ResultScene } from './ResultScene.js';

export class GameScene {
  constructor(sceneManager, loop) {
    this.name = 'GameScene';
    this.sm = sceneManager;
    this.loop = loop;

    const w = loop.width;
    const h = loop.height;

    this.player = new Player(w, h);
    this.spawner = new Spawner();
    this.gates = [];
    this.enemies = [];

    this.finished = false;
    this.touching = false;
    this.touchZoneRatio = 0.15;
  }

  onEnter() {
    console.log('[Core] GameScene entered (infinite mode)');
  }

  onResize(w, h) {
    this.player.onResize(w, h);
  }

  update(dt) {
    if (this.finished) return;

    const w = this.loop.width;
    const h = this.loop.height;
    const speedMul = this.spawner.speedMultiplier;

    const spawned = this.spawner.update(dt, w);
    for (const s of spawned) {
      if (s instanceof Gate) {
        this.gates.push(s);
      } else if (s.type === 'enemy') {
        const enemy = new Enemy(
          s.x, s.y, s.width, s.height, s.rows, s.cols,
          s.cubeSize, s.squares, s.totalHP, s.activeSquares, s.fallSpeed,
        );
        this.enemies.push(enemy);
      }
    }

    // Update & collide gates
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      gate.update(dt);
      gate.speed = 150 * speedMul;
      if (gate.isOffScreen(h)) {
        this.gates.splice(i, 1);
        continue;
      }
      if (gate.checkCollision(this.player.centerX, this.player.centerY, this.player.width / 2)) {
        State.playerUnits = applyGateMath(State.playerUnits, gate.type, gate.value);
        this.player.setUnits(State.playerUnits);
        State.gatesPassed++;
        if (State.playerUnits <= 0) {
          this._checkDefeat();
        }
      }
    }

    // Update & collide enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, w, h, speedMul);
      if (enemy.isOffScreen(h)) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (!enemy.alive) {
        this.enemies.splice(i, 1);
        continue;
      }
      const hit = enemy.checkPlayerCollision(this.player.x, this.player.y, this.player.width, this.player.height);
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
        if (State.playerUnits <= 0) {
          this._checkDefeat();
        }
      }
    }

    this.player.update(dt, w, h);
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

  render(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (const gate of this.gates) {
      gate.draw(ctx, h);
    }

    for (const enemy of this.enemies) {
      enemy.render(ctx, w, h);
    }

    this.player.render(ctx);

    this._renderHUD(ctx, w, h);
  }

  _renderHUD(ctx) {
    ctx.save();

    ctx.fillStyle = '#000';
    ctx.fillRect(10, 10, 140, 30);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 140, 30);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP: ${Math.floor(State.playerUnits)}`, 16, 25);

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
      this.player.targetX = x - this.player.width / 2;
    }
  }
}
