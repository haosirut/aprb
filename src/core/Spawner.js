console.log('[Core] Spawner loaded');

import { State, calculateEnemyHP } from './State.js';
import { Gate } from '../entities/Gate.js';

const TOTAL_LANES = 5;
const CUBES_PER_LANE = 5;
const FIXED_GAP = 160;
const BASE_SPEED = 150;
const GATE_HEIGHT = 40;
const SPAWN_CYCLE = ['GATE_PAIR', 'GATE_PAIR', 'ENEMY'];
const ROW_PROBS = [1.0, 0.9, 0.8, 0.7, 0.6];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Spawner {
  constructor() {
    this.cycleIndex = 0;
    this.timer = 0;
    this.firstSpawnDone = false;
    this.nextSpawnY = -GATE_HEIGHT;
    this.spawnCounter = 0;
  }

  get speedMultiplier() {
    return Math.pow(1.03, this.spawnCounter);
  }

  update(dt, canvasWidth) {
    const spawned = [];
    const spawnInterval = FIXED_GAP / (BASE_SPEED * this.speedMultiplier);

    if (!this.firstSpawnDone) {
      this.firstSpawnDone = true;
      const first = this._spawnStep(canvasWidth);
      for (const s of first) {
        spawned.push(s);
      }
      this.cycleIndex = (this.cycleIndex + 1) % SPAWN_CYCLE.length;
    }

    this.timer += dt;

    while (this.timer >= spawnInterval) {
      this.timer -= spawnInterval;
      const step = this._spawnStep(canvasWidth);
      for (const s of step) {
        spawned.push(s);
      }
      this.cycleIndex = (this.cycleIndex + 1) % SPAWN_CYCLE.length;
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
    const lanePx = canvasWidth / TOTAL_LANES;

    const type1 = Math.random() < 0.5 ? '-' : '/';
    const val1 = type1 === '-' ? randomInt(2, 100) : randomInt(2, 10);
    const w1 = randomInt(1, TOTAL_LANES - 1);
    const maxPos1 = TOTAL_LANES - w1 + 1;
    const pos1 = randomInt(1, maxPos1);

    const occupied1 = [];
    for (let i = pos1; i <= pos1 + w1 - 1; i++) occupied1.push(i);
    const freeLanes = [1, 2, 3, 4, 5].filter(l => !occupied1.includes(l));

    const segments = [];
    let curr = [freeLanes[0]];
    for (let i = 1; i < freeLanes.length; i++) {
      if (freeLanes[i] === freeLanes[i - 1] + 1) {
        curr.push(freeLanes[i]);
      } else {
        segments.push(curr);
        curr = [freeLanes[i]];
      }
    }
    segments.push(curr);

    const segIdx = randomInt(0, segments.length - 1);
    const seg = segments[segIdx];
    const maxW2 = seg.length;
    const w2 = randomInt(1, maxW2);
    const offsetInSeg = randomInt(0, maxW2 - w2);
    const pos2 = seg[offsetInSeg];

    const type2 = Math.random() < 0.5 ? '+' : '*';
    const val2 = type2 === '+' ? randomInt(2, 100) : randomInt(2, 10);

    const gate1 = new Gate({
      x: (pos1 - 1) * lanePx,
      y: this.nextSpawnY,
      w: w1 * lanePx,
      h: GATE_HEIGHT,
      type: type1,
      value: val1,
      lanes: w1,
    });

    const gate2 = new Gate({
      x: (pos2 - 1) * lanePx,
      y: this.nextSpawnY,
      w: w2 * lanePx,
      h: GATE_HEIGHT,
      type: type2,
      value: val2,
      lanes: w2,
    });

    State.totalGates += 2;

    this.nextSpawnY -= (GATE_HEIGHT + FIXED_GAP);

    return [gate1, gate2];
  }

  _spawnEnemy(canvasWidth) {
    const lanePx = canvasWidth / TOTAL_LANES;
    const widthLanes = randomInt(1, TOTAL_LANES);
    const maxStartPos = TOTAL_LANES + 1 - widthLanes;
    const startLane = randomInt(1, maxStartPos);

    const gridCols = widthLanes * CUBES_PER_LANE;
    const gridRows = 5;
    const cubeSize = lanePx / CUBES_PER_LANE;

    const totalWidth = gridCols * cubeSize;
    const totalHeight = gridRows * cubeSize;

    const x = (startLane - 1) * lanePx;
    const y = this.nextSpawnY;

    const grid = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = [];
      for (let c = 0; c < gridCols; c++) {
        if (r === 0) {
          grid[r][c] = true;
        } else if (!grid[r - 1][c]) {
          grid[r][c] = false;
        } else {
          grid[r][c] = Math.random() < ROW_PROBS[r];
        }
      }
    }

    const totalHP = calculateEnemyHP(State.playerUnits, State.gateHistory);

    let activeCount = 0;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (grid[r][c]) activeCount++;
      }
    }

    const baseHP = activeCount > 0 ? totalHP / activeCount : 1;

    const squares = [];
    for (let r = 0; r < gridRows; r++) {
      squares[r] = [];
      for (let c = 0; c < gridCols; c++) {
        if (grid[r][c]) {
          squares[r][c] = { active: true, hp: Math.max(1, Math.floor(baseHP)) };
        } else {
          squares[r][c] = { active: false, hp: 0 };
        }
      }
    }

    this.nextSpawnY -= (totalHeight + FIXED_GAP);
    this.spawnCounter++;

    return {
      type: 'enemy', x, y, width: totalWidth, height: totalHeight,
      rows: gridRows, cols: gridCols, cubeSize, squares,
      totalHP, displayedHP: totalHP,
      activeSquares: activeCount,
      fallSpeed: BASE_SPEED,
    };
  }
}
