console.log('[Entity] Enemy loaded');

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

  update(dt, _screenWidth, _canvasH) {
    this.y += this.fallSpeed * dt;
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

  checkBulletCollision(bulletX, bulletY, bulletRadius) {
    const cs = this.cubeSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.squares[r][c].active) continue;

        const sx = this.x + c * cs;
        const sy = this.y + r * cs;

        if (
          bulletX + bulletRadius > sx &&
          bulletX - bulletRadius < sx + cs &&
          bulletY + bulletRadius > sy &&
          bulletY - bulletRadius < sy + cs
        ) {
          return { row: r, col: c, hp: this.squares[r][c].hp };
        }
      }
    }
    return null;
  }

  checkPlayerCollision(playerX, playerY, playerRadius) {
    const cs = this.cubeSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.squares[r][c].active) continue;

        const sx = this.x + c * cs;
        const sy = this.y + r * cs;

        const closestX = Math.max(sx, Math.min(playerX, sx + cs));
        const closestY = Math.max(sy, Math.min(playerY, sy + cs));
        const dx = playerX - closestX;
        const dy = playerY - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < playerRadius) {
          return { row: r, col: c, hp: this.squares[r][c].hp };
        }
      }
    }
    return null;
  }
}
