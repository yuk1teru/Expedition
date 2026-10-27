// The hero's wolves (Beastmaster companion and Call of the Pack): chase the nearest
// enemy and bite; melee enemies may bite them back.

import { ALLY_WOLF, getPromotion } from '../data/promotions';
import type { Battle } from './battle';
import { addStatus, damageEnemy, isDisabled, rollCrit, speedMult } from './combat';
import { type Ally, type Vec, angleOf, dist } from './entities';
import { heroAttack } from './hero';
import { nearestEnemy } from './targeting';

export interface AllySpec {
  pos: Vec;
  hp: number;
  damageMult: number;
  life: number;
  stunOnHit: number;
  companion: boolean;
  /** Default: a wolf. The bear is bigger and heavier (Beastmaster, level 22). */
  kind?: 'wolf' | 'bear';
}

export function spawnAlly(b: Battle, spec: AllySpec): Ally {
  const a: Ally = {
    id: b.nextId++,
    pos: { ...spec.pos },
    vel: { x: 0, y: 0 },
    radius: spec.kind === 'bear' ? ALLY_WOLF.bearRadius : ALLY_WOLF.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    team: 'hero',
    statuses: {},
    knockback: { x: 0, y: 0 },
    facing: 0,
    mass: spec.kind === 'bear' ? ALLY_WOLF.mass * 4 : ALLY_WOLF.mass,
    hitAt: -Infinity,
    spawnedAt: b.time,
    dead: false,
    kind: spec.kind ?? 'wolf',
    damageMult: spec.damageMult,
    attackTimer: ALLY_WOLF.attackInterval * 0.5,
    life: spec.life,
    stunOnHit: spec.stunOnHit,
    companion: spec.companion,
  };
  b.allies.push(a);
  b.events.emit({ type: 'spawn', pos: { ...a.pos }, radius: a.radius });
  return a;
}

/** The Beastmaster's permanent wolf, next to the hero. */
export function spawnCompanion(b: Battle): void {
  const hero = b.hero;
  if (!hero.promotion) return;
  const fx = getPromotion(hero.promotion).effect;
  if (fx.kind !== 'companion') return;
  hero.companionTimer = fx.respawn;
  spawnAlly(b, {
    pos: { x: hero.pos.x + 30, y: hero.pos.y + 10 },
    hp: hero.maxHp * fx.hpFrac,
    damageMult: fx.damage,
    life: Infinity,
    stunOnHit: 0,
    companion: true,
  });
}

export function updateAllies(b: Battle, dt: number): void {
  for (const a of b.allies) {
    if (a.dead) continue;
    a.life -= dt;
    if (a.life <= 0) {
      a.dead = true;
      continue;
    }
    a.attackTimer = Math.max(0, a.attackTimer - dt);
    a.vel.x = 0;
    a.vel.y = 0;
    if (isDisabled(a)) continue;
    const target = nearestEnemy(b.enemies, a.pos);
    // Nobody to bite: stay close to the hero.
    const goal = target ? target.pos : b.hero.pos;
    const reach = target ? a.radius + target.radius + ALLY_WOLF.reach : a.radius + b.hero.radius + 30;
    const d = dist(a.pos, goal);
    a.facing = angleOf({ x: goal.x - a.pos.x, y: goal.y - a.pos.y });
    if (d > reach) {
      const speed = ALLY_WOLF.speed * speedMult(a);
      a.vel.x = ((goal.x - a.pos.x) / d) * speed;
      a.vel.y = ((goal.y - a.pos.y) / d) * speed;
    } else if (target && a.attackTimer <= 0) {
      a.attackTimer = ALLY_WOLF.attackInterval;
      const hero = b.hero;
      const roll = rollCrit(b.rng, heroAttack(hero) * a.damageMult * hero.stats.petDamageMult, hero.stats.critChance, hero.stats.critMult);
      damageEnemy(b, target, roll, { source: 'ally' });
      if (!target.dead && a.stunOnHit > 0) addStatus(target, 'stun', a.stunOnHit);
    }
  }
}

/** An enemy bites a wolf. */
export function damageAlly(b: Battle, a: Ally, raw: number): void {
  if (a.dead) return;
  a.hp -= raw;
  a.hitAt = b.time;
  if (a.hp <= 0) {
    a.hp = 0;
    a.dead = true;
    b.events.emit({ type: 'allyDeath', pos: { ...a.pos } });
  }
}
