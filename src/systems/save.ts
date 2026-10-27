// Saving the hero (ROADMAP 9.3): one slot, written automatically whenever the checkpoint is
// (rest in town, leaving town, a boss victory). The save holds the checkpoint progress plus
// the run bookkeeping; the world itself is rebuilt from the data, so renames and balance
// edits reach old saves too. Storage (localStorage, a file) is the caller's business.

import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import type { GameState, LastDeath, ModalRequest, RunStats } from '../core/state';
import { createRunStats } from '../core/state';
import { GAME_VERSION } from '../data/changelog';
import type { GameEvent } from './gameEvents';
import type { Hero } from './entities';
import { recomputeHeroStats } from './hero';
import { type MapNode, buildWorld } from './mapgen';
import { QUESTS } from '../data/quests';
import { type QuestLog, emptyQuestLog } from './quests';
import { snapshot } from './run';

/** Version of the save format; bump it and add a migration when the format changes. */
export const SAVE_VERSION = 3;

export interface SaveData {
  version: number;
  /** Game version that wrote the save (for the player; migrations use `version`). */
  gameVersion: string;
  /** When it was written, ms since 1970. */
  savedAt: number;
  heroName: string;
  seed: number;
  /** States of the random streams. */
  rng: { root: number; cards: number; loot: number };
  nextItemUid: number;
  battleCount: number;
  stats: RunStats;
  modalQueue: ModalRequest[];
  hero: Hero;
  gold: number;
  day: number;
  lives: number;
  homeTown: string;
  bossesDefeated: string[];
  /** Progress of the locations (id → clears, the last wave, loot left by a death). */
  nodes: Record<string, { timesCleared: number; lastWave: number; lostLoot?: MapNode['lostLoot'] }>;
  /** A death the doctor has not told about yet. */
  lastDeath: LastDeath | null;
  /** The highest invasion threshold announced (absent in early saves). */
  invasionSeen?: number;
  /** Towns reached on foot (absent in early saves: the home town only). */
  townsVisited?: string[];
  /** Map nodes visited and secret places revealed (fog of war; absent in early saves). */
  nodesVisited?: string[];
  revealed?: string[];
  /** Quests and what they gave that is not used yet (absent in early saves). */
  quests?: QuestLog;
  talentPoints?: number;
  runeStones?: number;
}

/**
 * Migrations from version N to N + 1. A save of an older format goes through all of them
 * in order; one of a newer game (higher version) is not loaded.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // 2: hero levels on the 1–30 scale (ROADMAP 10.1): new level = 2 × old − 1; the XP of the level starts over.
  1: (d) => {
    const hero = d.hero as { level: number; xp: number };
    const level = Math.max(1, 2 * hero.level - 1);
    const queue = (d.modalQueue as { kind: string; level?: number }[]).map((m) => (m.level ? { ...m, level: 2 * m.level - 1 } : m));
    return { ...d, hero: { ...hero, level, xp: 0 }, modalQueue: queue };
  },
  // 3: the talent tree (ROADMAP 12.3): the branch skill moves from slot 4 to R (5); no more cards.
  2: (d) => {
    const hero = d.hero as { skills: { id: string; slot: number }[]; promotion: string | null };
    const skills = hero.skills.map((s) => (s.slot === 4 && hero.promotion ? { ...s, slot: 5 } : s));
    const queue = (d.modalQueue as { kind: string }[]).filter((m) => m.kind !== 'cardChoice');
    return { ...d, hero: { ...hero, skills, freeSkills: [], arrows: [] }, modalQueue: queue };
  },
};

/** The save of the hero's progress at the last checkpoint. */
export function toSave(state: GameState, now = Date.now()): SaveData {
  const cp = state.checkpoint;
  const nodes: SaveData['nodes'] = {};
  for (const n of cp.world.nodes) {
    if (n.timesCleared > 0 || n.lastWave > 0 || n.lostLoot) nodes[n.id] = { timesCleared: n.timesCleared, lastWave: n.lastWave, ...(n.lostLoot ? { lostLoot: n.lostLoot } : {}) };
  }
  return structuredClone({
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: now,
    heroName: state.heroName,
    seed: state.seed,
    rng: { root: state.rng.state, cards: state.cardRng.state, loot: state.lootRng.state },
    nextItemUid: state.nextItemUid,
    battleCount: state.battleCount,
    stats: state.stats,
    modalQueue: state.modalQueue,
    hero: cp.hero,
    gold: cp.gold,
    day: cp.day,
    lives: cp.lives,
    homeTown: cp.homeTown,
    bossesDefeated: cp.bossesDefeated,
    nodes,
    lastDeath: cp.lastDeath,
    invasionSeen: state.invasionSeen,
    townsVisited: state.townsVisited,
    nodesVisited: state.nodesVisited,
    revealed: state.revealed,
    quests: state.quests,
    talentPoints: state.talentPoints,
    runeStones: state.runeStones,
  });
}

/** The game state of a save: the hero stands in the town of the last rest. */
export function fromSave(data: SaveData): GameState {
  const rng = new Rng(data.seed, data.rng.root);
  const cardRng = rng.fork('cards');
  cardRng.state = data.rng.cards >>> 0;
  const lootRng = rng.fork('loot');
  lootRng.state = data.rng.loot >>> 0;
  const world = buildWorld();
  for (const n of world.nodes) {
    const p = data.nodes[n.id];
    if (!p) continue;
    n.timesCleared = p.timesCleared;
    n.lastWave = p.lastWave;
    n.cleared = p.timesCleared > 0;
    n.lostLoot = p.lostLoot ?? null;
  }
  const hero = structuredClone(data.hero);
  hero.freeSkills ??= [];
  hero.arrows ??= [];
  hero.arrowElement ??= 'neutral';
  hero.gifts ??= [];
  hero.castMult = 1;
  // Balance edits since the save apply to the stats; the fight state starts clean.
  hero.dash = null;
  hero.buffs = [];
  hero.invulnerable = 0;
  hero.dead = false;
  recomputeHeroStats(hero);
  hero.hp = hero.maxHp;
  hero.mana = hero.stats.manaMax;
  const home = world.nodes.some((n) => n.id === data.homeTown && n.isTown) ? data.homeTown : world.nodes.find((n) => n.isTown)!.id;
  const state: Omit<GameState, 'checkpoint'> = {
    seed: data.seed,
    heroName: data.heroName,
    rng,
    cardRng,
    lootRng,
    nextItemUid: data.nextItemUid,
    battleCount: data.battleCount,
    day: data.day,
    gold: data.gold,
    lives: data.lives,
    hero,
    world,
    currentNodeId: home,
    homeTown: home,
    bossesDefeated: data.bossesDefeated.filter((id) => world.nodes.some((n) => n.id === id)),
    stats: { ...createRunStats(), ...data.stats },
    screen: 'town',
    modalQueue: [...data.modalQueue],
    events: new EventBus<GameEvent>(),
    lastDeath: data.lastDeath ?? null,
    invasionSeen: data.invasionSeen ?? 0,
    townsVisited: (data.townsVisited ?? [home]).filter((id) => world.nodes.some((n) => n.id === id && n.isTown)),
    nodesVisited: (data.nodesVisited ?? [home]).filter((id) => world.nodes.some((n) => n.id === id)),
    revealed: data.revealed ?? [],
    quests: data.quests ? { active: data.quests.active.filter((q) => QUESTS[q.id]), done: [...data.quests.done] } : emptyQuestLog(),
    talentPoints: data.talentPoints ?? 0,
    runeStones: data.runeStones ?? 0,
  };
  return { ...state, checkpoint: snapshot(state) };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * A save from storage or a file: parsed, checked and brought to the current format.
 * Null when it is not a save, is broken or comes from a newer game.
 */
export function readSave(text: string | null): SaveData | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || typeof raw.version !== 'number' || raw.version < 1 || raw.version > SAVE_VERSION) return null;
  let data = raw;
  for (let v = raw.version; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    data = { ...step(data), version: v + 1 };
  }
  const ok =
    typeof data.heroName === 'string' &&
    typeof data.seed === 'number' &&
    isObj(data.rng) &&
    isObj(data.hero) &&
    typeof data.gold === 'number' &&
    typeof data.day === 'number' &&
    typeof data.lives === 'number' &&
    typeof data.homeTown === 'string' &&
    Array.isArray(data.bossesDefeated) &&
    isObj(data.nodes) &&
    isObj(data.stats) &&
    Array.isArray(data.modalQueue);
  return ok ? (data as unknown as SaveData) : null;
}

export function writeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/** File name for the export: the hero's name and the date. */
export function saveFileName(data: SaveData): string {
  const date = new Date(data.savedAt).toISOString().slice(0, 10);
  const name = data.heroName.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'hero';
  return `expedition-${name}-${date}.json`;
}
