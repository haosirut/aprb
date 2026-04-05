console.log('[Entity] Enemy loaded');

const ROW_PROBS = [1.0, 0.9, 0.8, 0.7, 0.6];

export class Enemy {
  constructor(x, y, width, height, rows, cols, cubeSize, squares, totalHP, activeSquares, fallSpeed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rows = rows;
    this.cols = cols;
    this.cubeSize = cubeSize;
    this.squares = squares;
    this.totalHP = totalHP;
    this.displayedHP = totalHP;
    this.activeSquares = activeSquares;
    this.fallSpeed = fallSpeed;
    this.alive = true;
    this.flashTimer = 0;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  update(dt, _screenWidth, _canvasH, speedMultiplier) {
    this.y += this.fallSpeed * (speedMultiplier || 1) * dt;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.height + 20;
  }

  render(ctx, _canvasW, canvasH) {
    if (this.y < -this.height - 20 || this.y > canvasH + this.height + 20) return;

    ctx.save();

    const cs = this.cubeSize;
    const drawSize = cs - 1;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.squares[r][c].active) continue;

        const sx = this.x + c * cs;
        const sy = this.y + r * cs;

        ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#b91c1c';
        ctx.fillRect(sx, sy, drawSize, drawSize);

        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, drawSize, drawSize);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.displayedHP}`, this.centerX, this.centerY);

    ctx.restore();
  }

  hitSquare(row, col) {
    const sq = this.squares[row][col];
    if (!sq || !sq.active) return false;

    sq.hp -= 1;
    this.flashTimer = 0.08;

    if (sq.hp <= 0) {
      sq.active = false;
      this.activeSquares--;
      this.displayedHP = Math.max(0, this.displayedHP - 1);
      if (this.activeSquares <= 0) {
        this.alive = false;
      }
    }
    return true;
  }

  checkPlayerCollision(playerX, playerY, playerWidth, playerHeight) {
    const cs = this.cubeSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.squares[r][c].active) continue;

        const sx = this.x + c * cs;
        const sy = this.y + r * cs;

        if (
          playerX + playerWidth > sx &&
          playerX < sx + cs &&
          playerY + playerHeight > sy &&
          playerY < sy + cs
        ) {
          return { row: r, col: c, hp: this.squares[r][c].hp };
        }
      }
    }
    return null;
  }
}
