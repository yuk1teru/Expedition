// Battle statistics (ROADMAP 9.7): every finished battle leaves a record in the meta save
// (all heroes). Friends export it as a file; the dev wiki sums the records up by location,
// so balance can be judged by real play, not only by the bot.

import type { GameState } from '../core/state';
import type { Battle } from './battle';
import type { DeathCause } from './combat';

export interface BattleRecord {
  /** Location id. */
  node: string;
  /** Tier the battle was fought at (boss threat included). */
  tier: number;
  hero: string;
  classId: string | null;
  level: number;
  day: number;
  won: boolean;
  /** Seconds. */
  time: number;
  damageTaken: number;
  damageDealt: number;
  /** Healing items drunk. */
  heals: number;
  kills: number;
  /** Waves cleared (0 for a boss). */
  waves: number;
  cause: DeathCause | null;
  /** When, ms since 1970. */
  date: number;
}

/** Records kept in the meta save (the oldest go first). */
export const BATTLE_LOG_MAX = 3000;

export function battleRecord(state: GameState, b: Battle, now = Date.now()): BattleRecord {
  const won = b.outcome === 'won';
  return {
    node: b.node.id,
    tier: Math.round(b.tier * 100) / 100,
    hero: state.heroName,
    classId: state.hero.classId,
    level: state.hero.level,
    day: state.day,
    won,
    time: Math.round(b.time * 10) / 10,
    damageTaken: Math.round(b.stats.damageTaken),
    damageDealt: Math.round(b.stats.damageDealt),
    heals: b.stats.heals,
    kills: b.stats.kills,
    waves: b.waves ? b.waves.cleared - b.waves.start : 0,
    cause: won ? null : b.deathCause,
    date: now,
  };
}

/** Adds a record, dropping the oldest past the limit. */
export function pushRecord(log: BattleRecord[], r: BattleRecord): void {
  log.push(r);
  if (log.length > BATTLE_LOG_MAX) log.splice(0, log.length - BATTLE_LOG_MAX);
}

export interface NodeSummary {
  node: string;
  battles: number;
  wins: number;
  avgTime: number;
  avgDamageTaken: number;
  avgHeals: number;
  avgLevel: number;
  deaths: number;
}

/** Per-location summary (the dev wiki table). */
export function summarize(log: BattleRecord[]): NodeSummary[] {
  const by = new Map<string, BattleRecord[]>();
  for (const r of log) by.set(r.node, [...(by.get(r.node) ?? []), r]);
  const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
  return [...by.entries()].map(([node, rs]) => ({
    node,
    battles: rs.length,
    wins: rs.filter((r) => r.won).length,
    avgTime: avg(rs.map((r) => r.time)),
    avgDamageTaken: avg(rs.map((r) => r.damageTaken)),
    avgHeals: avg(rs.map((r) => r.heals)),
    avgLevel: avg(rs.map((r) => r.level)),
    deaths: rs.filter((r) => !r.won).length,
  }));
}
