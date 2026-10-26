// Hero auto-combat AI (melee and ranged) and enemy archetype AI.

import { ENEMY_COMMON, HERO } from '../data/balance';
import { getEnemyDef } from '../data/enemies';
import type { Battle } from './battle';
import { damageEnemy, damageHero, hasStatus, heroDamage, isDisabled, speedMult } from './combat';
import type { Enemy, Hero, Projectile, Vec } from './entities';
import { angleOf, dist, normalize } from './entities';
import { basicAttackOf } from './hero';
import { coneTargets, nearestEnemy } from './targeting';

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
  if (b.input.control === 'player') {
    playerHero(b, hero);
    return;
  }
  const target = nearestEnemy(b.enemies, hero.pos);
  const move = b.input.move;
  if (move.x !== 0 || move.y !== 0) {
    // Player steers: run where told, keep auto-attacking whatever is in reach.
    const speed = hero.stats.moveSpeed * speedMult(hero);
    hero.vel.x = move.x * speed;
    hero.vel.y = move.y * speed;
    hero.facing = angleOf(move);
    if (target) {
      if (hero.stats.ranged) tryShoot(b, hero, target);
      else tryMeleeHit(b, hero, target);
    }
    return;
  }
  if (!target) return;
  if (hero.stats.ranged) rangedHero(b, hero, target);
  else meleeHero(b, hero, target);
}

/**
 * Player control: the hero only moves where told and auto-attacks towards the
 * cursor; with the cursor off the arena it keeps attacking in the last direction.
 */
function playerHero(b: Battle, hero: Hero): void {
  const move = b.input.move;
  const speed = hero.stats.moveSpeed * speedMult(hero);
  hero.vel.x = move.x * speed;
  hero.vel.y = move.y * speed;
  const aim = b.input.aim;
  if (aim && (aim.x !== hero.pos.x || aim.y !== hero.pos.y)) hero.facing = angleOf({ x: aim.x - hero.pos.x, y: aim.y - hero.pos.y });
  if (hero.attackTimer > 0) return;
  if (hero.stats.ranged) {
    const cone = (HERO.rangedAimConeDeg * Math.PI) / 180;
    if (coneTargets(b.enemies, hero.pos, hero.facing, cone, hero.stats.range).length > 0) shootAlong(b, hero, hero.facing);
    return;
  }
  const attack = basicAttackOf(hero);
  if (attack.kind !== 'melee') return;
  const arc = (attack.arcDeg * Math.PI) / 180;
  const target = nearestEnemy(coneTargets(b.enemies, hero.pos, hero.facing, arc, hero.stats.range), hero.pos);
  if (target) meleeStrike(b, hero, target, hero.facing);
}

/**
 * One basic melee strike towards `angle`: full damage to `target`, the class
 * splash to every other enemy inside the attack arc.
 */
function meleeStrike(b: Battle, hero: Hero, target: Enemy, angle: number): void {
  const attack = basicAttackOf(hero);
  const arc = attack.kind === 'melee' ? (attack.arcDeg * Math.PI) / 180 : 0;
  const splash = attack.kind === 'melee' ? attack.splash : 0;
  hero.attackTimer = 1 / heroAttackSpeed(hero);
  const others = splash > 0 ? coneTargets(b.enemies, hero.pos, angle, arc, hero.stats.range).filter((e) => e !== target) : [];
  b.events.emit({
    type: 'heroAttack',
    pos: { ...hero.pos },
    angle,
    reach: hero.stats.range + hero.radius,
    arc,
    ranged: false,
    targets: 1 + others.length,
  });
  const roll = heroDamage(b, 1, 'basic');
  damageEnemy(b, target, roll, { source: 'basic', knockFrom: hero.pos, knockback: HERO.meleeKnockback });
  for (const e of others) {
    damageEnemy(b, e, { amount: roll.amount * splash, crit: roll.crit }, { source: 'splash', knockFrom: hero.pos, knockback: HERO.meleeKnockback });
  }
}

/** Hits the target if it is in melee reach and the attack is ready. Returns true if in reach. */
function tryMeleeHit(b: Battle, hero: Hero, target: Enemy): boolean {
  if (dist(hero.pos, target.pos) - target.radius > hero.stats.range) return false;
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  if (hero.attackTimer <= 0) meleeStrike(b, hero, target, hero.facing);
  return true;
}

/** Melee: walk to the nearest enemy, hit it when in reach. Never dodges on its own. */
function meleeHero(b: Battle, hero: Hero, target: Enemy): void {
  if (tryMeleeHit(b, hero, target)) return;
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
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
    moveAway(hero, target.pos, speed * r.backpedalMult);
  }
  tryShoot(b, hero, target);
}

function tryShoot(b: Battle, hero: Hero, target: Enemy): void {
  if (dist(hero.pos, target.pos) > hero.stats.range || hero.attackTimer > 0) return;
  shootAlong(b, hero, angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y }));
}

function shootAlong(b: Battle, hero: Hero, angle: number): void {
  const r = HERO.ranged;
  hero.attackTimer = 1 / heroAttackSpeed(hero);
  b.events.emit({ type: 'heroAttack', pos: { ...hero.pos }, angle, reach: hero.radius * 2, arc: 0, ranged: true, targets: 1 });
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const roll = heroDamage(b, 1, 'basic');
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: dir.x * r.projectileSpeed, y: dir.y * r.projectileSpeed },
    radius: r.projectileRadius,
    damage: roll.amount,
    team: 'hero',
    life: hero.stats.range / r.projectileSpeed + r.projectileLifePad,
    pierce: 0,
    ricochet: 0,
    kind: roll.crit ? 'heroCrit' : 'hero',
    melee: false,
  });
}

export function updateEnemyAI(b: Battle, e: Enemy, dt: number): void {
  // Bosses and minibosses are driven entirely by boss.ts (movement included).
  if (e.boss) return;
  e.attackTimer = Math.max(0, e.attackTimer - dt);
  e.abilityTimer = Math.max(0, e.abilityTimer - dt);
  e.vel.x = 0;
  e.vel.y = 0;
  if (e.dead || b.hero.dead || isDisabled(e)) {
    e.dashTime = 0;
    return;
  }
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
    ricochet: 0,
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
