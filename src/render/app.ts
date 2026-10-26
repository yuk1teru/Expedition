// Application shell: owns the view, input, loop, screens and the run state.

import type { InputEvent } from '../core/input';
import { Input } from '../core/input';
import { GameLoop } from '../core/loop';
import { ScreenManager } from '../core/screens';
import { randomSeed } from '../core/seed';
import type { GameState } from '../core/state';
import { LOOP } from '../data/balance';
import { getNode, markCleared } from '../systems/mapgen';
import { createGameState, travel } from '../systems/run';
import { type View, beginFrame, endFrame } from './canvas';
import { createMapScreen } from './mapView';
import { THEME } from './theme';
import { createTownScreen } from './townView';

export class App {
  readonly screens = new ScreenManager<CanvasRenderingContext2D>();
  readonly loop: GameLoop;
  state: GameState;
  /** Real seconds since start (UI animation). */
  time = 0;

  constructor(
    readonly view: View,
    readonly input: Input,
    seed: number,
  ) {
    this.state = createGameState(seed);
    this.screens.onChange = (id) => (this.state.screen = id);
    this.screens.register('map', createMapScreen(this));
    this.screens.register('town', createTownScreen(this));
    this.loop = new GameLoop(
      {
        fixedUpdate: (dt) => this.screens.update(dt),
        frameUpdate: (dt) => this.frameUpdate(dt),
        render: () => this.render(),
      },
      { requestFrame: (cb) => requestAnimationFrame(cb) },
      { step: LOOP.step, maxFrame: LOOP.maxFrame },
    );
    this.screens.go('town');
  }

  start(): void {
    this.loop.start();
  }

  totalBosses(): number {
    return this.state.world.nodes.filter((n) => n.isBoss).length;
  }

  newRun(seed: number = randomSeed()): void {
    this.screens.clearModals();
    this.loop.paused = false;
    this.state = createGameState(seed);
    this.screens.go('town');
  }

  goMap(): void {
    this.screens.go('map');
  }

  goTown(): void {
    this.screens.go('town');
  }

  travelTo(nodeId: string): void {
    const res = travel(this.state, nodeId);
    if (res.kind === 'town') this.goTown();
    else if (res.kind === 'battle') this.startBattle(res.nodeId);
  }

  startBattle(nodeId: string): void {
    // Temporary stub until combat exists: the location counts as completed.
    markCleared(getNode(this.state.world, nodeId));
    this.state.day += 1;
  }

  private frameUpdate(dt: number): void {
    this.time += dt;
    this.state.stats.playTime += dt;
    for (const e of this.input.drain()) this.handleInput(e);
  }

  private handleInput(e: InputEvent): void {
    this.screens.onInput(e);
  }

  private render(): void {
    beginFrame(this.view, THEME.letterbox);
    this.screens.render(this.view.ctx);
    endFrame(this.view);
  }
}
