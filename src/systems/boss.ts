// Generic boss system: attack state machine (weights, cooldowns, min pause),
// telegraphs (red zone fills for `delay`, then strikes) and phase 2.

import { type BossAttackDef, type BossParams, getBoss } from '../data/bosses';
import { getBiome } from '../data/biomes';
import { ARENA } from '../data/balance';
import type { Battle } from './battle';
import { damageHero, isDisabled, killEnemy, speedMult } from './combat';
import type { Enemy, Telegraph, Vec } from './entities';
import { angleOf, dist } from './entities';
import { dayMultiplier, enemyStats } from './scaling';
import { moveTowards } from './ai';

export interface BossBehavior {
  /** Attack id → executes the attack. */
  attacks: Record<string, (b: Battle, boss: Enemy, p: BossParams, atk: BossAttackDef) => void>;
  /** Optional extra condition for an attack to be chosen. */
  canUse?: Record<string, (b: Battle, boss: Enemy, p: BossParams) => boolean>;
}

const behaviors: Record<string, BossBehavior> = {};

export function registerBoss(id: string, behavior: BossBehavior): void {
  behaviors[id] = behavior;
}

function behaviorOf(id: string): BossBehavior {
  const bh = behaviors[id];
  if (!bh) throw new Error(`No behaviour registered for boss ${id}`);
  return bh;
}

/** Creates the boss for a boss battle (no waves). */
export function setupBossBattle(b: Battle): void {
  const def = getBoss(getBiome(b.biome.id).boss);
  const scaled = enemyStats(def, b.tier, dayMultiplier(b.state.day));
  const attackCooldowns: Record<string, number> = {};
  for (const a of def.attacks) attackCooldowns[a.id] = a.initialCooldown;
  const boss: Enemy = {
    id: b.nextId++,
    pos: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h * 0.25 },
    vel: { x: 0, y: 0 },
    radius: def.radius,
    hp: scaled.hp,
    maxHp: scaled.hp,
    team: 'enemy',
    statuses: {},
    knockback: { x: 0, y: 0 },
    facing: Math.PI / 2,
    mass: def.mass,
    hitAt: -Infinity,
    spawnedAt: 0,
    dead: false,
    defId: def.id,
    name: def.name,
    archetype: 'tank',
    elite: false,
    damage: scaled.damage,
    speed: def.speed,
    armor: def.armor,
    xp: def.xp,
    gold: def.gold,
    attackTimer: 0,
    abilityTimer: 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    boss: { defId: def.id, phase: 1, attackCooldowns, pause: def.minPause, timers: {}, busy: 0 },
    summoned: false,
  };
  b.enemies.push(boss);
  b.boss = boss;
  // Hero starts at the bottom of the arena.
  b.hero.pos = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h * 0.8 };
}

export function updateBoss(b: Battle, dt: number): void {
  const boss = b.boss;
  if (!boss || boss.dead || !boss.boss) return;
  const rt = boss.boss;
  const def = getBoss(rt.defId);

  if (rt.phase === 1 && boss.hp <= boss.maxHp * def.phase2.hpFraction) {
    rt.phase = 2;
    boss.speed = def.speed * def.phase2.speedMult;
    b.events.emit({ type: 'bossPhase', phase: 2, pos: { ...boss.pos } });
  }
  const tempo = rt.phase === 2 ? def.phase2.speedMult : 1;
  for (const id of Object.keys(rt.attackCooldowns)) rt.attackCooldowns[id] = Math.max(0, (rt.attackCooldowns[id] ?? 0) - dt * tempo);
  rt.pause = Math.max(0, rt.pause - dt);
  rt.busy = Math.max(0, rt.busy - dt);

  boss.vel.x = 0;
  boss.vel.y = 0;
  if (isDisabled(boss) || b.hero.dead) return;
  const hero = b.hero;
  boss.facing = angleOf({ x: hero.pos.x - boss.pos.x, y: hero.pos.y - boss.pos.y });
  if (rt.busy <= 0 && dist(boss.pos, hero.pos) > def.keepDistance + boss.radius) {
    moveTowards(boss, hero.pos, boss.speed * speedMult(boss));
  }
  if (rt.pause > 0 || rt.busy > 0) return;

  const bh = behaviorOf(def.id);
  const ready = def.attacks.filter((a) => {
    if (!a.phases.includes(rt.phase)) return false;
    if ((rt.attackCooldowns[a.id] ?? 0) > 0) return false;
    const can = bh.canUse?.[a.id];
    return can ? can(b, boss, phaseParams(a, rt.phase)) : true;
  });
  if (ready.length === 0) return;
  const prio = ready.filter((a) => a.priority);
  const atk = prio.length > 0 ? (prio[0] as BossAttackDef) : b.rng.weighted(ready.map((a) => ({ item: a, weight: a.weight })));
  const fn = bh.attacks[atk.id];
  if (!fn) throw new Error(`Boss ${def.id} has no attack ${atk.id}`);
  fn(b, boss, phaseParams(atk, rt.phase), atk);
  rt.attackCooldowns[atk.id] = rt.phase === 1 ? atk.cooldown[0] : atk.cooldown[1];
  rt.pause = def.minPause;
}

function phaseParams(a: BossAttackDef, phase: 1 | 2): BossParams {
  return phase === 1 ? a.params[0] : a.params[1];
}

/** Boss stands still for `seconds` (wind-up). */
export function bossBusy(boss: Enemy, seconds: number): void {
  if (boss.boss) boss.boss.busy = Math.max(boss.boss.busy, seconds);
}

export function addTelegraph(b: Battle, kind: string, pos: Vec, radius: number, damage: number, delay: number): Telegraph {
  const t: Telegraph = {
    id: b.nextId++,
    kind,
    pos: { ...pos },
    shape: { kind: 'circle', radius },
    time: 0,
    delay,
    damage,
    dead: false,
  };
  b.telegraphs.push(t);
  return t;
}

export function updateTelegraphs(b: Battle, dt: number): void {
  for (const t of b.telegraphs) {
    if (t.dead) continue;
    t.time += dt;
    if (t.time < t.delay) continue;
    t.dead = true;
    const hero = b.hero;
    if (!hero.dead && dist(hero.pos, t.pos) <= t.shape.radius + hero.radius * 0.5) {
      damageHero(b, t.damage, { melee: false });
    }
    b.events.emit({ type: 'telegraphFire', kind: t.kind, pos: { ...t.pos }, radius: t.shape.radius });
  }
}

export function isBossDefeated(b: Battle): boolean {
  return b.boss !== null && b.boss.dead;
}

/** When the boss falls, its summons fall with it. */
export function onBossDefeated(b: Battle): void {
  for (const e of b.enemies) if (!e.dead && e.summoned) killEnemy(b, e);
}
