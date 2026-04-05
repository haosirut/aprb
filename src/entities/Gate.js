console.log('[Entity] Gate loaded');

export class Gate {
  constructor(x, y, gapWidth, value, screenWidth) {
    this.x = x;
    this.y = y;
    this.gapWidth = gapWidth;
    this.value = value;
    this.screenWidth = screenWidth;
    this.height = 30;
    this.thickness = 6;
    this.passed = false;
  }

  render(ctx, cameraY, canvasW, canvasH) {
    const screenY = this.y - cameraY;
    if (screenY < -50 || screenY > canvasH + 50) return;

    const gapLeft = this.x - this.gapWidth / 2;
    const gapRight = this.x + this.gapWidth / 2;
    const color = this.value > 0 ? '#0f0' : '#f00';
    const bgColor = this.value > 0 ? '#0a3a0a' : '#3a0a0a';

    ctx.save();

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, screenY - this.height / 2, gapLeft, this.height);
    ctx.fillRect(gapRight, screenY - this.height / 2, this.screenWidth - gapRight, this.height);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, screenY - this.height / 2, gapLeft, this.height);
    ctx.strokeRect(gapRight, screenY - this.height / 2, this.screenWidth - gapRight, this.height);

    ctx.fillStyle = color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.value > 0 ? '+1' : '-1', this.x, screenY);

    ctx.restore();
  }

  /**
   * Returns 'pass' if player is in the gap (apply value),
   * 'wall' if player hits the wall (penalty),
   * null if no collision.
   */
  checkCollision(playerX, playerY, playerRadius, cameraY) {
    if (this.passed) return null;

    const screenY = this.y - cameraY;
    const dy = Math.abs(playerY - screenY);
    if (dy > this.height / 2 + playerRadius) return null;

    // Player is in the gate's Y band — check if in gap or on wall
    const gapLeft = this.x - this.gapWidth / 2;
    const gapRight = this.x + this.gapWidth / 2;
    if (playerX > gapLeft + playerRadius && playerX < gapRight - playerRadius) {
      this.passed = true;
      return 'pass';
    }

    // Player overlaps wall area
    if (playerX + playerRadius > gapLeft && playerX - playerRadius < gapRight) {
      // Partial overlap with gap — still counts as pass
      this.passed = true;
      return 'pass';
    }

    // On the solid wall part — don't mark as passed, will keep checking
    return 'wall';
  }
}
