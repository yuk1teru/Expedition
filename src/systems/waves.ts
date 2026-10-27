// Waves of an arena (ROADMAP 13.2): an arena has a set number of waves; every wave is
// bigger and stronger than the previous one (HP, damage and speed grow separately, and the
// growth goes on through the arenas of one location). The next wave comes to help once
// ≤ 40% of the current one is left (not while a miniboss lives); the last wave — with the
// miniboss in a lair — must be cleared completely, and the arena is won. Every 5th wave of
// a location brings an event: bad weather or an elemental.

import { INVASION_EVENTS } from '../data/invasion';
import { pushOutOfObstacles } from './arena';
import { ENEMY_ELEMENTS } from '../data/elements';
import { ARENA, ELITE, ENEMY_COMMON, WAVES, WAVE_EVENTS } from '../data/balance';
import { getEnemyDef } from '../data/enemies';
import { WEATHER_ORDER } from '../data/weather';
import type { Rng } from '../core/rng';
import type { ArenaSide } from '../data/arenas';
import type { Battle } from './battle';
import { createBossEnemy } from './boss';
import { setSplitHandler } from './combat';
import { maybeSpawnPickup } from './pickups';
import type { Archetype, Enemy, Vec } from './entities';
import { enemyStats, goldReward, threatMultiplier, waveGoldMult } from './scaling';
import { spawnTraps } from './traps';
import { endWeather, startWeather } from './weather';

export interface SpawnEntry {
  defId: string;
  elite: boolean;
}

/** Multipliers of one wave. */
export interface WaveMult {
  hp: number;
  damage: number;
  /** XP. */
  reward: number;
  /** Gold (linear, see GOLD). */
  gold: number;
  speed: number;
}

export const BASE_WAVE_MULT: WaveMult = { hp: 1, damage: 1, reward: 1, gold: 1, speed: 1 };

export interface WaveState {
  /** 0-based index of the current wave (counted through the whole location). */
  index: number;
  /** 0-based index of the first wave of this arena. */
  start: number;
  /** This arena's waves end here (exclusive): the arena is won after wave `total`. */
  total: number;
  queue: SpawnEntry[];
  groupTimer: number;
  /** Pause before the current wave starts spawning. */
  pause: number;
  started: boolean;
  /** Waves fully cleared so far (absolute, counting from wave 1 of the location). */
  cleared: number;
  /** Multipliers of the current wave. */
  mult: WaveMult;
  /** Enemies the running wave brings (for the overlap rule). */
  size: number;
  /** The location's miniboss comes with the last wave (a lair). */
  miniboss: boolean;
  /** The last wave is cleared: the arena is won. */
  done: boolean;
  /** Waves are this much bigger (the treasure's ambush). */
  sizeMult?: number;
}

/**
 * Enemies in a wave (0-based index of the location's waves): tier base, then one more every
 * wave after the first WAVES.count, capped.
 */
export function waveSize(tier: number, index = 0): number {
  const base = Math.min(WAVES.baseSize + WAVES.perTier * Math.floor(tier), WAVES.maxSize);
  return Math.min(WAVES.cap, base + WAVES.extraPerWave * Math.max(0, index + 1 - WAVES.count));
}

function grow(k: { a: number; b: number }, i: number): number {
  return 1 + k.a * i + k.b * i * i;
}

/** HP, damage, reward and speed multipliers of a wave (0-based index). */
export function waveMult(index: number): WaveMult {
  const g = WAVES.growth;
  return {
    hp: grow(g.hp, index),
    damage: grow(g.damage, index),
    reward: grow(g.reward, index),
    gold: waveGoldMult(index),
    speed: Math.min(g.speedMax, 1 + g.speedPerWave * index),
  };
}

/** HP multiplier for an archetype: fast and ranged enemies get only part of the growth. */
export function archetypeHpMult(mult: WaveMult, archetype: Archetype): number {
  return 1 + (mult.hp - 1) * WAVES.hpGrowthShare[archetype];
}

/**
 * Event of a wave (1-based number): every WAVE_EVENTS.every-th wave, the location's events
 * in turn (default: weather, elemental); none for a location without events.
 */
export function waveEvent(waveNumber: number, events: readonly ('weather' | 'elemental')[] = WAVE_EVENTS.order): 'weather' | 'elemental' | null {
  if (waveNumber % WAVE_EVENTS.every !== 0 || events.length === 0) return null;
  const n = waveNumber / WAVE_EVENTS.every - 1;
  return events[n % events.length] ?? null;
}

/** An arena's waves: `count` waves from wave `start` of the location; `miniboss` — with the last one. */
export function createWaves(start = 0, count: number = WAVES.count, miniboss = false): WaveState {
  return {
    index: start,
    start,
    total: start + count,
    queue: [],
    groupTimer: 0,
    pause: 0,
    started: false,
    cleared: start,
    mult: waveMult(start),
    size: 0,
    miniboss,
    done: false,
  };
}

/** Enemies of a wave from the location roster (an id listed twice is twice as likely). */
export function composeWave(rng: Rng, enemies: readonly string[], tier: number, waveIndex: number, sizeMult = 1): SpawnEntry[] {
  const weighted = enemies.map((id) => ({ item: id, weight: getEnemyDef(id).spawnWeight }));
  const size = Math.round(waveSize(tier, waveIndex) * sizeMult);
  const out: SpawnEntry[] = [];
  for (let i = 0; i < size; i++) out.push({ defId: rng.weighted(weighted), elite: false });
  // Elite from the elite wave on; it arrives with the last group.
  if (waveIndex + 1 >= WAVES.eliteWave && out.length > 0) {
    const last = out[out.length - 1] as SpawnEntry;
    last.elite = true;
  }
  return out;
}

export function updateWaves(b: Battle, dt: number): void {
  const w = b.waves;
  if (!w || w.done) return;
  if (!w.started) {
    w.pause -= dt;
    if (w.pause > 0) return;
    w.started = true;
    const number = w.index + 1;
    w.mult = waveMult(w.index);
    w.queue = composeWave(b.rng, b.node.enemies, b.tier, w.index, w.sizeMult ?? 1);
    // The invasion: the dead come with the beasts (ROADMAP 15.2).
    if (b.raid) for (const e of w.queue) if (b.rng.chance(INVASION_EVENTS.raid.raiderShare)) e.defId = INVASION_EVENTS.raid.raider;
    w.size = w.queue.length;
    w.groupTimer = 0;
    const mech = b.node.mechanics;
    const event = waveEvent(number, mech.events);
    const weathers = mech.weathers.length > 0 ? mech.weathers : WEATHER_ORDER;
    const weather = event === 'weather' ? b.rng.pick(weathers) : null;
    b.events.emit({ type: 'wave', index: number, total: w.total, bonus: 0, mult: { ...w.mult }, weather });
    if (mech.herbs) maybeSpawnPickup(b, number);
    spawnTraps(b, number, mech.trapsFrom);
    // A lair: the miniboss comes with the last wave.
    if (w.miniboss && number === w.total && b.node.miniboss) spawnMiniboss(b, b.node.miniboss);
    if (weather) startWeather(b, weather);
    if (event === 'elemental') spawnMiniboss(b, WAVE_EVENTS.elemental);
  }
  if (w.queue.length > 0) {
    w.groupTimer -= dt;
    if (w.groupTimer <= 0) {
      w.groupTimer = WAVES.groupInterval;
      spawnGroup(b, w.queue.splice(0, WAVES.groupSize), w.index);
    }
    return;
  }
  // The next wave comes to help early; the last one ends with a full clear.
  if (w.index + 1 < w.total) {
    if (!helpArrives(b, w)) return;
    w.cleared = w.index + 1;
    w.index += 1;
    w.started = false;
    w.pause = 0;
    endWeather(b);
    return;
  }
  if (b.enemies.some((e) => !e.dead)) return;
  // The last wave is cleared: the arena is won.
  w.cleared = w.index + 1;
  w.started = false;
  w.done = true;
  endWeather(b);
}

/**
 * The next wave comes to help: the current one has spawned completely, at most
 * WAVES.overlapAt of it is alive and no miniboss is on the field.
 */
export function helpArrives(b: Battle, w: WaveState): boolean {
  let left = 0;
  for (const e of b.enemies) {
    if (e.dead) continue;
    if (e.boss) return false;
    if (e.wave === w.index) left++;
  }
  return left <= w.size * WAVES.overlapAt;
}

/** A break between waves is running (the next wave can be called early). */
export function inBreak(b: Battle): boolean {
  const w = b.waves;
  return !!w && !w.started && !w.done && w.cleared > w.start && b.outcome === 'running';
}

/**
 * "Далі": ends the break now. The skipped seconds still count for the hero: skill and
 * boot-dash cooldowns run down by that much.
 */
export function skipBreak(b: Battle): boolean {
  if (!inBreak(b)) return false;
  const w = b.waves!;
  const skipped = Math.max(0, w.pause);
  w.pause = 0;
  const hero = b.hero;
  for (const s of hero.skills) s.cooldown = Math.max(0, s.cooldown - skipped);
  hero.dodgeCooldown = Math.max(0, hero.dodgeCooldown - skipped);
  if (skipped > 0) b.events.emit({ type: 'breakSkipped', seconds: skipped, pos: { ...hero.pos } });
  return true;
}

/** Seconds until the next wave starts (null while a wave is running). */
export function nextWaveIn(w: WaveState): number | null {
  return w.started ? null : Math.max(0, w.pause);
}

/** Multipliers of the running wave (boss battles: none). */
export function currentWaveMult(b: Battle): WaveMult {
  return b.waves ? b.waves.mult : b.objective ? b.objective.mult : BASE_WAVE_MULT;
}

function spawnMiniboss(b: Battle, defId: string): void {
  const e = createBossEnemy(b, defId, edgePoint(b.rng, b.arena.spawnSides), currentWaveMult(b));
  b.events.emit({ type: 'miniboss', name: e.name, pos: { ...e.pos } });
  b.events.emit({ type: 'spawn', pos: { ...e.pos }, radius: e.radius });
}

function spawnGroup(b: Battle, group: SpawnEntry[], wave: number): void {
  const anchor = edgePoint(b.rng, b.arena.spawnSides);
  for (const s of group) {
    const pos = {
      x: anchor.x + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
      y: anchor.y + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
    };
    spawnEnemy(b, s.defId, pos, s.elite).wave = wave;
  }
}

/** Random point just inside a random arena edge (of `sides`, when the arena limits them). */
export function edgePoint(rng: Rng, sides: readonly ArenaSide[] | null = null, inset: number = WAVES.spawnInset): Vec {
  const side = sides && sides.length > 0 ? SIDE_INDEX[rng.pick(sides)] : rng.int(0, 3);
  const x0 = ARENA.x + inset;
  const x1 = ARENA.x + ARENA.w - inset;
  const y0 = ARENA.y + inset;
  const y1 = ARENA.y + ARENA.h - inset;
  switch (side) {
    case 0:
      return { x: rng.float(x0, x1), y: y0 };
    case 1:
      return { x: x1, y: rng.float(y0, y1) };
    case 2:
      return { x: rng.float(x0, x1), y: y1 };
    default:
      return { x: x0, y: rng.float(y0, y1) };
  }
}

const SIDE_INDEX: Record<ArenaSide, number> = { top: 0, right: 1, bottom: 2, left: 3 };

// Scarabs and slimes split on death into smaller ones next to where they fell.
setSplitHandler((b, e, into, count) => {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + b.rng.float(0, 1);
    spawnEnemy(b, into, { x: e.pos.x + Math.cos(a) * e.radius, y: e.pos.y + Math.sin(a) * e.radius }, false, true);
  }
});

/** Spawns a regular enemy scaled by tier and by the running wave (summons too). */
export function spawnEnemy(b: Battle, defId: string, pos: Vec, elite = false, summoned = false, mult: WaveMult = currentWaveMult(b)): Enemy {
  const def = getEnemyDef(defId);
  const scaled = enemyStats(def, b.tier, threatMultiplier(b.state) * (b.raid ? INVASION_EVENTS.raid.enemyMult : 1));
  const hpMult = archetypeHpMult(mult, def.archetype) * (elite ? ELITE.hpMult : 1);
  const radius = def.radius * (elite ? ELITE.radiusMult : 1);
  const e: Enemy = {
    id: b.nextId++,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    radius,
    hp: scaled.hp * hpMult,
    maxHp: scaled.hp * hpMult,
    team: 'enemy',
    statuses: {},
    knockback: { x: 0, y: 0 },
    facing: 0,
    mass: def.mass * (elite ? ELITE.radiusMult : 1),
    hitAt: -Infinity,
    spawnedAt: b.time,
    dead: false,
    defId,
    element: ENEMY_ELEMENTS[defId],
    name: elite ? `${def.name} (елітний)` : def.name,
    archetype: def.archetype,
    elite,
    damage: scaled.damage * mult.damage * (elite ? ELITE.damageMult : 1),
    speed: def.speed * mult.speed,
    armor: def.armor,
    xp: def.xp * mult.reward * (elite ? ELITE.xpMult : 1),
    gold: summoned ? 0 : goldReward(b.tier) * mult.gold * (elite ? ELITE.goldMult : 1),
    attackTimer: def.attackInterval * ENEMY_COMMON.firstAttackDelay,
    abilityTimer: def.dash ? def.dash.interval * ENEMY_COMMON.firstAttackDelay : 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    windup: 0,
    shots: 0,
    yank: null,
    boss: null,
    summoned,
  };
  pushOutOfObstacles(b.arena, e);
  b.enemies.push(e);
  b.events.emit({ type: 'spawn', pos: { ...e.pos }, radius: e.radius });
  return e;
}
