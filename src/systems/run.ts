// Run-level flow: new expedition, travel on the map, town actions.

import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { type Checkpoint, createRunStats, type GameState } from '../core/state';
import type { GameEvent } from './gameEvents';
import { type Card, applyCard, offerCards, rerollPrice, skipBuff, skipGold } from './cards';
import { addBuff } from './effects';
import { assignClass, createHero, healFull } from './hero';
import type { Battle } from './battle';
import type { Item } from './items';
import { TOWN_ID, type WorldKind, areAdjacent, createWorld, getNode, markCleared } from './mapgen';
import { clearBonusGold } from './scaling';
import { promote } from './promotion';

/** `world`: the full world (the game) or the vertical-slice world (`?slice=1`, tests, slice simulation). */
export function createGameState(seed: number, world: WorldKind = 'full'): GameState {
  const rng = new Rng(seed);
  const state: Omit<GameState, 'checkpoint'> = {
    seed,
    rng,
    cardRng: rng.fork('cards'),
    lootRng: rng.fork('loot'),
    nextItemUid: 1,
    battleCount: 0,
    day: 1,
    gold: 0,
    hero: createHero(0),
    world: createWorld(world, rng),
    currentNodeId: TOWN_ID,
    bossesDefeated: [],
    stats: createRunStats(),
    screen: 'town',
    modalQueue: [],
    events: new EventBus<GameEvent>(),
  };
  return { ...state, checkpoint: snapshot(state) };
}

function snapshot(state: Omit<GameState, 'checkpoint'>): Checkpoint {
  // Transient combat state (a dash callback, buffs, statuses) is not part of progress.
  const hero = { ...state.hero, dash: null, buffs: [], statuses: {}, invulnerable: 0 };
  return structuredClone({
    hero,
    gold: state.gold,
    day: state.day,
    world: state.world,
    bossesDefeated: state.bossesDefeated,
  });
}

/** Saves the current progress as the checkpoint (done when resting in town). */
export function saveCheckpoint(state: GameState): void {
  state.checkpoint = snapshot(state);
}

/**
 * Death is not the end: the hero wakes up in town with the progress of the
 * last rest (level, skills, items, gold, day, map). Run statistics are kept.
 */
export function restoreCheckpoint(state: GameState): void {
  const cp = structuredClone(state.checkpoint);
  state.hero = cp.hero;
  state.gold = cp.gold;
  state.day = cp.day;
  state.world = cp.world;
  state.bossesDefeated = cp.bossesDefeated;
  state.currentNodeId = TOWN_ID;
  state.modalQueue = [];
  state.hero.dead = false;
  state.hero.hp = state.hero.maxHp;
  state.hero.mana = state.hero.stats.manaMax;
  state.stats.deaths += 1;
}

export type TravelResult = { kind: 'town' } | { kind: 'battle'; nodeId: string } | { kind: 'blocked' };

/**
 * Click on a map node. Adjacent node → move there (town opens the town,
 * a location starts its battle). Clicking the current location replays it.
 */
export function travel(state: GameState, nodeId: string): TravelResult {
  const target = getNode(state.world, nodeId);
  if (!canTravel(state, nodeId)) return { kind: 'blocked' };
  state.currentNodeId = nodeId;
  if (target.isTown) return { kind: 'town' };
  return { kind: 'battle', nodeId };
}

/** Debug / slice shortcut: jump straight to a node regardless of edges. */
export function teleport(state: GameState, nodeId: string): TravelResult {
  getNode(state.world, nodeId);
  state.currentNodeId = nodeId;
  return getNode(state.world, nodeId).isTown ? { kind: 'town' } : { kind: 'battle', nodeId };
}

/** Full heal and checkpoint; happens automatically every time the hero arrives in town. */
export function restInTown(state: GameState): void {
  healFull(state.hero);
  saveCheckpoint(state);
}

/**
 * Leaving town saves again: what was done there (magnifiers used, items bought,
 * sold or worn) is not rolled back by a later death.
 */
export function leaveTown(state: GameState): void {
  saveCheckpoint(state);
}

/**
 * Adjacent nodes, the current location (replay) and the town: going back to town is
 * always free, the way out again leads through the locations.
 */
export function canTravel(state: GameState, nodeId: string): boolean {
  if (state.freeTravel === true || nodeId === TOWN_ID || nodeId === state.currentNodeId) return true;
  return areAdjacent(state.world, state.currentNodeId, nodeId);
}

/** A location cleared before can be crossed without a battle (not the boss: it is a dead end). */
export function canPassThrough(state: GameState, nodeId: string): boolean {
  const node = getNode(state.world, nodeId);
  return !node.isTown && !node.isBoss && node.timesCleared > 0 && nodeId !== state.currentNodeId && canTravel(state, nodeId);
}

/** Moves the hero onto a cleared location without a battle (see canPassThrough). */
export function passThrough(state: GameState, nodeId: string): boolean {
  if (!canPassThrough(state, nodeId)) return false;
  state.currentNodeId = nodeId;
  return true;
}

export interface BattleSummary {
  won: boolean;
  nodeName: string;
  isBoss: boolean;
  xp: number;
  gold: number;
  clearBonus: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  /** Mandatory waves of this visit (before the first portal). */
  mandatoryWaves: number;
  /** Waves cleared in this visit, and the range (1-based) they cover. */
  wavesCleared: number;
  firstWave: number;
  lastWave: number;
  /** Items found in this battle. */
  loot: Item[];
  /** This battle defeated the last remaining boss (show the victory screen once). */
  runCompleted: boolean;
}

/** Applies the result of a finished battle to the run. */
export function completeBattle(state: GameState, b: Battle): BattleSummary {
  const s = state.stats;
  s.kills += b.stats.kills;
  s.damageDealt += b.stats.damageDealt;
  s.damageTaken += b.stats.damageTaken;
  const won = b.outcome === 'won';
  const wasWon = isRunWon(state);
  let clearBonus = 0;
  if (won) {
    clearBonus = clearBonusGold(b.tier);
    state.gold += clearBonus;
    markCleared(b.node, b.waves?.cleared ?? 0);
    s.locationsCleared += 1;
    state.day += 1;
    if (b.node.isBoss && !state.bossesDefeated.includes(b.node.id)) state.bossesDefeated.push(b.node.id);
    // The boss reward: one more card on top of the big XP and gold (PLAN.md 5.13).
    if (b.node.isBoss && state.hero.classId) state.modalQueue.push({ kind: 'cardChoice', level: state.hero.level, bossReward: true });
    // A boss victory is a milestone: dying later must not roll it back.
    if (b.node.isBoss) saveCheckpoint(state);
  }
  return {
    won,
    nodeName: b.node.name,
    isBoss: b.node.isBoss,
    xp: b.stats.xp,
    gold: b.stats.gold + clearBonus,
    clearBonus,
    kills: b.stats.kills,
    damageDealt: b.stats.damageDealt,
    damageTaken: b.stats.damageTaken,
    mandatoryWaves: b.waves ? b.waves.total - b.waves.start : 0,
    wavesCleared: b.waves ? b.waves.cleared - b.waves.start : 0,
    firstWave: b.waves ? b.waves.start + 1 : 0,
    lastWave: b.waves ? b.waves.cleared : 0,
    loot: [...b.stats.loot],
    runCompleted: won && !wasWon && isRunWon(state),
  };
}

export function isRunWon(state: GameState): boolean {
  return state.world.nodes.filter((n) => n.isBoss).every((n) => state.bossesDefeated.includes(n.id));
}

/** Level-3 class choice with the picked starting skills. */
export function chooseClass(state: GameState, classId: string, picks?: string[]): void {
  assignClass(state.hero, classId, picks);
}

/** Level-13 branch choice. */
export function choosePromotion(state: GameState, branchId: string): void {
  promote(state.hero, branchId);
}

/** Offer for the next card choice (uses the run's card stream). */
export function nextCardOffer(state: GameState): Card[] {
  return offerCards(state.hero, state.cardRng);
}

export function chooseCard(state: GameState, card: Card): void {
  applyCard(state.hero, card);
}

/** Pays for a new offer; null if there is not enough gold. */
export function rerollCards(state: GameState, rerolls: number): Card[] | null {
  const price = rerollPrice(rerolls);
  if (state.gold < price) return null;
  state.gold -= price;
  return offerCards(state.hero, state.cardRng);
}

/**
 * Skips the card choice: some gold and a short buff. In battle the buff starts
 * right away, otherwise with the next battle.
 */
export function skipCards(state: GameState, level: number, inBattle: boolean): number {
  const gold = skipGold(level);
  state.gold += gold;
  const buff = skipBuff();
  if (inBattle) addBuff(state.hero, buff);
  else state.hero.pendingBuffs.push(buff);
  return gold;
}

