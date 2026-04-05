console.log('[Core] LevelGenerator loaded');

const LEVEL_LENGTH = 5000;

export function generateLevel(levelNum) {
  const objects = [];
  const gateCount = 10 + levelNum * 3;
  const enemyCount = 5 + levelNum * 2;

  for (let i = 0; i < gateCount; i++) {
    const y = 200 + (LEVEL_LENGTH / (gateCount + 1)) * (i + 1);
    const gapX = 80 + Math.random() * (200 - 80);
    const gapWidth = 60 + Math.random() * 40;
    objects.push({
      type: 'gate',
      x: gapX,
      y: y,
      gapWidth: gapWidth,
      value: Math.random() > 0.4 ? 1 : -1,
    });
  }

  for (let i = 0; i < enemyCount; i++) {
    const y = 300 + Math.random() * (LEVEL_LENGTH - 400);
    objects.push({
      type: 'enemy',
      x: 40 + Math.random() * 220,
      y: y,
      hp: 1 + Math.floor(Math.random() * 2),
      damage: 1 + Math.floor(Math.random() * 2),
      speed: 15 + Math.random() * 25,
      size: 15,
    });
  }

  objects.sort((a, b) => a.y - b.y);

  console.log(`[Core] Level ${levelNum} generated: ${gateCount} gates, ${enemyCount} enemies, length=${LEVEL_LENGTH}`);
  return { objects, length: LEVEL_LENGTH };
}
