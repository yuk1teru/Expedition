// Generic boss system (bosses and minibosses): attack state machine (weights,
// cooldowns, min pause), telegraphs (red zone fills for `delay`, then strikes),
// optional phase 2, optional contact melee and straight dashes.

import { ENEMY_ELEMENTS } from '../data/elements';
import { type BossAttackDef, type BossDef, type BossParams, getBoss } from '../data/bosses';
import { getBiome } from '../data/biomes';
import { ARENA } from '../data/balance';
import type { Battle } from './battle';
import { damageHero, debuffHero, isDisabled, killEnemy, speedMult } from './combat';
import type { Enemy, Telegraph, TelegraphShape, Vec } from './entities';
import { angleOf, dist } from './entities';
import { enemyStats, threatMultiplier } from './scaling';
import { moveTowards } from './ai';
import type { WaveMult } from './waves';

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

const NO_MULT: WaveMult = { hp: 1, damage: 1, reward: 1, gold: 1, speed: 1 };

/** Creates a boss-driven enemy (boss or miniboss) at `pos`, scaled by the wave it comes with. */
export function createBossEnemy(b: Battle, defId: string, pos: Vec, mult: WaveMult = NO_MULT): Enemy {
  const def = getBoss(defId);
  const scaled = enemyStats(def, b.tier, threatMultiplier(b.state));
  const attackCooldowns: Record<string, number> = {};
  for (const a of def.attacks) attackCooldowns[a.id] = a.initialCooldown;
  const e: Enemy = {
    id: b.nextId++,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    radius: def.radius,
    hp: scaled.hp * mult.hp,
    maxHp: scaled.hp * mult.hp,
    team: 'enemy',
    statuses: {},
    knockback: { x: 0, y: 0 },
    facing: Math.PI / 2,
    mass: def.mass,
    hitAt: -Infinity,
    spawnedAt: b.time,
    dead: false,
    defId: def.id,
    element: ENEMY_ELEMENTS[def.id],
    name: def.name,
    archetype: 'tank',
    elite: false,
    damage: scaled.damage * mult.damage,
    speed: def.speed * mult.speed,
    armor: def.armor,
    xp: def.xp * mult.reward,
    gold: def.gold * mult.gold,
    attackTimer: 0,
    abilityTimer: 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    windup: 0,
    shots: 0,
    yank: null,
    boss: { defId: def.id, phase: 1, attackCooldowns, pause: def.minPause, timers: {}, busy: 0, dash: null, queued: null },
    summoned: false,
  };
  b.enemies.push(e);
  return e;
}

/** Creates the boss for a boss battle (no waves). */
export function setupBossBattle(b: Battle): void {
  const boss = createBossEnemy(b, b.node.boss || getBiome(b.biome.id).boss, { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h * 0.25 });
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
    boss.speed *= def.phase2.speedMult;
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
    rt.dash.timeLeft -= dt;
    if (rt.dash.timeLeft <= 0) {
      // Blocked (the hero's body, an arena wall): stop where it is instead of pushing forever.
      rt.dash = null;
    } else if (d <= step) {
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
  if (def.coldAura && rt.phase >= def.coldAura.phase && d <= def.coldAura.radius + hero.radius) {
    debuffHero(b, 'slow', 0.3, def.coldAura.slow);
  }
  if (def.melee && rt.busy <= 0 && boss.attackTimer <= 0 && d <= boss.radius + hero.radius + def.melee.reach) {
    boss.attackTimer = def.melee.interval;
    damageHero(b, boss.damage * def.melee.damage, { attacker: boss, melee: true });
  }
  const bh = behaviorOf(def.id);
  if (rt.queued && rt.busy <= 0) {
    // Combo: the follow-up comes right after the previous attack, no pause.
    const next = def.attacks.find((a) => a.id === rt.queued);
    rt.queued = null;
    if (next) {
      b.events.emit({ type: 'bossCombo', pos: { ...boss.pos } });
      runAttack(b, boss, next, bh);
      return;
    }
  }
  if (rt.pause > 0 || rt.busy > 0) return;

  const ready = def.attacks.filter((a) => {
    if (!a.phases.includes(rt.phase)) return false;
    if ((rt.attackCooldowns[a.id] ?? 0) > 0) return false;
    const can = bh.canUse?.[a.id];
    return can ? can(b, boss, phaseParams(a, rt.phase)) : true;
  });
  if (ready.length === 0) return;
  const prio = ready.filter((a) => a.priority);
  const atk = prio.length > 0 ? (prio[0] as BossAttackDef) : b.rng.weighted(ready.map((a) => ({ item: a, weight: a.weight })));
  runAttack(b, boss, atk, bh);
}

function runAttack(b: Battle, boss: Enemy, atk: BossAttackDef, bh: BossBehavior): void {
  const rt = boss.boss!;
  const def = getBoss(rt.defId);
  const fn = bh.attacks[atk.id];
  if (!fn) throw new Error(`Boss ${def.id} has no attack ${atk.id}`);
  fn(b, boss, phaseParams(atk, rt.phase), atk);
  rt.attackCooldowns[atk.id] = rt.phase === 1 ? atk.cooldown[0] : atk.cooldown[1];
  rt.pause = def.minPause;
  if (atk.followUp && b.rng.chance(atk.followUp.chance)) rt.queued = atk.followUp.id;
}

function phaseParams(a: BossAttackDef, phase: 1 | 2): BossParams {
  return phase === 1 ? a.params[0] : a.params[1];
}

/** Boss stands still for `seconds` (wind-up). */
export function bossBusy(boss: Enemy, seconds: number): void {
  if (boss.boss) boss.boss.busy = Math.max(boss.boss.busy, seconds);
}

/** Extra time a dash may take beyond distance / speed before it gives up, s. */
const DASH_SLACK = 0.25;

/** Starts a straight dash of a boss-driven enemy towards a point inside the arena. */
export function bossDash(boss: Enemy, to: Vec, speed: number): void {
  if (!boss.boss) return;
  const r = boss.radius;
  const target = {
    x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, to.x)),
    y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, to.y)),
  };
  boss.boss.dash = { to: target, speed, timeLeft: dist(boss.pos, target) / Math.max(1, speed) + DASH_SLACK };
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
    ownerId: null,
  };
  b.telegraphs.push(t);
  b.events.emit({ type: 'telegraph', kind, pos: { ...t.pos } });
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
    if (t.ownerId !== null) {
      // An enemy's own move fizzles if it dies or gets stunned during the wind-up.
      const owner = b.enemies.find((e) => e.id === t.ownerId);
      if (!owner || owner.dead || isDisabled(owner)) {
        t.dead = true;
        continue;
      }
    }
    if (t.time < t.delay) continue;
    t.dead = true;
    const hero = b.hero;
    if (!hero.dead && telegraphContains(t, hero.pos, hero.radius * 0.5)) {
      const owner = t.ownerId === null ? b.boss : b.enemies.find((e) => e.id === t.ownerId);
      damageHero(b, t.damage, { melee: false, cause: { kind: 'telegraph', by: owner ? (owner.boss?.defId ?? owner.defId) : null, attack: t.kind } });
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
