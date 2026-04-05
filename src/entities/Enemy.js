console.log('[Entity] Enemy loaded');

export class Enemy {
  constructor(x, y, hp, damage, speed, size) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = damage;
    this.size = size || 15;
    this.speed = speed || 15;
    this.moveDir = Math.random() > 0.5 ? 1 : -1;
    this.moveTimer = 0;
    this.flashTimer = 0;
    this.alive = true;
  }

  update(dt, screenWidth) {
    this.moveTimer += dt;
    if (this.moveTimer > 1.5) {
      this.moveDir *= -1;
      this.moveTimer = 0;
    }
    this.x += this.moveDir * this.speed * dt;
    this.x = Math.max(this.size, Math.min(screenWidth - this.size, this.x));

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  render(ctx, cameraY, canvasW, canvasH) {
    const screenY = this.y - cameraY;
    if (screenY < -50 || screenY > canvasH + 50) return;

    ctx.save();

    const color = this.flashTimer > 0 ? '#fff' : '#888';
    ctx.fillStyle = color;
    ctx.strokeStyle = this.flashTimer > 0 ? '#ff0' : '#ccc';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(this.x, screenY - this.size);
    ctx.lineTo(this.x + this.size, screenY);
    ctx.lineTo(this.x, screenY + this.size);
    ctx.lineTo(this.x - this.size, screenY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (this.hp > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hp, this.x, screenY);
    }

    if (this.damage > 1) {
      ctx.fillStyle = '#f44';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`-${this.damage}`, this.x, screenY + this.size + 8);
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

  checkCollision(playerX, playerY, playerRadius, cameraY) {
    const screenY = this.y - cameraY;
    const dx = playerX - this.x;
    const dy = playerY - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < playerRadius + this.size * 0.7;
  }
}
