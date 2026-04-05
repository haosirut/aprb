console.log('[Entity] Enemy loaded');

export class Enemy {
  constructor(x, y, hp, damage, fallSpeed, horizontalSpeed, size) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = damage;
    this.size = size || 15;
    this.fallSpeed = fallSpeed;
    this.horizontalSpeed = horizontalSpeed || 15;
    this.moveDir = Math.random() > 0.5 ? 1 : -1;
    this.moveTimer = 0;
    this.flashTimer = 0;
    this.alive = true;
  }

  update(dt, screenWidth, canvasH) {
    // Движение сверху вниз
    this.y += this.fallSpeed * dt;

    // Горизонтальное патрулирование
    this.moveTimer += dt;
    if (this.moveTimer > 1.5) {
      this.moveDir *= -1;
      this.moveTimer = 0;
    }
    this.x += this.moveDir * this.horizontalSpeed * dt;
    this.x = Math.max(this.size, Math.min(screenWidth - this.size, this.x));

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.size + 20;
  }

  render(ctx, canvasW, canvasH) {
    if (this.y < -this.size - 20 || this.y > canvasH + this.size + 20) return;

    ctx.save();

    const color = this.flashTimer > 0 ? '#fff' : '#888';
    ctx.fillStyle = color;
    ctx.strokeStyle = this.flashTimer > 0 ? '#ff0' : '#ccc';
    ctx.lineWidth = 1.5;

    // Ромб (алмаз)
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x + this.size, this.y);
    ctx.lineTo(this.x, this.y + this.size);
    ctx.lineTo(this.x - this.size, this.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // HP indicator
    if (this.hp > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hp, this.x, this.y);
    }

    // Damage indicator
    if (this.damage > 1) {
      ctx.fillStyle = '#f44';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`-${this.damage}`, this.x, this.y + this.size + 10);
    }

    ctx.restore();
  }

  hit() {
    this.hp -= 1;
    this.flashTimer = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
    }
    return this.hp <= 0;
  }

  checkCollision(playerX, playerY, playerRadius) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < playerRadius + this.size * 0.7;
  }
}
