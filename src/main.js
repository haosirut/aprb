console.log('[Core] Main loaded');

import { GameLoop } from './core/GameLoop.js';
import { SceneManager } from './core/SceneManager.js';
import { State } from './core/State.js';
import { MenuScene } from './scenes/MenuScene.js';

const canvas = document.getElementById('gameCanvas');
const loop = new GameLoop(canvas);
const sm = new SceneManager();

sm.push(new MenuScene(sm, loop));

loop.onUpdate((dt) => {
  sm.update(dt);
});

loop.onRender((ctx, w, h) => {
  sm.render(ctx, w, h);
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  sm.handlePointerDown(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  sm.handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  sm.handlePointerUp();
});

canvas.addEventListener('pointercancel', (e) => {
  e.preventDefault();
  sm.handlePointerUp();
});

loop.start();
console.log('[Core] GateRunner MVP initialized');
