console.log('[Entity] Bullet loaded');

export class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 500;
    this.radius = 3;
    this.alive = true;
  }

  update(dt) {
    // Движение строго вверх
    this.y -= this.speed * dt;
    if (this.y < -10) {
      this.alive = false;
    }
  }

  render(ctx, canvasW, canvasH) {
    if (this.y < -10 || this.y > canvasH + 10) return;

    ctx.save();
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fa0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  checkCollision(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.radius + enemy.size * 0.7;
  }
}
