// Waves: every wave is bigger and stronger than the previous one. Every 3rd wave
// brings a (scaled) miniboss; after every 3rd wave the exit portal opens for a
// longer break. Until the hero leaves, waves keep coming.

import { ARENA, ELITE, ENEMY_COMMON, WAVES } from '../data/balance';
import { getBiome } from '../data/biomes';
import { getEnemyDef } from '../data/enemies';
import type { Rng } from '../core/rng';
import type { Battle } from './battle';
import { createBossEnemy } from './boss';
import { maybeSpawnPickup } from './pickups';
import type { Enemy, Vec } from './entities';
import { dist } from './entities';
import { dayMultiplier, enemyStats, goldReward } from './scaling';

export interface SpawnEntry {
  defId: string;
  elite: boolean;
}

export interface WaveState {
  /** 0-based index of the current wave (≥ total means a bonus wave). */
  index: number;
  /** Mandatory waves. */
  total: number;
  queue: SpawnEntry[];
  groupTimer: number;
  /** Pause before the current wave starts spawning. */
  pause: number;
  started: boolean;
  /** Waves fully cleared so far. */
  cleared: number;
  /** HP/damage/reward multiplier of the current wave. */
  statMult: number;
  /** The current break is a portal break (portal usable). */
  portalBreak: boolean;
}

/** Bonus wave number for a wave index (0 for mandatory waves). */
export function bonusLevel(index: number): number {
  return Math.max(0, index + 1 - WAVES.count);
}

/** Enemies in a wave (0-based index): tier base, then a few more every wave after the first portal. */
export function waveSize(tier: number, index = 0): number {
  const base = Math.min(WAVES.baseSize + WAVES.perTier * Math.floor(tier), WAVES.maxSize);
  return base + WAVES.extraPerWave * Math.max(0, index + 1 - WAVES.count);
}

/** HP, damage and rewards multiplier of a wave (0-based index). */
export function waveStatMult(index: number): number {
  return 1 + WAVES.statPerWave * index + WAVES.statPerWave2 * index * index;
}

/** The break after `cleared` waves opens the portal. */
export function isPortalBreak(cleared: number): boolean {
  return cleared > 0 && cleared % WAVES.portalEvery === 0;
}

/** Waves until the next portal break, counting the current one. */
export function wavesToPortal(w: WaveState): number {
  const done = w.started ? w.index : w.cleared;
  return WAVES.portalEvery - (done % WAVES.portalEvery);
}

export function createWaves(): WaveState {
  return { index: 0, total: WAVES.count, queue: [], groupTimer: 0, pause: 0, started: false, cleared: 0, statMult: 1, portalBreak: false };
}

export function composeWave(rng: Rng, biomeId: string, tier: number, waveIndex: number): SpawnEntry[] {
  const biome = getBiome(biomeId);
  const weighted = biome.enemies.map((id) => ({ item: id, weight: getEnemyDef(id).spawnWeight }));
  const size = waveSize(tier, waveIndex);
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
  if (!w) return;
  if (!w.started) {
    w.pause -= dt;
    if (w.pause > 0) return;
    w.started = true;
    w.portalBreak = false;
    const bonus = bonusLevel(w.index);
    w.statMult = waveStatMult(w.index);
    w.queue = composeWave(b.rng, b.biome.id, b.tier, w.index);
    w.groupTimer = 0;
    b.events.emit({ type: 'wave', index: w.index + 1, total: w.total, bonus, statMult: w.statMult });
    maybeSpawnPickup(b, w.index + 1);
    if ((w.index + 1) % WAVES.minibossEvery === 0 && b.biome.miniboss) spawnMiniboss(b, b.biome.miniboss, w.statMult);
  }
  if (w.queue.length > 0) {
    w.groupTimer -= dt;
    if (w.groupTimer <= 0) {
      w.groupTimer = WAVES.groupInterval;
      spawnGroup(b, w.queue.splice(0, WAVES.groupSize), w.statMult);
    }
    return;
  }
  if (b.enemies.some((e) => !e.dead)) return;
  // Wave cleared.
  w.cleared = w.index + 1;
  w.index += 1;
  w.started = false;
  w.portalBreak = isPortalBreak(w.cleared);
  if (w.portalBreak) {
    openPortal(b);
    w.pause = WAVES.breaks.portal;
  } else {
    w.pause = w.cleared < WAVES.count ? WAVES.breaks.first : WAVES.breaks.normal;
  }
}

/** Seconds until the next wave starts (null while a wave is running). */
export function nextWaveIn(w: WaveState): number | null {
  return w.started ? null : Math.max(0, w.pause);
}

function spawnMiniboss(b: Battle, defId: string, statMult: number): void {
  const e = createBossEnemy(b, defId, edgePoint(b.rng), statMult);
  b.events.emit({ type: 'miniboss', name: e.name, pos: { ...e.pos } });
  b.events.emit({ type: 'spawn', pos: { ...e.pos }, radius: e.radius });
}

/** Opens the exit portal (placed once at the arena edge, away from the hero) and warns the player. */
export function openPortal(b: Battle): void {
  if (b.portal) {
    b.events.emit({ type: 'portalOpen', pos: { ...b.portal.pos }, seconds: WAVES.breaks.portal });
    return;
  }
  const inset = WAVES.portal.edgeInset;
  let best: Vec = { x: ARENA.x + inset, y: ARENA.y + ARENA.h / 2 };
  let bestD = -1;
  for (let i = 0; i < WAVES.portal.candidates; i++) {
    const p = edgePoint(b.rng, inset);
    const d = dist(p, b.hero.pos);
    if (d >= WAVES.portal.minDistFromHero) {
      best = p;
      break;
    }
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  b.portal = { pos: best, radius: WAVES.portal.radius, entered: false };
  b.events.emit({ type: 'portalOpen', pos: { ...best }, seconds: WAVES.breaks.portal });
}

/** The portal works only during a portal break (after every 3rd wave). */
export function portalActive(b: Battle): boolean {
  return !!b.portal && !b.portal.entered && !!b.waves && !b.waves.started && b.waves.portalBreak && b.outcome === 'running';
}

/** The portal is active and the hero is close enough (the "Увійти" button shows up). */
export function portalInReach(b: Battle): boolean {
  const p = b.portal;
  return !!p && portalActive(b) && dist(b.hero.pos, p.pos) <= p.radius + b.hero.radius + WAVES.portal.useRange;
}

/** Player pressed "Увійти": leaves only when in reach, never by walking or being pushed in. */
export function requestPortalEntry(b: Battle): boolean {
  if (!portalInReach(b)) return false;
  b.portal!.entered = true;
  return true;
}

/** Bot / debug: leave through the portal right away (only while it is active). */
export function enterPortal(b: Battle): boolean {
  if (!portalActive(b)) return false;
  b.portal!.entered = true;
  return true;
}

function spawnGroup(b: Battle, group: SpawnEntry[], statMult: number): void {
  const anchor = edgePoint(b.rng);
  for (const s of group) {
    const pos = {
      x: anchor.x + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
      y: anchor.y + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
    };
    spawnEnemy(b, s.defId, pos, s.elite, false, statMult);
  }
}

/** Random point just inside a random arena edge. */
export function edgePoint(rng: Rng, inset: number = WAVES.spawnInset): Vec {
  const side = rng.int(0, 3);
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

export function spawnEnemy(b: Battle, defId: string, pos: Vec, elite = false, summoned = false, statMult = 1): Enemy {
  const def = getEnemyDef(defId);
  const scaled = enemyStats(def, b.tier, dayMultiplier(b.state.day) * statMult);
  const hpMult = elite ? ELITE.hpMult : 1;
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
    name: elite ? `${def.name} (елітний)` : def.name,
    archetype: def.archetype,
    elite,
    damage: scaled.damage * (elite ? ELITE.damageMult : 1),
    speed: def.speed,
    armor: def.armor,
    xp: def.xp * statMult * (elite ? ELITE.xpMult : 1),
    gold: summoned ? 0 : Math.round(goldReward(b.tier) * statMult * (elite ? ELITE.goldMult : 1)),
    attackTimer: def.attackInterval * ENEMY_COMMON.firstAttackDelay,
    abilityTimer: def.dash ? def.dash.interval * ENEMY_COMMON.firstAttackDelay : 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    boss: null,
    summoned,
  };
  b.enemies.push(e);
  b.events.emit({ type: 'spawn', pos: { ...e.pos }, radius: e.radius });
  return e;
}
