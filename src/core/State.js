console.log('[Core] State loaded');

export const State = {
  gameState: 'menu',
  units: 10,
  levelProgress: 0,
  selectedLevel: 1,
  lastResult: null,

  reset() {
    this.units = 10;
    this.levelProgress = 0;
    this.gameState = 'menu';
    this.selectedLevel = 1;
    this.lastResult = null;
    console.log('[Core] State reset');
  },

  resetForGame() {
    this.units = 10;
    this.levelProgress = 0;
    this.gameState = 'playing';
    this.lastResult = null;
    console.log('[Core] State reset for game');
  },
};
