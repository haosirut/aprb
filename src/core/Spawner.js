console.log('[Core] Spawner loaded');

import { State, calculateEnemyHP } from './State.js';
import { Gate } from '../entities/Gate.js';

const GATE_TYPES = ['+', '-', '*', '/'];
const FIXED_GAP = 160;
const FALL_SPEED = 150;
const SPAWN_CYCLE = ['GATE_PAIR', 'GATE_PAIR', 'ENEMY'];
const CUBE_SIZE = 12;
const GATE_HEIGHT = 40;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomGateType() {
  return GATE_TYPES[randomInt(0, GATE_TYPES.length - 1)];
}

function randomGateValue(type) {
  if (type === '+' || type === '-') return randomInt(2, 100);
  return randomInt(2, 10);
}

export class Spawner {
  constructor(levelNum) {
    this.levelNum = levelNum;
    this.cycleIndex = 0;
    this.timer = 0;
    this.spawnInterval = FIXED_GAP / FALL_SPEED;
    this.finished = false;
    this.totalSteps = 15 + levelNum * 5;
    this.stepsCompleted = 0;
    this.firstSpawnDone = false;
    this.nextSpawnY = -GATE_HEIGHT;
  }

  get progress() {
    return Math.min(this.stepsCompleted / this.totalSteps, 1);
  }

  update(dt, canvasWidth) {
    if (this.finished) return [];

    const spawned = [];

    if (!this.firstSpawnDone) {
      this.firstSpawnDone = true;
      const first = this._spawnStep(canvasWidth);
      for (const s of first) {
        spawned.push(s);
      }
      this.stepsCompleted++;
      this.cycleIndex = (this.cycleIndex + 1) % SPAWN_CYCLE.length;
    }

    this.timer += dt;

    while (this.timer >= this.spawnInterval && this.stepsCompleted < this.totalSteps) {
      this.timer -= this.spawnInterval;
      const step = this._spawnStep(canvasWidth);
      for (const s of step) {
        spawned.push(s);
      }
      this.stepsCompleted++;
      this.cycleIndex = (this.cycleIndex + 1) % SPAWN_CYCLE.length;
    }

    if (this.stepsCompleted >= this.totalSteps) {
      this.finished = true;
    }

    return spawned;
  }

  _spawnStep(canvasWidth) {
    const stepType = SPAWN_CYCLE[this.cycleIndex % SPAWN_CYCLE.length];

    if (stepType === 'GATE_PAIR') {
      return this._spawnGatePair(canvasWidth);
    } else {
      return [this._spawnEnemy(canvasWidth)];
    }
  }

  _spawnGatePair(canvasWidth) {
    const laneWidth = canvasWidth / 5;
    const w1 = randomInt(1, 4);
    const w2 = 5 - w1;
    const maxOffset = Math.max(0, Math.floor(canvasWidth - (w1 + w2) * laneWidth));
    const offsetX = randomInt(0, maxOffset);

    const type1 = randomGateType();
    const type2 = randomGateType();
    const value1 = randomGateValue(type1);
    const value2 = randomGateValue(type2);

    const g1 = new Gate({ x: offsetX, w: w1 * laneWidth, type: type1, value: value1 });
    const g2 = new Gate({ x: offsetX + w1 * laneWidth, w: w2 * laneWidth, type: type2, value: value2 });

    g1.y = g2.y = this.nextSpawnY;

    State.totalGates += 2;

    console.log('[SPAWN] Created gates:', {
      x1: g1.x, y1: g1.y, type1: g1.type, val1: g1.value,
      x2: g2.x, y2: g2.y, type2: g2.type, val2: g2.value,
    });

    this.nextSpawnY -= (GATE_HEIGHT + FIXED_GAP);

    return [g1, g2];
  }

  _spawnEnemy(canvasWidth) {
    const cols = randomInt(5, 25);
    const rows = 5;
    const cubeSize = CUBE_SIZE;

    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          grid[r][c] = true;
        } else if (!grid[r - 1][c]) {
          grid[r][c] = false;
        } else {
          grid[r][c] = Math.random() < 0.5;
        }
      }
    }

    const totalWidth = cols * cubeSize;
    const totalHeight = rows * cubeSize;
    const x = randomInt(0, Math.max(0, Math.floor(canvasWidth - totalWidth)));
    const y = this.nextSpawnY;

    const totalHP = calculateEnemyHP(State.playerUnits, State.gateHistory);

    let activeCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) activeCount++;
      }
    }

    const hpPerSquare = activeCount > 0 ? Math.floor(totalHP / activeCount) : 1;

    const squares = [];
    for (let r = 0; r < rows; r++) {
      squares[r] = [];
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) {
          squares[r][c] = { active: true, hp: hpPerSquare };
        } else {
          squares[r][c] = { active: false, hp: 0 };
        }
      }
    }

    this.nextSpawnY -= (totalHeight + FIXED_GAP);

    console.log(`[SPAWN] Created enemy: cols=${cols} rows=${rows} hp=${totalHP} y=${y}`);

    return {
      type: 'enemy', x, y, width: totalWidth, height: totalHeight,
      rows, cols, cubeSize, squares,
      totalHP, displayedHP: totalHP,
      activeSquares: activeCount,
      fallSpeed: FALL_SPEED,
    };
  }
}
