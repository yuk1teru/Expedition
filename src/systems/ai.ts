// Hero auto-combat AI (melee and ranged) and enemy archetype AI.

import { ENEMY_COMMON, HERO } from '../data/balance';
import { getEnemyDef } from '../data/enemies';
import type { Battle } from './battle';
import { damageEnemy, damageHero, hasStatus, heroDamage, isDisabled, speedMult } from './combat';
import type { Enemy, Hero, Projectile, Vec } from './entities';
import { angleOf, dist, normalize } from './entities';
import { nearestEnemy } from './targeting';

/** Effective attacks per second including buffs. */
export function heroAttackSpeed(hero: Hero): number {
  let s = hero.stats.attackSpeed;
  for (const b of hero.buffs) s *= b.attackSpeedMult;
  return s;
}

export function updateHeroAI(b: Battle, dt: number): void {
  const hero = b.hero;
  hero.attackTimer = Math.max(0, hero.attackTimer - dt);
  hero.vel.x = 0;
  hero.vel.y = 0;
  if (hero.dead || hero.dash || isDisabled(hero)) return;
  const target = nearestEnemy(b.enemies, hero.pos);
  if (!target) return;
  if (hero.stats.ranged) rangedHero(b, hero, target);
  else meleeHero(b, hero, target);
}

/** Melee: walk to the nearest enemy, hit it when in reach. Never dodges. */
function meleeHero(b: Battle, hero: Hero, target: Enemy): void {
  const d = dist(hero.pos, target.pos);
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  if (d - target.radius <= hero.stats.range) {
    if (hero.attackTimer <= 0) {
      hero.attackTimer = 1 / heroAttackSpeed(hero);
      damageEnemy(b, target, heroDamage(b, 1, 'basic'), {
        source: 'basic',
        knockFrom: hero.pos,
        knockback: HERO.meleeKnockback,
      });
    }
    return;
  }
  moveTowards(hero, target.pos, hero.stats.moveSpeed * speedMult(hero));
}

/** Ranged: keep a distance band, back off from close enemies, shoot within range. */
function rangedHero(b: Battle, hero: Hero, target: Enemy): void {
  const r = HERO.ranged;
  const d = dist(hero.pos, target.pos);
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  const speed = hero.stats.moveSpeed * speedMult(hero);
  if (d < r.retreatBelow) {
    moveAway(hero, target.pos, speed);
  } else if (d > r.keepMax) {
    moveTowards(hero, target.pos, speed);
  } else if (d < r.keepMin) {
    moveAway(hero, target.pos, speed * 0.6);
  }
  if (d <= hero.stats.range && hero.attackTimer <= 0) {
    hero.attackTimer = 1 / heroAttackSpeed(hero);
    const dir = normalize({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
    const roll = heroDamage(b, 1, 'basic');
    spawnProjectile(b, {
      pos: { ...hero.pos },
      vel: { x: dir.x * r.projectileSpeed, y: dir.y * r.projectileSpeed },
      radius: r.projectileRadius,
      damage: roll.amount,
      team: 'hero',
      life: hero.stats.range / r.projectileSpeed + r.projectileLifePad,
      pierce: 0,
      kind: roll.crit ? 'heroCrit' : 'hero',
      melee: false,
    });
  }
}

export function updateEnemyAI(b: Battle, e: Enemy, dt: number): void {
  e.attackTimer = Math.max(0, e.attackTimer - dt);
  e.abilityTimer = Math.max(0, e.abilityTimer - dt);
  e.vel.x = 0;
  e.vel.y = 0;
  if (e.dead || b.hero.dead || isDisabled(e)) {
    e.dashTime = 0;
    return;
  }
  if (e.boss) return; // bosses are driven by boss.ts
  const hero = b.hero;
  const speed = e.speed * speedMult(e);
  e.facing = angleOf({ x: hero.pos.x - e.pos.x, y: hero.pos.y - e.pos.y });
  const def = getEnemyDef(e.defId);
  const d = dist(e.pos, hero.pos);
  const reach = e.radius + hero.radius + ENEMY_COMMON.meleeReach;

  const shooter = e.archetype === 'shooter' ? def.shooter : undefined;
  const dash = e.archetype === 'fast' ? def.dash : undefined;

  if (shooter && !hasStatus(e, 'taunt')) {
    const band = ENEMY_COMMON.shooterBand;
    if (d > shooter.keepDistance + band) moveTowards(e, hero.pos, speed);
    else if (d < shooter.keepDistance - band) moveAway(e, hero.pos, speed * shooter.retreatSpeedMult);
    if (d <= shooter.range && e.attackTimer <= 0) {
      e.attackTimer = def.attackInterval;
      enemyShoot(b, e, shooter.projectileSpeed);
    }
    return;
  }

  if (dash) {
    if (e.dashTime > 0) {
      e.dashTime -= dt;
      e.vel.x = e.dashDir.x * speed * dash.speedMult;
      e.vel.y = e.dashDir.y * speed * dash.speedMult;
      if (d <= reach) tryMelee(b, e, def.attackInterval);
      return;
    }
    if (e.abilityTimer <= 0 && d > reach && d <= dash.trigger) {
      e.abilityTimer = dash.interval;
      e.dashTime = dash.duration;
      e.dashDir = normalize({ x: hero.pos.x - e.pos.x, y: hero.pos.y - e.pos.y });
      return;
    }
  }

  // chaser / tank / fast / taunted shooter: close in and hit.
  if (d > reach) {
    moveTowards(e, hero.pos, speed);
  } else if (shooter) {
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackInterval;
      enemyShoot(b, e, shooter.projectileSpeed);
    }
  } else {
    tryMelee(b, e, def.attackInterval);
  }
}

function tryMelee(b: Battle, e: Enemy, interval: number): void {
  if (e.attackTimer > 0) return;
  e.attackTimer = interval;
  damageHero(b, e.damage, { attacker: e, melee: true });
}

export function enemyShoot(b: Battle, e: Enemy, speed: number, at: Vec = b.hero.pos, kind = 'enemy'): void {
  const dir = normalize({ x: at.x - e.pos.x, y: at.y - e.pos.y });
  spawnProjectile(b, {
    pos: { x: e.pos.x + dir.x * e.radius, y: e.pos.y + dir.y * e.radius },
    vel: { x: dir.x * speed, y: dir.y * speed },
    radius: ENEMY_COMMON.projectileRadius,
    damage: e.damage,
    team: 'enemy',
    life: ENEMY_COMMON.projectileLife,
    pierce: 0,
    kind,
    melee: false,
  });
  b.events.emit({ type: 'enemyShot', pos: { ...e.pos } });
}

export function spawnProjectile(b: Battle, p: Omit<Projectile, 'id' | 'hit' | 'dead'>): Projectile {
  const proj: Projectile = { ...p, id: b.nextId++, hit: [], dead: false };
  b.projectiles.push(proj);
  return proj;
}

export function moveTowards(body: { pos: Vec; vel: Vec }, to: Vec, speed: number): void {
  const d = normalize({ x: to.x - body.pos.x, y: to.y - body.pos.y });
  body.vel.x = d.x * speed;
  body.vel.y = d.y * speed;
}

export function moveAway(body: { pos: Vec; vel: Vec }, from: Vec, speed: number): void {
  const d = normalize({ x: body.pos.x - from.x, y: body.pos.y - from.y });
  body.vel.x = d.x * speed;
  body.vel.y = d.y * speed;
}
