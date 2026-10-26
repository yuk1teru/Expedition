// Run-level flow: new expedition, travel on the map, town actions.

import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { type Checkpoint, createRunStats, type GameState } from '../core/state';
import type { GameEvent } from './gameEvents';
import { type Card, applyCard, offerCards } from './cards';
import { assignClass, createHero, healFull } from './hero';
import type { Battle } from './battle';
import type { Item } from './items';
import { TOWN_ID, areAdjacent, generateSliceWorld, getNode, markCleared } from './mapgen';
import { clearBonusGold } from './scaling';

export function createGameState(seed: number): GameState {
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
    world: generateSliceWorld(),
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
  state.stats.deaths += 1;
}

export type TravelResult = { kind: 'town' } | { kind: 'battle'; nodeId: string } | { kind: 'blocked' };

/**
 * Click on a map node. Adjacent node → move there (town opens the town,
 * a location starts its battle). Clicking the current location replays it.
 */
export function travel(state: GameState, nodeId: string): TravelResult {
  const target = getNode(state.world, nodeId);
  const here = state.currentNodeId;
  if (nodeId !== here && !areAdjacent(state.world, here, nodeId)) return { kind: 'blocked' };
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

export function canTravel(state: GameState, nodeId: string): boolean {
  return nodeId === state.currentNodeId ? !getNode(state.world, nodeId).isTown : areAdjacent(state.world, state.currentNodeId, nodeId);
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
  /** Bonus waves cleared after the portal opened. */
  bonusWaves: number;
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
    markCleared(b.node);
    s.locationsCleared += 1;
    state.day += 1;
    if (b.node.isBoss && !state.bossesDefeated.includes(b.node.id)) state.bossesDefeated.push(b.node.id);
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
    bonusWaves: b.waves ? Math.max(0, b.waves.cleared - b.waves.total) : 0,
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

/** Offer for the next card choice (uses the run's card stream). */
export function nextCardOffer(state: GameState): Card[] {
  return offerCards(state.hero, state.cardRng);
}

export function chooseCard(state: GameState, card: Card): void {
  applyCard(state.hero, card);
}

