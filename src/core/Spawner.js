console.log('[Core] Spawner loaded');

import { State, calculateEnemyHP } from './State.js';
import { Gate } from '../entities/Gate.js';

const TOTAL_LANES = 5;
const CUBES_PER_LANE = 5;
const FIXED_GAP = 160;
const FALL_SPEED = 150;
const GATE_HEIGHT = 40;
const SPAWN_CYCLE = ['GATE_PAIR', 'GATE_PAIR', 'ENEMY'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    const lanePx = canvasWidth / TOTAL_LANES;

    // 1. First gate: type (- or /)
    const type1 = Math.random() < 0.5 ? '-' : '/';
    const val1 = type1 === '-' ? randomInt(2, 100) : randomInt(2, 10);
    const w1 = randomInt(1, TOTAL_LANES - 1);
    const p1 = randomInt(1, TOTAL_LANES - w1 + 1); // 1-based start lane

    // 2. Find free lanes (1-based)
    const freeLanes = [];
    for (let i = 1; i <= TOTAL_LANES; i++) {
      if (i < p1 || i > p1 + w1 - 1) {
        freeLanes.push(i);
      }
    }

    // 3. Split free lanes into continuous segments
    const segments = [[freeLanes[0]]];
    for (let i = 1; i < freeLanes.length; i++) {
      if (freeLanes[i] === freeLanes[i - 1] + 1) {
        segments[segments.length - 1].push(freeLanes[i]);
      } else {
        segments.push([freeLanes[i]]);
      }
    }

    // 4. Second gate: type (+ or *), placed in a random segment
    const segIndex = randomInt(0, segments.length - 1);
    const seg = segments[segIndex];
    const maxW2 = seg.length;
    const w2 = randomInt(1, maxW2);
    const offsetInSeg = randomInt(0, maxW2 - w2);
    const p2 = seg[offsetInSeg]; // 1-based start lane

    const type2 = Math.random() < 0.5 ? '+' : '*';
    const val2 = type2 === '+' ? randomInt(2, 100) : randomInt(2, 10);

    // 5. Create Gate instances
    const gate1 = new Gate({
      x: (p1 - 1) * lanePx,
      y: this.nextSpawnY,
      w: w1 * lanePx,
      h: GATE_HEIGHT,
      type: type1,
      value: val1,
      lanes: w1,
    });

    const gate2 = new Gate({
      x: (p2 - 1) * lanePx,
      y: this.nextSpawnY,
      w: w2 * lanePx,
      h: GATE_HEIGHT,
      type: type2,
      value: val2,
      lanes: w2,
    });

    State.totalGates += 2;

    console.log('[SPAWN] Created gates:', {
      x1: gate1.x, y1: gate1.y, type1: gate1.type, val1: gate1.value, lanes1: w1,
      x2: gate2.x, y2: gate2.y, type2: gate2.type, val2: gate2.value, lanes2: w2,
    });

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

    // Fill grid: top row always full, gravity-based below
    const grid = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = [];
      for (let c = 0; c < gridCols; c++) {
        if (r === 0) {
          grid[r][c] = true;
        } else if (!grid[r - 1][c]) {
          grid[r][c] = false;
        } else {
          grid[r][c] = Math.random() < 0.5;
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

    console.log(`[SPAWN] Created enemy: lanes=${widthLanes} startLane=${startLane} cols=${gridCols} rows=${gridRows} hp=${totalHP} y=${y}`);

    return {
      type: 'enemy', x, y, width: totalWidth, height: totalHeight,
      rows: gridRows, cols: gridCols, cubeSize, squares,
      totalHP, displayedHP: totalHP,
      activeSquares: activeCount,
      fallSpeed: FALL_SPEED,
    };
  }
}
