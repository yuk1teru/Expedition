// Wave spawning: 3 waves, groups of 3 from arena edges, elite in the last wave.

import { ARENA, ELITE, ENEMY_COMMON, WAVES } from '../data/balance';
import { getBiome } from '../data/biomes';
import { getEnemyDef } from '../data/enemies';
import type { Rng } from '../core/rng';
import type { Battle } from './battle';
import type { Enemy, Vec } from './entities';
import { dayMultiplier, enemyStats, goldReward } from './scaling';

export interface SpawnEntry {
  defId: string;
  elite: boolean;
}

export interface WaveState {
  /** 0-based index of the current wave. */
  index: number;
  total: number;
  queue: SpawnEntry[];
  groupTimer: number;
  /** Pause before the current wave starts spawning. */
  pause: number;
  started: boolean;
  finished: boolean;
}

export function waveSize(tier: number): number {
  return Math.min(WAVES.baseSize + WAVES.perTier * Math.floor(tier), WAVES.maxSize);
}

export function createWaves(): WaveState {
  return { index: 0, total: WAVES.count, queue: [], groupTimer: 0, pause: 0, started: false, finished: false };
}

export function composeWave(rng: Rng, biomeId: string, tier: number, waveIndex: number): SpawnEntry[] {
  const biome = getBiome(biomeId);
  const weighted = biome.enemies.map((id) => ({ item: id, weight: getEnemyDef(id).spawnWeight }));
  const size = waveSize(tier);
  const out: SpawnEntry[] = [];
  for (let i = 0; i < size; i++) out.push({ defId: rng.weighted(weighted), elite: false });
  if (waveIndex + 1 === WAVES.eliteWave && out.length > 0) {
    // The elite arrives with the last group.
    const last = out[out.length - 1] as SpawnEntry;
    last.elite = true;
  }
  return out;
}

export function updateWaves(b: Battle, dt: number): void {
  const w = b.waves;
  if (!w || w.finished) return;
  if (!w.started) {
    w.pause -= dt;
    if (w.pause > 0) return;
    w.started = true;
    w.queue = composeWave(b.rng, b.biome.id, b.tier, w.index);
    w.groupTimer = 0;
    b.events.emit({ type: 'wave', index: w.index + 1, total: w.total });
  }
  if (w.queue.length > 0) {
    w.groupTimer -= dt;
    if (w.groupTimer <= 0) {
      w.groupTimer = WAVES.groupInterval;
      spawnGroup(b, w.queue.splice(0, WAVES.groupSize));
    }
    return;
  }
  if (b.enemies.some((e) => !e.dead)) return;
  // Wave cleared.
  if (w.index + 1 >= w.total) {
    w.finished = true;
    return;
  }
  w.index += 1;
  w.started = false;
  w.pause = WAVES.pauseBetween;
}

function spawnGroup(b: Battle, group: SpawnEntry[]): void {
  const anchor = edgePoint(b.rng);
  for (const s of group) {
    const pos = {
      x: anchor.x + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
      y: anchor.y + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread),
    };
    spawnEnemy(b, s.defId, pos, s.elite);
  }
}

/** Random point just inside a random arena edge. */
export function edgePoint(rng: Rng): Vec {
  const inset = WAVES.spawnInset;
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

export function spawnEnemy(b: Battle, defId: string, pos: Vec, elite = false, summoned = false): Enemy {
  const def = getEnemyDef(defId);
  const scaled = enemyStats(def, b.tier, dayMultiplier(b.state.day));
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
    xp: def.xp * (elite ? ELITE.xpMult : 1),
    gold: summoned ? 0 : goldReward(b.tier) * (elite ? ELITE.goldMult : 1),
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
