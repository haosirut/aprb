console.log('[Core] State loaded');

export const State = {
  gameState: 'menu',
  playerUnits: 10,
  levelProgress: 0,
  selectedLevel: 1,
  lastResult: null,
  totalGates: 0,
  gatesPassed: 0,
  gateHistory: [],

  reset() {
    this.playerUnits = 10;
    this.levelProgress = 0;
    this.gameState = 'menu';
    this.selectedLevel = 1;
    this.lastResult = null;
    this.totalGates = 0;
    this.gatesPassed = 0;
    this.gateHistory = [];
    console.log('[Core] State reset');
  },

  resetForGame() {
    this.playerUnits = 10;
    this.levelProgress = 0;
    this.gameState = 'playing';
    this.lastResult = null;
    this.totalGates = 0;
    this.gatesPassed = 0;
    this.gateHistory = [];
    console.log('[Core] State reset for game');
  },
};

export function applyGateMath(currentUnits, type, value) {
  return applySequentialOp(currentUnits, type, value);
}

export function applySequentialOp(current, op, val) {
  let res;
  switch (op) {
    case '+': res = current + val; break;
    case '-': res = current - val; break;
    case '*': res = current * val; break;
    case '/': res = current / val; break;
    default: res = current;
  }
  return Math.max(1, Math.floor(res));
}

export function calculateEnemyHP(playerUnits, gateHistory) {
  let hp = Math.max(1, Math.floor(playerUnits));
  if (gateHistory[0]) {
    hp = applySequentialOp(hp, gateHistory[0].type, gateHistory[0].value);
  }
  if (gateHistory[1]) {
    hp = applySequentialOp(hp, gateHistory[1].type, gateHistory[1].value);
  }
  return Math.max(1, Math.floor(hp * 2));
}
