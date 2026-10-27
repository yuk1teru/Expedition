// Meta save (ROADMAP 9.6): what outlives a hero — the graves of the fallen heroes and the
// records drawn from them. Kept apart from the hero's save, so a new hero sees the old
// tombstones in the capital's cemetery.

import type { GameState } from '../core/state';
import type { BattleRecord } from './battleLog';
import type { DeathCause } from './combat';

export const META_VERSION = 1;

/** A hero whose story is over: the tombstone. */
export interface Grave {
  name: string;
  classId: string | null;
  promotion: string | null;
  level: number;
  /** Days in the adventure. */
  days: number;
  kills: number;
  bosses: number;
  /** Seconds of play. */
  playTime: number;
  /** The location of the last fight (its id). */
  nodeId: string;
  cause: DeathCause | null;
  /** The highest floor of the Endless tower (ROADMAP 18). */
  tower?: number;
  /** The player ended the adventure from the pause menu (not a death). */
  abandoned: boolean;
  /** When, ms since 1970. */
  date: number;
}

export interface MetaData {
  version: number;
  /** Oldest first. */
  graves: Grave[];
  /** Every finished battle of every hero, oldest first (ROADMAP 9.7). */
  battles: BattleRecord[];
  /** Tutorial hints already shown (ROADMAP 11.4): once per player, not per hero. */
  hintsSeen: string[];
}

export function emptyMeta(): MetaData {
  return { version: META_VERSION, graves: [], battles: [], hintsSeen: [] };
}

/** The tombstone of the state's hero; `nodeId` — where the story ended. */
export function makeGrave(state: GameState, opts: { abandoned: boolean; now?: number }): Grave {
  const death = state.lastDeath;
  return {
    name: state.heroName,
    classId: state.hero.classId,
    promotion: state.hero.promotion,
    level: state.hero.level,
    days: state.day,
    kills: state.stats.kills,
    bosses: state.bossesDefeated.length,
    playTime: Math.round(state.stats.playTime),
    tower: state.tower.best,
    nodeId: opts.abandoned || !death ? state.currentNodeId : death.nodeId,
    cause: opts.abandoned ? null : (death?.cause ?? null),
    abandoned: opts.abandoned,
    date: opts.now ?? Date.now(),
  };
}

/** Meta from storage; anything unreadable starts a new one (it never blocks the game). */
export function readMeta(text: string | null): MetaData {
  if (!text) return emptyMeta();
  try {
    const raw = JSON.parse(text) as Partial<MetaData>;
    if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.graves) || typeof raw.version !== 'number' || raw.version > META_VERSION) return emptyMeta();
    return {
      version: META_VERSION,
      graves: raw.graves.filter((g) => typeof g === 'object' && g !== null && typeof g.name === 'string'),
      battles: Array.isArray(raw.battles) ? raw.battles.filter((r) => typeof r === 'object' && r !== null && typeof r.node === 'string') : [],
      hintsSeen: Array.isArray(raw.hintsSeen) ? raw.hintsSeen.filter((h) => typeof h === 'string') : [],
    };
  } catch {
    return emptyMeta();
  }
}

export interface Records {
  heroes: number;
  bestLevel: Grave | null;
  /** The highest tower floor of all heroes. */
  bestTower: Grave | null;
  /** The hall of fame: heroes who beat the 100th floor. */
  hallOfFame: Grave[];
  mostBosses: Grave | null;
  mostDays: Grave | null;
  mostKills: Grave | null;
}

/** Records among the fallen heroes (the first hero to reach a value keeps it). */
export function records(meta: MetaData): Records {
  const best = (key: 'level' | 'bosses' | 'days' | 'kills'): Grave | null =>
    meta.graves.reduce<Grave | null>((top, g) => (top === null || g[key] > top[key] ? g : top), null);
  const towers = meta.graves.filter((g) => (g.tower ?? 0) > 0);
  const bestTower = towers.reduce<Grave | null>((a, g) => (!a || (g.tower ?? 0) > (a.tower ?? 0) ? g : a), null);
  return {
    heroes: meta.graves.length,
    bestLevel: best('level'),
    mostBosses: best('bosses'),
    mostDays: best('days'),
    mostKills: best('kills'),
    bestTower,
    hallOfFame: meta.graves.filter((g) => (g.tower ?? 0) >= 100),
  };
}

/** The statistics file friends send (battles and graves). */
export function statsExport(meta: MetaData, gameVersion: string, now = Date.now()): string {
  return JSON.stringify({ kind: 'expedition-stats', version: META_VERSION, gameVersion, exportedAt: now, battles: meta.battles, graves: meta.graves });
}
