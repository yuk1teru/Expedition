// Generic boss system (bosses and minibosses): attack state machine (weights,
// cooldowns, min pause), telegraphs (red zone fills for `delay`, then strikes),
// optional phase 2, optional contact melee and straight dashes.

import { type BossAttackDef, type BossDef, type BossParams, getBoss } from '../data/bosses';
import { getBiome } from '../data/biomes';
import { ARENA } from '../data/balance';
import type { Battle } from './battle';
import { damageHero, isDisabled, killEnemy, speedMult } from './combat';
import type { Enemy, Telegraph, TelegraphShape, Vec } from './entities';
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

/** Creates a boss-driven enemy (boss or miniboss) at `pos`. */
export function createBossEnemy(b: Battle, defId: string, pos: Vec, statMult = 1): Enemy {
  const def = getBoss(defId);
  const scaled = enemyStats(def, b.tier, dayMultiplier(b.state.day) * statMult);
  const attackCooldowns: Record<string, number> = {};
  for (const a of def.attacks) attackCooldowns[a.id] = a.initialCooldown;
  const e: Enemy = {
    id: b.nextId++,
    pos: { ...pos },
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
    spawnedAt: b.time,
    dead: false,
    defId: def.id,
    name: def.name,
    archetype: 'tank',
    elite: false,
    damage: scaled.damage,
    speed: def.speed,
    armor: def.armor,
    xp: def.xp * statMult,
    gold: Math.round(def.gold * statMult),
    attackTimer: 0,
    abilityTimer: 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    boss: { defId: def.id, phase: 1, attackCooldowns, pause: def.minPause, timers: {}, busy: 0, dash: null },
    summoned: false,
  };
  b.enemies.push(e);
  return e;
}

/** Creates the boss for a boss battle (no waves). */
export function setupBossBattle(b: Battle): void {
  const boss = createBossEnemy(b, getBiome(b.biome.id).boss, { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h * 0.25 });
  b.boss = boss;
  // Hero starts at the bottom of the arena.
  b.hero.pos = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h * 0.8 };
}

/** Updates every boss-driven enemy on the field. */
export function updateBoss(b: Battle, dt: number): void {
  for (const e of b.enemies) if (!e.dead && e.boss) updateOneBoss(b, e, dt);
}

function updateOneBoss(b: Battle, boss: Enemy, dt: number): void {
  const rt = boss.boss!;
  const def = getBoss(rt.defId);

  if (def.phase2 && rt.phase === 1 && boss.hp <= boss.maxHp * def.phase2.hpFraction) {
    rt.phase = 2;
    boss.speed = def.speed * def.phase2.speedMult;
    b.events.emit({ type: 'bossPhase', phase: 2, pos: { ...boss.pos } });
  }
  const tempo = rt.phase === 2 && def.phase2 ? def.phase2.speedMult : 1;
  for (const id of Object.keys(rt.attackCooldowns)) rt.attackCooldowns[id] = Math.max(0, (rt.attackCooldowns[id] ?? 0) - dt * tempo);
  rt.pause = Math.max(0, rt.pause - dt);
  rt.busy = Math.max(0, rt.busy - dt);
  boss.attackTimer = Math.max(0, boss.attackTimer - dt);

  boss.vel.x = 0;
  boss.vel.y = 0;
  if (rt.dash) {
    // Straight dash (e.g. lunge): positions are integrated by the battle step.
    const d = dist(boss.pos, rt.dash.to);
    const step = rt.dash.speed * dt;
    if (d <= step) {
      boss.pos = { ...rt.dash.to };
      rt.dash = null;
    } else {
      boss.vel.x = ((rt.dash.to.x - boss.pos.x) / d) * rt.dash.speed;
      boss.vel.y = ((rt.dash.to.y - boss.pos.y) / d) * rt.dash.speed;
    }
    return;
  }
  if (isDisabled(boss) || b.hero.dead) return;
  const hero = b.hero;
  boss.facing = angleOf({ x: hero.pos.x - boss.pos.x, y: hero.pos.y - boss.pos.y });
  const d = dist(boss.pos, hero.pos);
  if (rt.busy <= 0 && d > def.keepDistance + boss.radius + hero.radius) {
    moveTowards(boss, hero.pos, boss.speed * speedMult(boss));
  }
  if (def.melee && rt.busy <= 0 && boss.attackTimer <= 0 && d <= boss.radius + hero.radius + def.melee.reach) {
    boss.attackTimer = def.melee.interval;
    damageHero(b, boss.damage * def.melee.damage, { attacker: boss, melee: true });
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

/** Starts a straight dash of a boss-driven enemy. */
export function bossDash(boss: Enemy, to: Vec, speed: number): void {
  if (boss.boss) boss.boss.dash = { to: { ...to }, speed };
}

export function addTelegraph(
  b: Battle,
  kind: string,
  pos: Vec,
  radius: number,
  damage: number,
  delay: number,
  onFire?: () => void,
): Telegraph {
  return addShapedTelegraph(b, kind, pos, { kind: 'circle', radius }, damage, delay, onFire);
}

export function addShapedTelegraph(
  b: Battle,
  kind: string,
  pos: Vec,
  shape: TelegraphShape,
  damage: number,
  delay: number,
  onFire?: () => void,
): Telegraph {
  const t: Telegraph = {
    id: b.nextId++,
    kind,
    pos: { ...pos },
    shape,
    time: 0,
    delay,
    damage,
    dead: false,
    onFire: onFire ?? null,
  };
  b.telegraphs.push(t);
  return t;
}

/** Whether a point (with extra `pad`) is inside the telegraph area. */
export function telegraphContains(t: Telegraph, p: Vec, pad: number): boolean {
  if (t.shape.kind === 'circle') return dist(p, t.pos) <= t.shape.radius + pad;
  const a = t.pos;
  const c = t.shape.to;
  const abx = c.x - a.x;
  const aby = c.y - a.y;
  const len2 = abx * abx + aby * aby;
  const k = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
  return dist(p, { x: a.x + abx * k, y: a.y + aby * k }) <= t.shape.width / 2 + pad;
}

/** Size used for effects: circle radius or line width. */
export function telegraphSize(t: Telegraph): number {
  return t.shape.kind === 'circle' ? t.shape.radius : t.shape.width;
}

export function updateTelegraphs(b: Battle, dt: number): void {
  for (const t of b.telegraphs) {
    if (t.dead) continue;
    t.time += dt;
    if (t.time < t.delay) continue;
    t.dead = true;
    const hero = b.hero;
    if (!hero.dead && telegraphContains(t, hero.pos, hero.radius * 0.5)) {
      damageHero(b, t.damage, { melee: false });
    }
    t.onFire?.();
    const at = t.shape.kind === 'line' ? { x: (t.pos.x + t.shape.to.x) / 2, y: (t.pos.y + t.shape.to.y) / 2 } : t.pos;
    b.events.emit({ type: 'telegraphFire', kind: t.kind, pos: { ...at }, radius: telegraphSize(t) });
  }
}

export function isBossDefeated(b: Battle): boolean {
  return b.boss !== null && b.boss.dead;
}

/** When a boss falls, its summons fall with it. */
export function onBossDefeated(b: Battle): void {
  for (const e of b.enemies) if (!e.dead && e.summoned) killEnemy(b, e);
}

export function bossDefOf(e: Enemy): BossDef | null {
  return e.boss ? getBoss(e.boss.defId) : null;
}
