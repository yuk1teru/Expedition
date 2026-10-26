// Fixed-step game loop. The frame scheduler and clock are injected,
// so the loop itself never touches window.

export interface LoopHooks {
  /** Fixed simulation step; called 0..N times per frame (scaled by speed, skipped while paused). */
  fixedUpdate(dt: number): void;
  /** Once per frame with real elapsed seconds (UI, input). */
  frameUpdate(realDt: number): void;
  render(): void;
}

export interface FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): void;
}

export interface LoopOptions {
  step: number;
  /** Clamp for a single frame's real delta (tab switches etc.). */
  maxFrame: number;
}

export class GameLoop {
  speed = 1;
  paused = false;
  private acc = 0;
  private last: number | null = null;
  private running = false;

  constructor(
    private hooks: LoopHooks,
    private scheduler: FrameScheduler,
    private opts: LoopOptions,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduler.requestFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  /** Advances time manually; exposed for tests. */
  tick(realDt: number): number {
    const dt = Math.min(Math.max(realDt, 0), this.opts.maxFrame);
    this.hooks.frameUpdate(dt);
    let steps = 0;
    if (!this.paused) {
      this.acc += dt * this.speed;
      while (this.acc >= this.opts.step) {
        this.hooks.fixedUpdate(this.opts.step);
        this.acc -= this.opts.step;
        steps++;
      }
    }
    this.hooks.render();
    return steps;
  }

  private frame = (timeMs: number): void => {
    if (!this.running) return;
    const realDt = this.last === null ? 0 : (timeMs - this.last) / 1000;
    this.last = timeMs;
    this.tick(realDt);
    this.scheduler.requestFrame(this.frame);
  };
}
