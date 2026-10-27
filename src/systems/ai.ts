// Hero auto-combat AI (melee and ranged) and enemy archetype AI.

import { ARENA, ENEMY_COMMON, HERO } from '../data/balance';
import { ENEMIES, type EnemyDef, getEnemyDef } from '../data/enemies';
import type { Battle } from './battle';
import { addTelegraph, telegraphContains } from './boss';
import { addStatus, damageEnemy, damageHero, debuffHero, hasStatus, heroDamage, isDisabled, speedMult } from './combat';
import type { Ally, Enemy, Hero, Projectile, Vec } from './entities';
import { damageAlly } from './allies';
import { igniteFor } from './promotion';
import { angleOf, dist, normalize } from './entities';
import { basicAttackOf, heroMoveSpeed } from './hero';
import { coneTargets, nearestEnemy } from './targeting';

/** Effective attacks per second including buffs. */
export function heroAttackSpeed(hero: Hero): number {
  let s = hero.stats.attackSpeed;
  for (const b of hero.buffs) s *= b.attackSpeedMult;
  return s;
}

/** Current walking speed: buffs, slows; 0 while rooted. */
export function heroWalkSpeed(hero: Hero): number {
  return hasStatus(hero, 'root') ? 0 : heroMoveSpeed(hero) * speedMult(hero);
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
    const speed = heroWalkSpeed(hero);
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
  avoidPuddles(b, hero);
}

/** Bot: does not walk into boss puddles (stepping out of one is the dodge's job). */
function avoidPuddles(b: Battle, hero: Hero): void {
  if (b.hazards.length === 0 || (hero.vel.x === 0 && hero.vel.y === 0)) return;
  const ahead = { x: hero.pos.x + hero.vel.x * 0.2, y: hero.pos.y + hero.vel.y * 0.2 };
  const blocked = b.hazards.some(
    (h) => !h.ring && dist(ahead, h.pos) <= h.radius + hero.radius && dist(hero.pos, h.pos) > h.radius + hero.radius,
  );
  if (blocked) {
    hero.vel.x = 0;
    hero.vel.y = 0;
  }
}

/**
 * Player control: the hero only moves where told and auto-attacks towards the
 * cursor; with the cursor off the arena it keeps attacking in the last direction.
 */
function playerHero(b: Battle, hero: Hero): void {
  const move = b.input.move;
  const speed = heroWalkSpeed(hero);
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
  const target = nearestEnemy(coneTargets(b.enemies, hero.pos, hero.facing, arc, meleeReach(hero)), hero.pos);
  if (target) meleeStrike(b, hero, target, hero.facing);
}

/**
 * Melee reach from the hero's centre: the class range counts from the hero's edge,
 * exactly the wedge drawn on the arena. An enemy is hit if any part of it is inside.
 */
export function meleeReach(hero: Hero): number {
  return hero.stats.range + hero.radius;
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
  const others = splash > 0 ? coneTargets(b.enemies, hero.pos, angle, arc, meleeReach(hero)).filter((e) => e !== target) : [];
  b.events.emit({
    type: 'heroAttack',
    pos: { ...hero.pos },
    angle,
    reach: meleeReach(hero),
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
  if (dist(hero.pos, target.pos) - target.radius > meleeReach(hero)) return false;
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  if (hero.attackTimer <= 0) meleeStrike(b, hero, target, hero.facing);
  return true;
}

/** Melee: walk to the nearest enemy, hit it when in reach. Never dodges on its own. */
function meleeHero(b: Battle, hero: Hero, target: Enemy): void {
  if (tryMeleeHit(b, hero, target)) return;
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  moveTowards(hero, target.pos, heroWalkSpeed(hero));
}

/** Ranged: keep a distance band, back off from close enemies, shoot within range. */
function rangedHero(b: Battle, hero: Hero, target: Enemy): void {
  const r = HERO.ranged;
  const d = dist(hero.pos, target.pos);
  hero.facing = angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y });
  const speed = heroWalkSpeed(hero);
  if (d < r.retreatBelow) {
    moveAway(hero, target.pos, speed);
  } else if (d > r.keepMax) {
    moveTowards(hero, target.pos, speed);
  } else if (d < r.keepMin) {
    moveAway(hero, target.pos, speed * r.backpedalMult);
  }
  slideAlongWalls(hero);
  tryShoot(b, hero, target);
}

/**
 * Backing off into a wall corners the bot: near the arena edge the push into the wall
 * turns into a slide along it (towards the arena centre side), so it keeps kiting.
 */
function slideAlongWalls(hero: Hero): void {
  const m = HERO.ranged.wallSlide;
  const v = hero.vel;
  if (v.x === 0 && v.y === 0) return;
  const cx = ARENA.x + ARENA.w / 2;
  const cy = ARENA.y + ARENA.h / 2;
  const nearX = hero.pos.x < ARENA.x + m || hero.pos.x > ARENA.x + ARENA.w - m;
  const nearY = hero.pos.y < ARENA.y + m || hero.pos.y > ARENA.y + ARENA.h - m;
  const speed = Math.hypot(v.x, v.y);
  if (nearX && Math.sign(v.x) === Math.sign(hero.pos.x - cx)) {
    v.x = 0;
    v.y = (Math.sign(v.y) || Math.sign(cy - hero.pos.y) || 1) * speed;
  }
  if (nearY && Math.sign(v.y) === Math.sign(hero.pos.y - cy)) {
    v.y = 0;
    v.x = (Math.sign(v.x) || Math.sign(cx - hero.pos.x) || 1) * speed;
  }
}

function tryShoot(b: Battle, hero: Hero, target: Enemy): void {
  if (dist(hero.pos, target.pos) > hero.stats.range || hero.attackTimer > 0) return;
  shootAlong(b, hero, angleOf({ x: target.pos.x - hero.pos.x, y: target.pos.y - hero.pos.y }));
}

/** One basic shot of a ranged class (Mage bolt, Archer arrow) along `angle`. */
function shootAlong(b: Battle, hero: Hero, angle: number): void {
  const attack = basicAttackOf(hero);
  const def = attack.kind === 'ranged' ? attack : null;
  const speed = def?.speed ?? HERO.ranged.projectileSpeed;
  hero.attackTimer = 1 / heroAttackSpeed(hero);
  b.events.emit({ type: 'heroAttack', pos: { ...hero.pos }, angle, reach: hero.radius * 2, arc: 0, ranged: true, targets: 1 });
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const roll = heroDamage(b, 1, 'basic');
  const kind = def?.projectile ?? 'hero';
  // Pyromancer: the bolt sets the target and the splash on fire.
  const burn = kind === 'bolt' ? igniteFor(hero, 'bolt') : {};
  let pierceBonus = 0;
  for (const buff of hero.buffs) pierceBonus += buff.pierceBonus ?? 0;
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: dir.x * speed, y: dir.y * speed },
    radius: def?.radius ?? HERO.ranged.projectileRadius,
    damage: roll.amount,
    team: 'hero',
    life: hero.stats.range / speed + HERO.ranged.projectileLifePad,
    pierce: (def?.pierce ?? 0) + hero.stats.pierce + pierceBonus,
    pierceMult: def?.pierceMult,
    ricochet: 0,
    kind: roll.crit ? `${kind}Crit` : kind,
    melee: false,
    explode:
      def && def.splash > 0
        ? { kind: 'boltSplash', radius: def.splashRadius, damage: roll.amount * def.splash, excludeHit: true, ...burn }
        : undefined,
    onHit: burn.burn ? { id: 'burn', time: burn.burnTime ?? 0, value: burn.burn } : undefined,
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
    // A stun interrupts a dash or a crouch.
    e.dashTime = 0;
    e.windup = 0;
    return;
  }
  const hero = b.hero;
  const def = getEnemyDef(e.defId);
  const shooter = e.archetype === 'shooter' ? def.shooter : undefined;
  const dash = e.archetype === 'fast' ? def.dash : undefined;
  if (e.windup > 0) {
    // Telling a move: the enemy stands still (wolf crouch, stump stomp).
    e.windup -= dt;
    if (e.windup <= 0 && dash) e.dashTime = dash.duration;
    return;
  }
  const speed = e.speed * speedMult(e);
  e.facing = angleOf({ x: hero.pos.x - e.pos.x, y: hero.pos.y - e.pos.y });
  const d = dist(e.pos, hero.pos);
  const reach = e.radius + hero.radius + ENEMY_COMMON.meleeReach;

  if (shooter && !hasStatus(e, 'taunt')) {
    const band = ENEMY_COMMON.shooterBand;
    if (d > shooter.keepDistance + band) moveTowards(e, hero.pos, speed);
    else if (d < shooter.keepDistance - band) moveAway(e, hero.pos, speed * shooter.retreatSpeedMult);
    if (d <= shooter.range && e.attackTimer <= 0) {
      e.attackTimer = def.attackInterval;
      shooterFire(b, e, def);
    }
    return;
  }

  if (dash) {
    if (e.dashTime > 0) {
      e.dashTime -= dt;
      e.vel.x = e.dashDir.x * speed * dash.speedMult;
      e.vel.y = e.dashDir.y * speed * dash.speedMult;
      if (d <= reach) tryMelee(b, e, def);
      return;
    }
    if (e.abilityTimer <= 0 && d > reach && d <= dash.trigger) {
      // Crouch first (visible), then leap where the hero was: a sidestep dodges it.
      e.abilityTimer = dash.interval;
      e.windup = dash.windup;
      e.dashDir = normalize({ x: hero.pos.x - e.pos.x, y: hero.pos.y - e.pos.y });
      return;
    }
  }

  // chaser / tank / fast / taunted shooter: close in and hit — the hero or a wolf, whichever is nearer.
  const wolf = nearestAllyTarget(b, e, d);
  if (wolf) {
    const wolfReach = e.radius + wolf.radius + ENEMY_COMMON.meleeReach;
    e.facing = angleOf({ x: wolf.pos.x - e.pos.x, y: wolf.pos.y - e.pos.y });
    if (dist(e.pos, wolf.pos) > wolfReach) moveTowards(e, wolf.pos, speed);
    else if (e.attackTimer <= 0) {
      e.attackTimer = def.attackInterval;
      damageAlly(b, wolf, e.damage);
    }
    return;
  }
  if (def.stomp) {
    // Tanks stomp around themselves: start when the hero is in reach of the stomp circle.
    const stompR = e.radius + def.stomp.reach;
    if (d > stompR + hero.radius * 0.5) moveTowards(e, hero.pos, speed);
    else if (e.attackTimer <= 0) startStomp(b, e, def);
    return;
  }
  if (d > reach) {
    moveTowards(e, hero.pos, speed);
  } else if (shooter) {
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackInterval;
      shooterFire(b, e, def);
    }
  } else {
    tryMelee(b, e, def);
  }
}

/** A wolf closer to this enemy than the hero (taunted enemies only see the hero). */
function nearestAllyTarget(b: Battle, e: Enemy, heroDist: number): Ally | null {
  if (b.allies.length === 0 || hasStatus(e, 'taunt')) return null;
  let best: Ally | null = null;
  let bestD = heroDist;
  for (const a of b.allies) {
    if (a.dead) continue;
    const d = dist(e.pos, a.pos);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function tryMelee(b: Battle, e: Enemy, def: EnemyDef): void {
  if (e.attackTimer > 0) return;
  e.attackTimer = def.attackInterval;
  const dealt = damageHero(b, e.damage, { attacker: e, melee: true });
  if (dealt > 0 && def.cripple) debuffHero(b, 'slow', def.cripple.time, def.cripple.slow);
  if (dealt > 0 && def.poison) addStatus(b.hero, 'poison', def.poison.time, e.damage * def.poison.dps);
}

function startStomp(b: Battle, e: Enemy, def: EnemyDef): void {
  const st = def.stomp!;
  e.attackTimer = def.attackInterval;
  e.windup = st.delay;
  // A crippling tank (Bogman) also slows the hero its stomp catches.
  const cripple = def.cripple;
  const t = addTelegraph(b, 'stomp', e.pos, e.radius + st.reach, e.damage * st.damage, st.delay, cripple
    ? () => {
        if (telegraphContains(t, b.hero.pos, b.hero.radius * 0.5)) debuffHero(b, 'slow', cripple.time, cripple.slow);
      }
    : undefined);
  t.ownerId = e.id;
}

/** A shot, or every N-th time a fan of shots. */
function shooterFire(b: Battle, e: Enemy, def: EnemyDef): void {
  const shooter = def.shooter!;
  e.shots += 1;
  const v = def.volley;
  if (!v || e.shots % v.every !== 0) {
    enemyShoot(b, e, shooter.projectileSpeed);
    return;
  }
  const base = angleOf({ x: b.hero.pos.x - e.pos.x, y: b.hero.pos.y - e.pos.y });
  const step = (v.spreadDeg * Math.PI) / 180;
  for (let i = 0; i < v.count; i++) {
    const a = base + (i - (v.count - 1) / 2) * step;
    enemyShoot(b, e, shooter.projectileSpeed, { x: e.pos.x + Math.cos(a) * 100, y: e.pos.y + Math.sin(a) * 100 });
  }
}

/** The next shot of this shooter is a volley (render: bigger glow). */
export function nextShotIsVolley(e: Enemy): boolean {
  const v = getEnemyDef(e.defId).volley;
  return !!v && (e.shots + 1) % v.every === 0;
}

export function enemyShoot(b: Battle, e: Enemy, speed: number, at: Vec = b.hero.pos, kind = 'enemy'): void {
  const dir = normalize({ x: at.x - e.pos.x, y: at.y - e.pos.y });
  const def = e.boss ? undefined : ENEMIES[e.defId];
  spawnProjectile(b, {
    pos: { x: e.pos.x + dir.x * e.radius, y: e.pos.y + dir.y * e.radius },
    vel: { x: dir.x * speed, y: dir.y * speed },
    radius: ENEMY_COMMON.projectileRadius,
    damage: e.damage,
    team: 'enemy',
    life: ENEMY_COMMON.projectileLife,
    pierce: 0,
    ricochet: 0,
    kind: def?.shotKind ?? kind,
    melee: false,
    slow: def?.shotSlow,
    owner: e.boss?.defId ?? e.defId,
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
