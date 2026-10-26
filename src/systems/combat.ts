// Damage, crits, armor, lifesteal, thorns, kills, knockback and statuses.

import { ENEMY_COMMON } from '../data/balance';
import type { Rng } from '../core/rng';
import type { Battle } from './battle';
import type { Body, Enemy, StatusId, Vec } from './entities';
import { normalize } from './entities';
import type { HitSource } from './gameEvents';
import { gainXp } from './leveling';
import { applyArmor, xpReward } from './scaling';

export interface Roll {
  amount: number;
  crit: boolean;
}

export function rollCrit(rng: Rng, base: number, critChance: number, critMult: number): Roll {
  const crit = rng.chance(critChance);
  return { amount: crit ? base * critMult : base, crit };
}

/** Hero damage: attack × multiplier, crit roll; skills also get the class skill multiplier. */
export function heroDamage(b: Battle, mult: number, source: HitSource): Roll {
  const s = b.hero.stats;
  const skillMult = source === 'skill' || source === 'zone' ? s.skillDamageMult : 1;
  return rollCrit(b.rng, s.attack * mult * skillMult, s.critChance, s.critMult);
}

export interface HitOptions {
  source: HitSource;
  /** Knockback away from this point. */
  knockFrom?: Vec;
  knockback?: number;
}

export function damageEnemy(b: Battle, e: Enemy, roll: Roll, opts: HitOptions): number {
  if (e.dead) return 0;
  const amount = applyArmor(roll.amount, e.armor);
  e.hp -= amount;
  e.hitAt = b.time;
  b.stats.damageDealt += amount;
  const hero = b.hero;
  if (hero.stats.lifesteal > 0 && opts.source !== 'thorns') {
    healHero(b, amount * hero.stats.lifesteal, false);
  }
  if (opts.knockFrom && opts.knockback) knock(e, opts.knockFrom, opts.knockback);
  b.events.emit({
    type: 'hit',
    pos: { x: e.pos.x, y: e.pos.y },
    amount,
    crit: roll.crit,
    targetId: e.id,
    radius: e.radius,
    source: opts.source,
  });
  if (e.hp <= 0) killEnemy(b, e);
  return amount;
}

export function killEnemy(b: Battle, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  b.stats.kills += 1;
  const isBoss = e.boss !== null;
  b.events.emit({ type: 'kill', pos: { ...e.pos }, defId: e.defId, radius: e.radius, elite: e.elite, boss: isBoss });
  const gold = e.gold;
  if (gold > 0) {
    b.state.gold += gold;
    b.stats.gold += gold;
    b.events.emit({ type: 'gold', pos: { ...e.pos }, amount: gold });
  }
  if (e.xp > 0) {
    const xp = xpReward(e.xp, b.tier, b.hero.level);
    b.stats.xp += xp;
    gainXp(b.state, xp);
  }
}

export interface HeroHitOptions {
  attacker?: Enemy;
  melee: boolean;
}

export function damageHero(b: Battle, rawAmount: number, opts: HeroHitOptions): number {
  const hero = b.hero;
  if (hero.dead || hero.invulnerable > 0) return 0;
  let amount = applyArmor(rawAmount, hero.stats.armor);
  for (const buff of hero.buffs) amount *= buff.damageTakenMult;
  hero.hitAt = b.time;
  if (opts.melee && opts.attacker && !opts.attacker.dead && hero.stats.thorns > 0) {
    damageEnemy(b, opts.attacker, { amount: rawAmount * hero.stats.thorns, crit: false }, { source: 'thorns' });
  }
  if (hero.immortal) amount = Math.min(amount, Math.max(0, hero.hp - 1));
  hero.hp -= amount;
  b.stats.damageTaken += amount;
  b.events.emit({ type: 'heroHurt', pos: { ...hero.pos }, amount });
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.dead = true;
    b.events.emit({ type: 'heroDeath', pos: { ...hero.pos } });
  }
  return amount;
}

export function healHero(b: Battle, amount: number, show = true): void {
  const hero = b.hero;
  if (hero.dead || amount <= 0) return;
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  if (show && hero.hp - before >= 1) b.events.emit({ type: 'heroHeal', pos: { ...hero.pos }, amount: hero.hp - before });
}

/** Adds an impulse away from `from`; heavier bodies move less. */
export function knock(body: Body, from: Vec, strength: number): void {
  const d = normalize({ x: body.pos.x - from.x, y: body.pos.y - from.y });
  const k = strength / Math.max(1, body.mass);
  body.knockback.x += d.x * k;
  body.knockback.y += d.y * k;
}

/** Impulse towards `to` (pull). */
export function pull(body: Body, to: Vec, strength: number): void {
  const d = normalize({ x: to.x - body.pos.x, y: to.y - body.pos.y });
  const k = strength / Math.max(1, body.mass);
  body.knockback.x += d.x * k;
  body.knockback.y += d.y * k;
}

export function decayKnockback(body: Body, dt: number): void {
  const f = Math.exp(-ENEMY_COMMON.knockbackDecay * dt);
  body.knockback.x *= f;
  body.knockback.y *= f;
}

export function addStatus(body: Body, id: StatusId, time: number, value = 0): void {
  const cur = body.statuses[id];
  if (!cur || cur.time < time || cur.value < value) {
    body.statuses[id] = { time: Math.max(time, cur?.time ?? 0), value: Math.max(value, cur?.value ?? 0) };
  }
}

export function hasStatus(body: Body, id: StatusId): boolean {
  return (body.statuses[id]?.time ?? 0) > 0;
}

/** Stunned or frozen bodies cannot move or attack. */
export function isDisabled(body: Body): boolean {
  return hasStatus(body, 'stun') || hasStatus(body, 'freeze');
}

export function speedMult(body: Body): number {
  const slow = body.statuses.slow;
  return slow && slow.time > 0 ? Math.max(0, 1 - slow.value) : 1;
}

/** Ticks statuses; burn deals its value per second to enemies. */
export function updateStatuses(b: Battle, body: Body, dt: number): void {
  for (const key of Object.keys(body.statuses) as StatusId[]) {
    const st = body.statuses[key];
    if (!st) continue;
    if (key === 'burn' && body.team === 'enemy' && st.time > 0) {
      const e = body as Enemy;
      if (!e.dead) {
        e.hp -= st.value * dt;
        b.stats.damageDealt += st.value * dt;
        if (e.hp <= 0) killEnemy(b, e);
      }
    }
    st.time -= dt;
    if (st.time <= 0) delete body.statuses[key];
  }
}
