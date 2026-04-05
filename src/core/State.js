console.log('[Core] State loaded');

export const State = {
  gameState: 'menu',
  playerUnits: 10,
  levelProgress: 0,
  selectedLevel: 1,
  lastResult: null,
  totalGates: 0,
  gatesPassed: 0,

  reset() {
    this.playerUnits = 10;
    this.levelProgress = 0;
    this.gameState = 'menu';
    this.selectedLevel = 1;
    this.lastResult = null;
    this.totalGates = 0;
    this.gatesPassed = 0;
    console.log('[Core] State reset');
  },

  resetForGame() {
    this.playerUnits = 10;
    this.levelProgress = 0;
    this.gameState = 'playing';
    this.lastResult = null;
    this.totalGates = 0;
    this.gatesPassed = 0;
    console.log('[Core] State reset for game');
  },
};

export function applyGateMath(currentUnits, type, value) {
  let result;
  switch (type) {
    case '+':
      result = currentUnits + value;
      break;
    case '-':
      result = currentUnits - value;
      break;
    case '*':
      result = currentUnits * value;
      break;
    case '/':
      result = currentUnits / value;
      break;
    default:
      result = currentUnits;
  }
  return Math.max(1, Math.floor(result));
}
