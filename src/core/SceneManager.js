console.log('[Core] SceneManager loaded');

export class SceneManager {
  constructor() {
    this.stack = [];
  }

  push(scene) {
    if (this.current) this.current.onExit?.();
    this.stack.push(scene);
    this.current.onEnter?.();
    console.log(`[Core] Scene pushed: ${scene.name}`);
  }

  pop() {
    if (this.stack.length === 0) return null;
    const scene = this.stack.pop();
    scene.onExit?.();
    console.log(`[Core] Scene popped: ${scene.name}`);
    if (this.current) {
      this.current.onEnter?.();
      console.log(`[Core] Current scene: ${this.current.name}`);
    }
    return scene;
  }

  replace(scene) {
    this.pop();
    this.push(scene);
  }

  clearAndPush(scene) {
    while (this.stack.length > 0) {
      const s = this.stack.pop();
      s.onExit?.();
    }
    this.stack.push(scene);
    scene.onEnter?.();
    console.log(`[Core] Scene stack cleared, pushed: ${scene.name}`);
  }

  get current() {
    return this.stack[this.stack.length - 1] || null;
  }

  update(dt) {
    if (this.current) this.current.update?.(dt);
  }

  render(ctx, w, h) {
    if (this.current) this.current.render?.(ctx, w, h);
  }

  handleResize(w, h) {
    if (this.current) this.current.onResize?.(w, h);
  }

  handlePointerDown(x, y) {
    if (this.current) this.current.onPointerDown?.(x, y);
  }

  handlePointerMove(x, y) {
    if (this.current) this.current.onPointerMove?.(x, y);
  }

  handlePointerUp() {
    if (this.current) this.current.onPointerUp?.();
  }
}
