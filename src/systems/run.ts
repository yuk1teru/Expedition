// Run-level flow: new expedition, travel on the map, town actions.

import { driveOffRaid, invasionTick } from './invasion';
import { elixirArenaDone } from './alchemy';
import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { type Checkpoint, createRunStats, type GameState } from '../core/state';
import type { GameEvent } from './gameEvents';
import { offerGifts, rerollPrice, skipBuff, skipGold, takeGift } from './gifts';
import type { GiftDef, GiftRarity } from '../data/gifts';
import { GIFT_RULES } from '../data/gifts';
import { addBuff } from './effects';
import { assignClass, createHero, healFull, recomputeHeroStats } from './hero';
import type { Battle } from './battle';
import type { Item } from './items';
import { TOWN_ID, areAdjacent, buildWorld, getNode, markCleared } from './mapgen';
import { clearBonusGold } from './scaling';
import { LIVES, PROGRESSION } from '../data/balance';

/** Name of a hero the player did not name. */
export const DEFAULT_HERO_NAME = 'Мандрівник';
import { promote, promote2 } from './promotion';
import { applyDeath, recoverLostLoot } from './death';
import { visitTown } from './coach';
import { markVisited } from './fog';
import { emptyQuestLog, questsAfterBattle } from './quests';

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
    townsVisited: [TOWN_ID],
    nodesVisited: [TOWN_ID],
    revealed: [],
    quests: emptyQuestLog(),
    expedition: null,
    talentPoints: 0,
    runeStones: 0,
    ordersDone: [],
    soulSeen: false,
    stash: [],
    townGrowth: {},
    raids: {},
    lastRaidDay: 0,
    capturedRegion: null,
    townAttack: null,
    invasionEventsDone: [],
    invasionNews: [],
  };
  return { ...state, checkpoint: snapshot(state) };
}

/**
 * The prologue (ROADMAP 11.3): a new adventure starts in the sea port — the hero is washed
 * ashore and the first way leads to the capital by the coast road.
 */
export function startPrologue(state: GameState): void {
  state.currentNodeId = PROLOGUE_TOWN;
  state.homeTown = PROLOGUE_TOWN;
  state.townsVisited = [PROLOGUE_TOWN];
  state.nodesVisited = [PROLOGUE_TOWN];
  state.arriving = true;
  state.checkpoint = snapshot(state);
}

/** Where a new adventure starts. */
export const PROLOGUE_TOWN = 'port';

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
    stash: state.stash,
    townGrowth: state.townGrowth,
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
  state.stash = cp.stash ?? [];
  state.townGrowth = cp.townGrowth ?? {};
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
  markVisited(state, nodeId);
  if (target.isTown) return { kind: 'town' };
  return { kind: 'battle', nodeId };
}

/** Debug shortcut: jump straight to a node regardless of edges. */
export function teleport(state: GameState, nodeId: string): TravelResult {
  getNode(state.world, nodeId);
  state.currentNodeId = nodeId;
  markVisited(state, nodeId);
  return getNode(state.world, nodeId).isTown ? { kind: 'town' } : { kind: 'battle', nodeId };
}

/** Full heal and checkpoint; happens automatically every time the hero arrives in a town (it becomes the home town). */
export function restInTown(state: GameState): void {
  if (getNode(state.world, state.currentNodeId).isTown) {
    state.homeTown = state.currentNodeId;
    visitTown(state, state.currentNodeId);
  }
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
  /** Waves cleared in this visit (a location trip: in all its arenas), and the range (1-based) they cover. */
  wavesCleared: number;
  firstWave: number;
  lastWave: number;
  /** Items found in this battle. */
  loot: Item[];
  /** Trophies found, by id. */
  trophies: Record<string, number>;
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
/** `final: false` — one arena of a location trip: kills count, the location is not done yet. */
export function completeBattle(state: GameState, b: Battle, opts: { final?: boolean } = {}): BattleSummary {
  const final = opts.final ?? true;
  const s = state.stats;
  s.kills += b.stats.kills;
  s.damageDealt += b.stats.damageDealt;
  s.damageTaken += b.stats.damageTaken;
  const won = b.outcome === 'won';
  const wasWon = isRunWon(state);
  let clearBonus = 0;
  let recovered: BattleSummary['recovered'] = null;
  if (!won) applyDeath(state, b);
  // Every arena behind wanes the elixir (ROADMAP 14.2).
  elixirArenaDone(state.hero);
  questsAfterBattle(state, {
    nodeId: b.node.id,
    won: won && final,
    transit: b.transit,
    isBoss: b.node.isBoss,
    killsById: b.stats.killsById,
    minibossKills: b.stats.minibossKills,
  });
  if (won && b.transit) {
    // A crossing on the way costs a day; the location's progress stays as it was.
    state.day += 1;
    invasionTick(state, b.node.id);
  } else if (won && final) {
    driveOffRaid(state, b.node, b.tier);
    recovered = recoverLostLoot(state, b.node);
    clearBonus = clearBonusGold(b.tier);
    state.gold += clearBonus;
    markCleared(b.node, b.waves?.cleared ?? 0);
    s.locationsCleared += 1;
    state.day += 1;
    invasionTick(state, b.node.id);
    if (b.node.isBoss && !state.bossesDefeated.includes(b.node.id)) state.bossesDefeated.push(b.node.id);
    // Gifts (ROADMAP 12.8): a boss gives a legendary one; the first win over a location's miniboss may give a rare one.
    if (state.hero.classId && b.node.isBoss) state.modalQueue.push({ kind: 'gift', rarity: 'legendary' });
    else if (state.hero.classId && b.stats.minibossKills > 0 && b.node.timesCleared === 1 && state.cardRng.chance(GIFT_RULES.minibossChance)) {
      state.modalQueue.push({ kind: 'gift', rarity: 'rare' });
    }
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
    wavesCleared: b.waves ? b.waves.cleared - b.waves.start : 0,
    firstWave: b.waves ? b.waves.start + 1 : 0,
    lastWave: b.waves ? b.waves.cleared : 0,
    loot: [...b.stats.loot],
    trophies: { ...b.stats.trophies },
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

/** Level-12 branch choice. */
export function choosePromotion(state: GameState, branchId: string): void {
  promote(state.hero, branchId);
  // Promoted late (past level 22): the second stage comes at once.
  if (state.hero.level >= PROGRESSION.promotion2Level) promote2(state.hero);
}

/** Level 22: the second stage of the branch. */
export function completePromotion(state: GameState): void {
  promote2(state.hero);
}

/** The gift window's offer (its own random stream). */
export function nextGiftOffer(state: GameState, rarity: GiftRarity): GiftDef[] {
  return offerGifts(state.hero, state.cardRng, rarity);
}

export function chooseGift(state: GameState, gift: GiftDef): void {
  takeGift(state.hero, gift.id, recomputeHeroStats);
}

/** Pays for a new offer; null if there is not enough gold. */
export function rerollGifts(state: GameState, rarity: GiftRarity, rerolls: number): GiftDef[] | null {
  const price = rerollPrice(rerolls);
  if (state.gold < price) return null;
  state.gold -= price;
  return offerGifts(state.hero, state.cardRng, rarity);
}

/**
 * Skips the gift: some gold and a short buff. In battle the buff starts right away,
 * otherwise with the next battle.
 */
export function skipGift(state: GameState, inBattle: boolean): number {
  const gold = skipGold(state.hero.level);
  state.gold += gold;
  const buff = skipBuff();
  if (inBattle) addBuff(state.hero, buff);
  else state.hero.pendingBuffs.push(buff);
  return gold;
}
