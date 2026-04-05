console.log('[Core] Spawner loaded');

import { State } from './State.js';

const GATE_TYPES = ['+', '-', '*', '/'];
const FIXED_GAP = 180;
const FALL_SPEED = 120;
const SEQUENCE = ['gate_pair', 'gate_pair', 'enemy'];

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
    this.stepIndex = 0;
    this.timer = 0;
    this.spawnInterval = FIXED_GAP / FALL_SPEED;
    this.finished = false;
    this.totalSteps = 15 + levelNum * 5;
    this.stepsCompleted = 0;
  }

  get progress() {
    return Math.min(this.stepsCompleted / this.totalSteps, 1);
  }

  update(dt, canvasWidth) {
    if (this.finished) return [];

    this.timer += dt;
    const spawned = [];

    while (this.timer >= this.spawnInterval && this.stepsCompleted < this.totalSteps) {
      this.timer -= this.spawnInterval;
      const stepType = SEQUENCE[this.stepIndex % SEQUENCE.length];

      if (stepType === 'gate_pair') {
        const pair = this._spawnGatePair(canvasWidth);
        for (const g of pair) spawned.push({ type: 'gate', ...g });
        State.totalGates += 2;
      } else if (stepType === 'enemy') {
        spawned.push({ type: 'enemy', ...this._spawnEnemy(canvasWidth) });
      }

      this.stepIndex++;
      this.stepsCompleted++;
    }

    if (this.stepsCompleted >= this.totalSteps) {
      this.finished = true;
    }

    return spawned;
  }

  _spawnGatePair(canvasWidth) {
    const laneWidth = canvasWidth / 5;
    const w1 = randomInt(1, 4);
    const w2 = 5 - w1;
    const maxOffset = Math.max(0, canvasWidth - (w1 + w2) * laneWidth);
    const offsetX = randomInt(0, Math.floor(maxOffset));
    const x1 = offsetX;
    const x2 = offsetX + w1 * laneWidth;

    const type1 = randomGateType();
    const type2 = randomGateType();
    const value1 = randomGateValue(type1);
    const value2 = randomGateValue(type2);

    const gateHeight = 35;
    const y = -gateHeight;

    return [
      { x: x1, y, width: w1 * laneWidth, height: gateHeight, pillarWidth: 12, type: type1, value: value1, fallSpeed: FALL_SPEED },
      { x: x2, y, width: w2 * laneWidth, height: gateHeight, pillarWidth: 12, type: type2, value: value2, fallSpeed: FALL_SPEED },
    ];
  }

  _spawnEnemy(canvasWidth) {
    const laneWidth = canvasWidth / 5;
    const widthLanes = randomInt(1, 5);
    const squareSize = laneWidth - 6;
    const rows = 5;
    const cols = widthLanes;

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

    const totalWidth = widthLanes * laneWidth;
    const x = randomInt(0, Math.max(0, Math.floor(canvasWidth - totalWidth)));
    const totalHeight = rows * squareSize;
    const y = -totalHeight;

    const baseHP = State.playerUnits;
    const offset = 20;
    const totalHP = Math.max(10, Math.floor(baseHP + offset));

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

    return {
      x, y, width: totalWidth, height: totalHeight,
      rows, cols, squareSize, squares,
      totalHP, displayedHP: totalHP,
      activeSquares: activeCount,
      laneWidth, fallSpeed: FALL_SPEED,
    };
  }
}
