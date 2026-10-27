// Application shell: owns the view, input, loop, screens and the run state.

import type { InputEvent } from '../core/input';
import { Input } from '../core/input';
import { GameLoop } from '../core/loop';
import { ScreenManager } from '../core/screens';
import { randomSeed } from '../core/seed';
import type { GameState } from '../core/state';
import { LOOP } from '../data/balance';
import { type Battle, createBattle, killAll } from '../systems/battle';
import { grantLevel } from '../systems/leveling';
import { SLICE_GROVE_ID, TOWN_ID, type WorldKind, getNode, resetClears } from '../systems/mapgen';
import { getSkill } from '../data/skills';
import {
  type BattleSummary,
  canTravel,
  chooseCard,
  chooseClass,
  choosePromotion,
  completeBattle,
  createGameState,
  nextCardOffer,
  passThrough,
  rerollCards,
  restoreCheckpoint,
  skipCards,
  teleport,
  travel,
} from '../systems/run';
import { type View, beginFrame, endFrame } from './canvas';
import { createCombatScreen } from './combatView';
import { type DebugPanel, createDebugPanel } from './debugPanel';
import { createDeathScreen, createGameOverScreen, createRewardScreen, createVictoryScreen } from './endScreens';
import { createHelpModal } from './help';
import { createChangelogModal } from './changelog';
import { CHANGELOG, CHANGELOG_BASE_VERSION, GAME_VERSION } from '../data/changelog';
import { unseenUpdates } from '../core/version';
import { createInventoryModal } from './inventory';
import { createMerchantModal } from './merchant';
import { createSkillPickModal } from './skillPick';
import { createMapScreen } from './mapView';
import { createCardChoiceModal, createClassChoiceModal } from './modals';
import { createPromotionModal } from './promotionModal';
import { THEME } from './theme';
import { createTownScreen } from './townView';
import { createWaveStartModal } from './waveStart';

/** Where the last seen game version is kept between visits (localStorage in the browser). */
export interface VersionStore {
  load(): string | null;
  save(version: string): void;
}

/** Small settings kept between visits (game speed). */
export interface SettingsStore {
  loadSpeed(): number | null;
  saveSpeed(speed: number): void;
}

export class App {
  readonly screens = new ScreenManager<CanvasRenderingContext2D>();
  readonly loop: GameLoop;
  state: GameState;
  battle: Battle | null = null;
  lastSummary: BattleSummary | null = null;
  /** Real seconds since start (UI animation). */
  time = 0;
  reducedMotion = false;
  /** Full world or the vertical slice (`?slice=1`); new runs keep it. */
  readonly worldKind: WorldKind;
  private readonly settings: SettingsStore | null;
  readonly debug: DebugPanel | null;

  constructor(
    readonly view: View,
    readonly input: Input,
    seed: number,
    opts: { dev: boolean; reducedMotion: boolean; versions?: VersionStore; world?: WorldKind; settings?: SettingsStore },
  ) {
    this.reducedMotion = opts.reducedMotion;
    this.worldKind = opts.world ?? 'full';
    this.state = createGameState(seed, this.worldKind);
    this.screens.onChange = (id) => (this.state.screen = id);
    this.screens.register('map', createMapScreen(this));
    this.screens.register('town', createTownScreen(this));
    this.screens.register('combat', createCombatScreen(this));
    this.screens.register('reward', createRewardScreen(this));
    this.screens.register('death', createDeathScreen(this));
    this.screens.register('victory', createVictoryScreen(this));
    this.screens.register('gameOver', createGameOverScreen(this));
    this.debug = opts.dev ? createDebugPanel(this) : null;
    this.loop = new GameLoop(
      {
        fixedUpdate: (dt) => this.screens.update(dt),
        frameUpdate: (dt) => this.frameUpdate(dt),
        render: () => this.render(),
      },
      { requestFrame: (cb) => requestAnimationFrame(cb) },
      { step: LOOP.step, maxFrame: LOOP.maxFrame },
    );
    this.settings = opts.settings ?? null;
    if (this.settings?.loadSpeed() === 2) this.loop.speed = 2;
    this.screens.go('town');
    this.showHelp();
    // Returning players first see what changed since their last visit (on top of the help).
    const store = opts.versions;
    const fresh = unseenUpdates(CHANGELOG, store ? store.load() : GAME_VERSION, CHANGELOG_BASE_VERSION);
    if (fresh.length > 0) {
      this.screens.pushModal(
        createChangelogModal(this, fresh, () => {
          store?.save(GAME_VERSION);
          this.screens.popModal();
        }),
      );
    } else store?.save(GAME_VERSION);
  }

  /** Town "Що нового": the whole update list. */
  showChangelog(): void {
    if (this.screens.topModal) return;
    this.screens.pushModal(createChangelogModal(this, CHANGELOG, () => this.screens.popModal()));
  }

  /** Town merchant window. */
  openMerchant(): void {
    if (this.screens.topModal) return;
    this.screens.pushModal(createMerchantModal(this, () => this.screens.popModal()));
  }

  /** "Як грати" window (before the game starts). */
  showHelp(): void {
    this.screens.pushModal(createHelpModal(this, () => this.screens.popModal()));
  }

  start(): void {
    this.loop.start();
  }

  /** ×1 / ×2 game speed; the choice is remembered. */
  toggleSpeed(): void {
    this.loop.toggleSpeed();
    this.settings?.saveSpeed(this.loop.speed);
  }

  totalBosses(): number {
    return this.state.world.nodes.filter((n) => n.isBoss).length;
  }

  newRun(seed: number = randomSeed()): void {
    this.screens.clearModals();
    this.loop.paused = false;
    this.battle = null;
    this.state = createGameState(seed, this.worldKind);
    this.screens.go('town');
  }

  goMap(): void {
    this.screens.go('map');
  }

  goTown(): void {
    this.screens.go('town');
  }

  /** Opens or closes the inventory (Tab); only where the hero is not in a dialog. */
  toggleInventory(): void {
    const top = this.screens.topModal;
    if (top?.id === 'inventory') {
      this.screens.popModal();
      return;
    }
    if (top) return;
    const screen = this.screens.current;
    if (screen !== 'map' && screen !== 'town' && screen !== 'combat') return;
    this.screens.pushModal(createInventoryModal(this, () => this.screens.popModal()));
  }

  /** Inventory on top of another window (the merchant): closing it returns there. */
  openInventoryOver(): void {
    if (this.screens.topModal?.id === 'inventory') return;
    this.screens.pushModal(createInventoryModal(this, () => this.screens.popModal()));
  }

  /** Pause → "Завершити забіг": the run ends as a defeat with a summary screen. */
  abandonRun(): void {
    this.screens.clearModals();
    this.loop.paused = false;
    if (this.battle) {
      // Count the unfinished battle in the run statistics.
      this.battle.outcome = 'lost';
      completeBattle(this.state, this.battle);
    }
    this.battle = null;
    this.screens.go('gameOver');
  }

  /** After death: back to town with the progress of the last rest. */
  respawn(): void {
    this.screens.clearModals();
    this.loop.paused = false;
    this.battle = null;
    restoreCheckpoint(this.state);
    this.screens.go('town');
  }

  /**
   * Map click. A wave location cleared before asks first: continue from the next
   * wave, start from wave 1 or cross it without a battle.
   */
  travelTo(nodeId: string): void {
    if (!canTravel(this.state, nodeId)) return;
    const node = getNode(this.state.world, nodeId);
    if (!node.isTown && !node.isBoss && node.lastWave > 0) {
      if (this.screens.topModal) return;
      this.screens.pushModal(
        createWaveStartModal(this, node, (start) => {
          this.screens.popModal();
          if (start === null) return;
          if (start === 'pass') {
            passThrough(this.state, nodeId);
            return;
          }
          const res = travel(this.state, nodeId);
          if (res.kind === 'battle') this.startBattle(res.nodeId, start);
        }),
      );
      return;
    }
    const res = travel(this.state, nodeId);
    if (res.kind === 'town') this.goTown();
    else if (res.kind === 'battle') this.startBattle(res.nodeId);
  }

  /** Map → town (always reachable from the map). */
  returnToTown(): void {
    this.travelTo(TOWN_ID);
  }

  startBattle(nodeId: string, startWave = 0): void {
    this.battle = createBattle(this.state, nodeId, startWave);
    this.loop.paused = false;
    this.screens.go('combat');
  }

  /** Called by the combat screen when the battle's end delay has run out. */
  finishBattle(): void {
    const b = this.battle;
    if (!b) return;
    this.lastSummary = completeBattle(this.state, b);
    this.battle = null;
    this.loop.paused = false;
    if (!this.lastSummary.won) this.screens.go('death');
    else if (this.lastSummary.runCompleted) this.screens.go('victory');
    else this.screens.go('reward');
  }

  skillSummary(): string {
    return [...this.state.hero.skills].sort((a, b) => a.slot - b.slot).map((sk) => `${getSkill(sk.id).name} ${'I'.repeat(sk.rank)}`).join(' · ');
  }

  /** Opens the next queued level-up choice when nothing else is open. */
  private processModalQueue(): void {
    if (this.screens.topModal) return;
    const screen = this.screens.current;
    if (screen === 'death' || screen === 'victory' || screen === 'gameOver') return;
    const req = this.state.modalQueue.shift();
    if (!req) return;
    if (req.kind === 'classChoice') {
      this.screens.pushModal(
        createClassChoiceModal(this, (classId) => {
          this.screens.popModal();
          // Then the player picks the starting skills from the class pool.
          this.screens.pushModal(
            createSkillPickModal(this, classId, (picks) => {
              chooseClass(this.state, classId, picks);
              this.screens.popModal();
            }),
          );
        }),
      );
      return;
    }
    if (!this.state.hero.classId) return;
    if (req.kind === 'promotion') {
      this.screens.pushModal(
        createPromotionModal(this, (branchId) => {
          choosePromotion(this.state, branchId);
          this.screens.popModal();
        }),
      );
      return;
    }
    const offer = nextCardOffer(this.state);
    if (offer.length === 0) return;
    this.screens.pushModal(
      createCardChoiceModal(this, offer, req.level, req.bossReward ?? false, {
        onChosen: (card) => {
          chooseCard(this.state, card);
          this.screens.popModal();
        },
        onReroll: (rerolls) => rerollCards(this.state, rerolls),
        onSkip: () => {
          skipCards(this.state, req.level, this.battle !== null);
          this.screens.popModal();
        },
      }),
    );
  }

  // ---- Debug actions ----

  debugLevelUp(): void {
    grantLevel(this.state);
  }

  debugKillAll(): void {
    if (this.battle) killAll(this.battle);
  }

  debugGoBoss(): void {
    const boss = this.state.world.nodes.find((n) => n.isBoss);
    if (!boss) return;
    this.screens.clearModals();
    const res = teleport(this.state, boss.id);
    if (res.kind === 'battle') this.startBattle(res.nodeId);
  }

  /** Resets the completion counter of the current location (the grove when in town). */
  debugResetLocation(): void {
    const here = getNode(this.state.world, this.state.currentNodeId);
    const node = here.isTown ? this.state.world.nodes.find((n) => n.id === SLICE_GROVE_ID) : here;
    if (node) resetClears(node);
  }

  private frameUpdate(dt: number): void {
    this.time += dt;
    // Play time stops on the result screens (death, victory, run over).
    const screen = this.screens.current;
    if (screen !== 'death' && screen !== 'victory' && screen !== 'gameOver') this.state.stats.playTime += dt;
    for (const e of this.input.drain()) this.handleInput(e);
    this.processModalQueue();
  }

  private handleInput(e: InputEvent): void {
    if (this.debug?.handle(e)) return;
    if (e.type === 'key' && e.code === 'Tab' && (this.screens.topModal?.id ?? 'inventory') === 'inventory') {
      const screen = this.screens.current;
      if (screen === 'map' || screen === 'town' || screen === 'combat') {
        this.toggleInventory();
        return;
      }
    }
    this.screens.onInput(e);
  }

  private render(): void {
    beginFrame(this.view, THEME.letterbox);
    this.screens.render(this.view.ctx);
    this.debug?.draw(this.view.ctx);
    endFrame(this.view);
  }
}
