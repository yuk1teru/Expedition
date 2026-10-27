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
import { TOWN_ID, areAdjacent, buildWorld, getNode, markCleared } from './mapgen';
import { clearBonusGold } from './scaling';
import { LIVES } from '../data/balance';

/** Name of a hero the player did not name. */
export const DEFAULT_HERO_NAME = 'Мандрівник';
import { promote } from './promotion';
import { applyDeath, recoverLostLoot } from './death';

/** A new hero's adventure. */
export function createGameState(seed: number, heroName = DEFAULT_HERO_NAME): GameState {
  const rng = new Rng(seed);
  const state: Omit<GameState, 'checkpoint'> = {
    seed,
    heroName,
    rng,
    cardRng: rng.fork('cards'),
    lootRng: rng.fork('loot'),
    nextItemUid: 1,
    battleCount: 0,
    day: 1,
    gold: 0,
    lives: LIVES.start,
    hero: createHero(0),
    world: buildWorld(),
    currentNodeId: TOWN_ID,
    homeTown: TOWN_ID,
    bossesDefeated: [],
    stats: createRunStats(),
    screen: 'town',
    modalQueue: [],
    events: new EventBus<GameEvent>(),
    lastDeath: null,
    invasionSeen: 0,
  };
  return { ...state, checkpoint: snapshot(state) };
}

/** The checkpoint of the current progress. */
export function snapshot(state: Omit<GameState, 'checkpoint'>): Checkpoint {
  // Transient combat state (a dash callback, buffs, statuses) is not part of progress.
  const hero = { ...state.hero, dash: null, buffs: [], statuses: {}, invulnerable: 0 };
  return structuredClone({
    hero,
    gold: state.gold,
    day: state.day,
    lives: state.lives,
    world: state.world,
    bossesDefeated: state.bossesDefeated,
    homeTown: state.homeTown,
    lastDeath: state.lastDeath,
  });
}

/** Saves the current progress as the checkpoint (done when resting in town). */
export function saveCheckpoint(state: GameState): void {
  state.checkpoint = snapshot(state);
  state.events.emit({ type: 'checkpoint' });
}

/**
 * Death is not the end: the hero wakes up in the town of the last rest with the
 * progress of that rest (level, skills, items, gold, day, map). Run statistics are kept.
 */
export function restoreCheckpoint(state: GameState): void {
  const cp = structuredClone(state.checkpoint);
  state.hero = cp.hero;
  state.gold = cp.gold;
  state.day = cp.day;
  state.lives = cp.lives;
  state.world = cp.world;
  state.bossesDefeated = cp.bossesDefeated;
  state.homeTown = cp.homeTown;
  state.lastDeath = cp.lastDeath;
  state.currentNodeId = cp.homeTown;
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

/** Debug shortcut: jump straight to a node regardless of edges. */
export function teleport(state: GameState, nodeId: string): TravelResult {
  getNode(state.world, nodeId);
  state.currentNodeId = nodeId;
  return getNode(state.world, nodeId).isTown ? { kind: 'town' } : { kind: 'battle', nodeId };
}

/** Full heal and checkpoint; happens automatically every time the hero arrives in a town (it becomes the home town). */
export function restInTown(state: GameState): void {
  if (getNode(state.world, state.currentNodeId).isTown) state.homeTown = state.currentNodeId;
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
 * Adjacent nodes, the current location (replay) and the home town (the last rest):
 * going back there is always free, the way out again leads through the locations.
 */
export function canTravel(state: GameState, nodeId: string): boolean {
  if (state.freeTravel === true || nodeId === state.homeTown || nodeId === state.currentNodeId) return true;
  return areAdjacent(state.world, state.currentNodeId, nodeId);
}

/** A location cleared before can be crossed with a one-wave fight (not the boss: it is a dead end). */
export function canPassThrough(state: GameState, nodeId: string): boolean {
  const node = getNode(state.world, nodeId);
  return !node.isTown && !node.isBoss && node.timesCleared > 0 && nodeId !== state.currentNodeId && canTravel(state, nodeId);
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
  /** A crossing on the way (one wave). */
  transit: boolean;
  /** Loot left here by an earlier death and picked up now. */
  recovered: { items: Item[]; gold: number } | null;
  /** Lives left after this battle (a loss takes one). */
  lives: number;
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
  let recovered: BattleSummary['recovered'] = null;
  if (!won) applyDeath(state, b);
  if (won && b.transit) {
    // A crossing on the way costs a day; the location's progress stays as it was.
    state.day += 1;
  } else if (won) {
    recovered = recoverLostLoot(state, b.node);
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
    recovered,
    lives: state.lives,
    transit: b.transit,
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

