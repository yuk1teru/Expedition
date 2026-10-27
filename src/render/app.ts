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
import { findRoute, getNode, resetClears } from '../systems/mapgen';
import { getSkill } from '../data/skills';
import {
  type BattleSummary,
  canTravel,
  chooseGift,
  chooseClass,
  choosePromotion,
  completeBattle,
  createGameState,
  nextGiftOffer,
  rerollGifts,
  restoreCheckpoint,
  startPrologue,
  skipGift,
  teleport,
  travel,
} from '../systems/run';
import { type View, beginFrame, endFrame } from './canvas';
import { createCombatScreen } from './combatView';
import { type DebugPanel, createDebugPanel } from './debugPanel';
import { createDeathScreen, createRewardScreen, createVictoryScreen } from './endScreens';
import { createTombstoneScreen } from './tombstone';
import { type Grave, type MetaData, makeGrave, readMeta, statsExport } from '../systems/meta';
import { battleRecord, pushRecord } from '../systems/battleLog';
import { createHelpModal } from './help';
import { createChangelogModal } from './changelog';
import { CHANGELOG, CHANGELOG_BASE_VERSION, GAME_VERSION } from '../data/changelog';
import { unseenUpdates } from '../core/version';
import { createInventoryModal } from './inventory';
import { createMerchantModal } from './merchant';
import { createSkillPickModal } from './skillPick';
import { createMapScreen } from './mapView';
import { createClassChoiceModal, createGiftModal } from './modals';
import { createPromotionModal } from './promotionModal';
import { THEME } from './theme';
import { createTownScreen } from './townView';
import { createWaveStartModal } from './waveStart';
import { createTitleScreen } from './titleScreen';
import { createCoachModal } from './coach';
import { createSettingsModal } from './settingsModal';
import { createNoticeModal } from './notice';
import { createJournalModal } from './journal';
import { createTalentTreeModal } from './talentTree';
import { HINTS, type HintId } from '../data/hints';
import { HINT_SECONDS, drawHint } from './hint';
import { setNpcTownLookup } from '../systems/quests';
import { npcPlace } from '../data/towns';
import { getNpc } from '../data/npcs';
import { type GameSettings, readSettings } from '../core/settings';
import { visitTown } from '../systems/coach';
import { markVisited } from '../systems/fog';
import { type SaveData, fromSave, readSave, saveFileName, toSave, writeSave } from '../systems/save';

/** Where the last seen game version is kept between visits (localStorage in the browser). */
export interface VersionStore {
  load(): string | null;
  save(version: string): void;
}

/** The hero's save slot (localStorage in the browser). */
export interface SaveStore {
  load(): string | null;
  save(text: string): void;
  clear(): void;
}

/** Save files for friends: download one, pick one to import (null — cancelled). */
export interface SaveFiles {
  download(name: string, text: string): void;
  pick(): Promise<string | null>;
}

/** Small settings kept between visits (game speed, the settings window). */
export interface SettingsStore {
  loadSpeed(): number | null;
  saveSpeed(speed: number): void;
  load(): string | null;
  save(text: string): void;
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
  private readonly settingsStore: SettingsStore | null;
  /** The player's settings (ROADMAP 10.7). */
  settings: GameSettings;
  private readonly saves: SaveStore | null;
  private readonly metaStore: SaveStore | null;
  /** What outlives heroes: the graves (the cemetery, records). */
  meta: MetaData;
  /** The tombstone of the hero whose story has just ended (the tombstone screen). */
  lastGrave: Grave | null = null;
  private readonly files: SaveFiles | null;
  /** Seed of the first new hero (`?seed=` in the URL); later heroes get random ones. */
  private firstSeed: number | null;
  /** Autopath (ROADMAP 10.4): the nodes still ahead on the way (the last one is the goal). */
  route: string[] = [];
  /** The title screen opens straight at the name of a new hero ("Новий герой" on the end screens). */
  titleStartsWithName = false;
  readonly debug: DebugPanel | null;

  constructor(
    readonly view: View,
    readonly input: Input,
    seed: number,
    opts: { dev: boolean; reducedMotion: boolean; versions?: VersionStore; settings?: SettingsStore; saves?: SaveStore; meta?: SaveStore; files?: SaveFiles },
  ) {
    this.reducedMotion = opts.reducedMotion;
    this.firstSeed = seed;
    // Quests find the town of an NPC by the town layouts.
    setNpcTownLookup((npcId) => npcPlace(npcId)?.town ?? null);
    this.settings = readSettings(opts.settings?.load() ?? null);
    this.saves = opts.saves ?? null;
    this.files = opts.files ?? null;
    this.metaStore = opts.meta ?? null;
    this.meta = readMeta(this.metaStore?.load() ?? null);
    // A placeholder until the title screen continues a hero or starts a new one.
    this.state = createGameState(seed);
    this.screens.onChange = (id) => (this.state.screen = id);
    this.screens.register('title', createTitleScreen(this));
    this.screens.register('map', createMapScreen(this));
    this.screens.register('town', createTownScreen(this));
    this.screens.register('combat', createCombatScreen(this));
    this.screens.register('reward', createRewardScreen(this));
    this.screens.register('death', createDeathScreen(this));
    this.screens.register('victory', createVictoryScreen(this));
    this.screens.register('tombstone', createTombstoneScreen(this));
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
    this.settingsStore = opts.settings ?? null;
    if (this.settingsStore?.loadSpeed() === 2) this.loop.speed = 2;
    this.screens.go('title');
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

  /** The tutorial hint on screen (ROADMAP 11.4) and how long it stays. */
  private hintText = '';
  private hintTime = 0;

  /** Shows a tutorial hint once per player. */
  hint(id: HintId): void {
    if (this.meta.hintsSeen.includes(id) || this.screens.current === 'title') return;
    this.meta.hintsSeen.push(id);
    this.saveMeta();
    this.hintText = HINTS[id]!;
    this.hintTime = HINT_SECONDS;
  }

  /** The settings window (title screen, pause). */
  openSettings(): void {
    if (this.screens.topModal?.id === 'settings') return;
    this.screens.pushModal(createSettingsModal(this, () => this.screens.popModal()));
  }

  saveSettings(): void {
    this.settingsStore?.save(JSON.stringify(this.settings));
  }

  /** Town coachman: the «Швидка тарадайка» window. */
  openCoach(): void {
    if (this.screens.topModal) return;
    this.screens.pushModal(createCoachModal(this, () => this.screens.popModal()));
  }

  /** Town merchant window. */
  openMerchant(npcId?: string): void {
    if (this.screens.topModal) return;
    const npc = npcId ? getNpc(npcId) : null;
    this.screens.pushModal(createMerchantModal(this, () => this.screens.popModal(), npc?.shop, npc ? `${npc.name} — ${npc.title}` : undefined));
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
    this.settingsStore?.saveSpeed(this.loop.speed);
  }

  totalBosses(): number {
    return this.state.world.nodes.filter((n) => n.isBoss).length;
  }

  // ---- Heroes and saves ----

  /** The saved hero, or null (none, broken, or from a newer game). */
  savedHero(): SaveData | null {
    return readSave(this.saves?.load() ?? null);
  }

  /** Title → "Продовжити": the saved hero wakes up in the town of the last rest. */
  continueGame(): void {
    const data = this.savedHero();
    if (!data) return;
    this.resetScreens();
    this.setState(fromSave(data));
    this.screens.go('town');
  }

  /** Title → a new hero with this name; the previous save is replaced at the first rest. */
  startNewHero(name: string): void {
    const seed = this.firstSeed ?? randomSeed();
    this.firstSeed = null;
    this.resetScreens();
    const state = createGameState(seed, name);
    startPrologue(state);
    this.setState(state);
    this.screens.go('town');
    this.showHelp();
  }

  /** The tombstone screen → the title screen. */
  toTitle(): void {
    this.resetScreens();
    this.screens.go('title');
  }

  /**
   * The hero's story is over (no lives left, or given up): the tombstone goes to the
   * cemetery (meta save) and the hero's save is deleted.
   */
  private endHero(abandoned: boolean): void {
    const grave = makeGrave(this.state, { abandoned });
    this.meta.graves.push(grave);
    this.saveMeta();
    this.saves?.clear();
    this.lastGrave = grave;
  }

  /** End screens → "Новий герой": the title screen with the name field. */
  newHero(): void {
    this.resetScreens();
    this.titleStartsWithName = true;
    this.screens.go('title');
  }

  private saveMeta(): void {
    this.metaStore?.save(JSON.stringify(this.meta));
  }

  /** Every finished battle goes to the statistics (meta save). */
  private logBattle(b: Battle): void {
    pushRecord(this.meta.battles, battleRecord(this.state, b));
    this.saveMeta();
  }

  /** Title → "Статистика боїв": the file for the developer. */
  exportStats(): void {
    this.files?.download(`expedition-stats-${new Date().toISOString().slice(0, 10)}.json`, statsExport(this.meta, GAME_VERSION));
  }

  exportSave(): void {
    const data = this.savedHero();
    if (data) this.files?.download(saveFileName(data), writeSave(data));
  }

  /** Picks a save file; on success it becomes the saved hero. Null — nothing picked. */
  async importSave(): Promise<{ ok: boolean; name: string } | null> {
    const text = this.files ? await this.files.pick() : null;
    if (text === null) return null;
    const data = readSave(text);
    if (!data) return { ok: false, name: '' };
    this.saves?.save(writeSave(data));
    return { ok: true, name: data.heroName };
  }

  private setState(state: GameState): void {
    this.state = state;
    // A handed-in quest: what it gave.
    state.events.on('questDone', (e) => {
      this.screens.pushModal(createNoticeModal(this, `Квест виконано: ${e.name}`, e.reward.length ? `Нагорода: ${e.reward.join(' · ')}` : '', () => this.screens.popModal(), THEME.good));
    });
    // Every checkpoint (rest, leaving town, a boss) is written to the save slot.
    state.events.on('checkpoint', () => this.saves?.save(writeSave(toSave(state))));
  }

  private resetScreens(): void {
    this.screens.clearModals();
    this.loop.paused = false;
    this.battle = null;
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

  /** Pause → "Завершити пригоду": the hero's story ends — the tombstone screen. */
  abandonRun(): void {
    this.screens.clearModals();
    this.loop.paused = false;
    if (this.battle) {
      // Count the unfinished battle in the run statistics.
      this.battle.outcome = 'lost';
      completeBattle(this.state, this.battle);
      this.logBattle(this.battle);
    }
    this.battle = null;
    this.endHero(true);
    this.screens.go('tombstone');
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
   * Map click. A neighbour: go there (a wave location cleared before asks first: continue
   * from the next wave, start from wave 1 or cross it with one wave). Further away: the
   * autopath over towns and cleared locations, one wave in each of those locations.
   */
  travelTo(nodeId: string): void {
    this.route = [];
    if (!canTravel(this.state, nodeId)) {
      const way = findRoute(this.state.world, this.state.currentNodeId, nodeId);
      if (!way || way.length === 0) return;
      this.route = way;
      this.continueRoute();
      return;
    }
    this.goTo(nodeId);
  }

  /** Can the hero get to this node: a neighbour or by the autopath. */
  canReach(nodeId: string): boolean {
    return canTravel(this.state, nodeId) || !!findRoute(this.state.world, this.state.currentNodeId, nodeId);
  }

  /** The next step of the autopath: a town is passed by, a cleared location is a one-wave crossing, the goal is entered. */
  continueRoute(): void {
    while (this.route.length > 0) {
      const next = this.route.shift()!;
      if (this.route.length === 0) {
        this.goTo(next);
        return;
      }
      const node = getNode(this.state.world, next);
      if (node.isTown) {
        this.state.currentNodeId = next;
        visitTown(this.state, next);
        markVisited(this.state, next);
        continue;
      }
      travel(this.state, next);
      this.startBattle(next, 0, true);
      return;
    }
  }

  /** Map → stop the autopath where the hero stands. */
  stopRoute(): void {
    this.route = [];
  }

  private goTo(nodeId: string): void {
    if (!canTravel(this.state, nodeId)) return;
    const node = getNode(this.state.world, nodeId);
    if (!node.isTown && !node.isBoss && node.lastWave > 0) {
      if (this.screens.topModal) return;
      this.screens.pushModal(
        createWaveStartModal(this, node, (start) => {
          this.screens.popModal();
          if (start === null) return;
          if (start === 'pass') {
            travel(this.state, nodeId);
            this.startBattle(nodeId, 0, true);
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

  /** Map → the home town (the last rest; always reachable from the map). */
  returnToTown(): void {
    this.travelTo(this.state.homeTown);
  }

  startBattle(nodeId: string, startWave = 0, transit = false): void {
    this.battle = createBattle(this.state, nodeId, startWave, transit);
    this.loop.paused = false;
    this.screens.go('combat');
  }

  /** Called by the combat screen when the battle's end delay has run out. */
  finishBattle(): void {
    const b = this.battle;
    if (!b) return;
    this.lastSummary = completeBattle(this.state, b);
    this.logBattle(b);
    this.battle = null;
    this.loop.paused = false;
    // The last life is gone: the story ends right now (closing the game will not undo it).
    if (!this.lastSummary.won && this.state.lives <= 0) this.endHero(false);
    if (!this.lastSummary.won) this.route = [];
    if (this.lastSummary.won && this.lastSummary.transit) {
      this.screens.go('map');
      return;
    }
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
    if (screen === 'title' || screen === 'death' || screen === 'victory' || screen === 'tombstone') return;
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
    if (req.kind !== 'gift') return;
    const offer = nextGiftOffer(this.state, req.rarity);
    if (offer.length === 0) return;
    this.screens.pushModal(
      createGiftModal(this, offer, req.rarity, {
        onChosen: (gift) => {
          chooseGift(this.state, gift);
          this.screens.popModal();
        },
        onReroll: (rerolls) => rerollGifts(this.state, req.rarity, rerolls),
        onSkip: () => {
          skipGift(this.state, this.battle !== null);
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

  /** Resets the completion counter of the current location. */
  debugResetLocation(): void {
    const here = getNode(this.state.world, this.state.currentNodeId);
    if (!here.isTown) resetClears(here);
  }

  private frameUpdate(dt: number): void {
    this.time += dt;
    if (!this.screens.topModal) this.hintTime = Math.max(0, this.hintTime - dt);
    // Play time stops on the result screens (death, victory, run over).
    const screen = this.screens.current;
    if (screen !== 'title' && screen !== 'death' && screen !== 'victory' && screen !== 'tombstone') this.state.stats.playTime += dt;
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
    // T: the talent tree — out of battle (ROADMAP 12.7).
    if (e.type === 'key' && e.code === 'KeyT' && !this.screens.topModal) {
      const screen = this.screens.current;
      if ((screen === 'map' || screen === 'town') && this.state.hero.classId) {
        this.screens.pushModal(createTalentTreeModal(this, () => this.screens.popModal()));
        return;
      }
    }
    // J: the quest journal (not over other windows).
    if (e.type === 'key' && e.code === 'KeyJ' && !this.screens.topModal) {
      const screen = this.screens.current;
      if (screen === 'map' || screen === 'town' || screen === 'combat') {
        this.screens.pushModal(createJournalModal(this, () => this.screens.popModal()));
        return;
      }
    }
    this.screens.onInput(e);
  }

  private render(): void {
    beginFrame(this.view, THEME.letterbox);
    this.screens.render(this.view.ctx);
    if (this.hintTime > 0 && !this.screens.topModal) drawHint(this.view.ctx, this.view.width, this.view.height, this.hintText, this.hintTime);
    this.debug?.draw(this.view.ctx);
    endFrame(this.view);
  }
}
