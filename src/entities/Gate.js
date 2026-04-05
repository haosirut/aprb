console.log('[Entity] Gate loaded');

export class Gate {
  constructor(x, y, width, height, pillarWidth, effectValue, fallSpeed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pillarWidth = pillarWidth;
    this.effectValue = effectValue;
    this.speed = fallSpeed;
    this.passed = false;
    this.flashTimer = 0;
  }

  get leftPillar() {
    return { x: this.x, w: this.pillarWidth };
  }

  get effectZone() {
    return { x: this.x + this.pillarWidth, w: this.width - 2 * this.pillarWidth };
  }

  get rightPillar() {
    return { x: this.x + this.width - this.pillarWidth, w: this.pillarWidth };
  }

  update(dt) {
    this.y += this.speed * dt;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.height;
  }

  render(ctx, canvasW, canvasH) {
    if (this.y < -this.height - 20 || this.y > canvasH + this.height + 20) return;

    ctx.save();

    // Левый столб
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(this.x, this.y, this.pillarWidth, this.height);

    // Правый столб
    ctx.fillRect(this.x + this.width - this.pillarWidth, this.y, this.pillarWidth, this.height);

    // Зона эффекта
    const effectColor = this.effectValue > 0 ? '#22c55e' : '#ef4444';
    const flashColor = this.flashTimer > 0 ? '#ffffff' : effectColor;
    ctx.fillStyle = flashColor;
    ctx.fillRect(
      this.x + this.pillarWidth,
      this.y,
      this.width - 2 * this.pillarWidth,
      this.height,
    );

    // Обводка всего элемента
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Текст +1 / -1 по центру зоны эффекта
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const effectZoneCenterX = this.x + this.pillarWidth + (this.width - 2 * this.pillarWidth) / 2;
    const text = this.effectValue > 0 ? `+${this.effectValue}` : `${this.effectValue}`;
    ctx.fillText(text, effectZoneCenterX, this.y + this.height / 2);

    ctx.restore();
  }

  checkCollision(playerX, playerY, playerRadius) {
    if (this.passed) return false;

    // Проверка Y-band: игрок пересекает ворота по вертикали
    if (playerY - playerRadius > this.y + this.height) return false;
    if (playerY + playerRadius < this.y) return false;

    // Игрок в Y-band ворот — проверяем, в какой зоне
    const ez = this.effectZone;
    const effectLeft = ez.x;
    const effectRight = ez.x + ez.w;

    if (playerX > effectLeft && playerX < effectRight) {
      // Игрок в зоне эффекта
      this.passed = true;
      this.flashTimer = 0.15;
      return true;
    }

    return false;
  }
}
