console.log('[Core] LevelGenerator loaded');

export class LevelGenerator {
  constructor(levelNum) {
    this.levelNum = levelNum;
    this.totalGates = 10 + levelNum * 3;
    this.totalEnemies = 5 + levelNum * 2;
    this.gatesSpawned = 0;
    this.enemiesSpawned = 0;
    this.gateSpawnInterval = 1.2;
    this.enemySpawnInterval = 2.5;
    this.gateTimer = 0;
    this.enemyTimer = 0.5;
    this.finished = false;
  }

  get progress() {
    const total = this.totalGates + this.totalEnemies;
    const spawned = this.gatesSpawned + this.enemiesSpawned;
    return Math.min(spawned / total, 1);
  }

  update(dt, canvasWidth) {
    if (this.finished) return [];

    this.gateTimer += dt;
    this.enemyTimer += dt;

    const spawned = [];

    if (this.gatesSpawned < this.totalGates && this.gateTimer >= this.gateSpawnInterval) {
      this.gateTimer = 0;
      spawned.push({ type: 'gate', ...this._spawnGate(canvasWidth) });
    }

    if (this.enemiesSpawned < this.totalEnemies && this.enemyTimer >= this.enemySpawnInterval) {
      this.enemyTimer = 0;
      spawned.push({ type: 'enemy', ...this._spawnEnemy(canvasWidth) });
    }

    if (this.gatesSpawned >= this.totalGates && this.enemiesSpawned >= this.totalEnemies) {
      this.finished = true;
    }

    return spawned;
  }

  _spawnGate(canvasWidth) {
    this.gatesSpawned++;
    const gateWidth = 120 + Math.random() * 60;
    const gateHeight = 35;
    const pillarWidth = 18;
    const x = 20 + Math.random() * (canvasWidth - gateWidth - 40);
    const y = -gateHeight;
    const value = Math.random() > 0.4 ? 1 : -1;
    const fallSpeed = 100 + Math.random() * 40;

    return { x, y, width: gateWidth, height: gateHeight, pillarWidth, effectValue: value, fallSpeed };
  }

  _spawnEnemy(canvasWidth) {
    this.enemiesSpawned++;
    const size = 15;
    const x = size + Math.random() * (canvasWidth - 2 * size);
    const y = -size;
    const hp = 1 + Math.floor(Math.random() * 2);
    const damage = 1 + Math.floor(Math.random() * 2);
    const fallSpeed = 80 + Math.random() * 40;
    const horizontalSpeed = 15 + Math.random() * 25;

    return { x, y, hp, damage, fallSpeed, horizontalSpeed, size };
  }
}
