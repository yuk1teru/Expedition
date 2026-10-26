// Mage skills: Fireball, Frost Ring, Chain Lightning, Teleport, Magic Missiles,
// Ice Barrier, Flame Wall, Vortex.

import { spawnProjectile } from '../ai';
import { addStatus, damageEnemy, heroDamage } from '../combat';
import { addBuff, addZone, blast, teleport as teleportHero } from '../effects';
import { type Enemy, type Vec, dist } from '../entities';
import { nearestEnemy, safestDirection } from '../targeting';
import { areaPoint, clampToArenaPoint, pointWithin, skillAmount, targetNearAim } from './common';
import type { SkillImpl } from './types';

/** A ball that flies to the point and bursts on the first enemy or where it stops. */
const fireball: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.radius!);
  if (!point) return false;
  const d = Math.max(1, dist(hero.pos, point));
  const dir = { x: (point.x - hero.pos.x) / d, y: (point.y - hero.pos.y) / d };
  hero.facing = Math.atan2(dir.y, dir.x);
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: dir.x * p.speed!, y: dir.y * p.speed! },
    radius: 9,
    damage: 0,
    team: 'hero',
    life: d / p.speed!,
    pierce: 0,
    ricochet: 0,
    kind: 'fireball',
    melee: false,
    source: 'skill',
    explode: {
      kind: 'fireball',
      radius: p.radius!,
      damage: skillAmount(hero, p.damage!),
      stun: p.stun!,
      knockback: p.knockback!,
      zone:
        p.ground! > 0
          ? { kind: 'burnGround', radius: p.radius! * 0.8, duration: p.groundTime!, tickInterval: p.groundTick!, damage: skillAmount(hero, p.groundDamage!) }
          : undefined,
    },
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

/** Freezes everyone around the hero; rank 5 leaves a slowing frost field. */
const frostRing: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos, p.castRange!)) return false;
  blast(b, hero.pos, { kind: 'frostRing', radius: p.radius!, damage: skillAmount(hero, p.damage!), freeze: p.freeze! });
  if (p.field! > 0) {
    addZone(b, { kind: 'frostField', pos: hero.pos, radius: p.radius!, duration: p.fieldTime!, tickInterval: 0.25, damage: 0, slow: p.fieldSlow!, slowTime: 0.5, tickNow: true });
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Hits the enemy nearest the cursor, then jumps to the nearest enemy not hit yet. */
const chainLightning: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const first = targetNearAim(b, hero, aim, p.range!);
  if (!first) return false;
  const points: Vec[] = [{ ...hero.pos }];
  const hit = new Set<number>();
  let current: Enemy | null = first;
  for (let i = 0; i < p.jumps! && current; i++) {
    hit.add(current.id);
    points.push({ ...current.pos });
    const mult = p.damage! * Math.pow(1 - p.falloff!, i);
    damageEnemy(b, current, heroDamage(b, mult, 'skill'), { source: 'skill' });
    if (!current.dead && p.stun! > 0) addStatus(current, 'stun', p.stun!);
    const from: Vec = current.pos;
    current = nearestEnemy(b.enemies.filter((e) => !hit.has(e.id)), from, p.jumpRange!);
  }
  hero.facing = Math.atan2(first.pos.y - hero.pos.y, first.pos.x - hero.pos.x);
  b.events.emit({ type: 'chain', skillId: def.id, points });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { ...first.pos } });
  return true;
};

/** Instant move to the cursor (bot: away from the crowd) with a short invulnerability. */
const teleport: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  let dest: Vec;
  if (aim) dest = pointWithin(hero, aim, p.range!, hero.radius);
  else {
    const away = safestDirection(b.enemies, hero.pos, 260) ?? { x: 0, y: 1 };
    dest = clampToArenaPoint({ x: hero.pos.x + away.x * p.range!, y: hero.pos.y + away.y * p.range! }, hero.radius);
  }
  if (dist(dest, hero.pos) < 4) return false;
  const from = { ...hero.pos };
  if (p.blastDamage! > 0) blast(b, from, { kind: 'blinkBlast', radius: p.blastRadius!, damage: skillAmount(hero, p.blastDamage!) });
  teleportHero(hero, dest, p.invuln!);
  if (p.empower! > 0) addBuff(hero, { id: 'empower', time: p.empowerTime!, attackSpeedMult: 1, damageTakenMult: 1, damageMult: 1 + p.empower! });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: from, target: { ...hero.pos } });
  return true;
};

/** Homing missiles at the enemies closest to the cursor (more missiles than targets: they double up). */
const magicMissiles: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const from = aim ?? hero.pos;
  const targets = b.enemies
    .filter((e) => !e.dead && dist(e.pos, hero.pos) <= p.range! + e.radius)
    .sort((x, y) => dist(x.pos, from) - dist(y.pos, from));
  if (targets.length === 0) return false;
  for (let i = 0; i < p.count!; i++) {
    const t = targets[i % targets.length]!;
    // Fan the missiles out a little; homing brings them back onto the target.
    const base = Math.atan2(t.pos.y - hero.pos.y, t.pos.x - hero.pos.x);
    const a = base + (i - (p.count! - 1) / 2) * 0.25;
    const roll = heroDamage(b, p.damage!, 'skill');
    spawnProjectile(b, {
      pos: { ...hero.pos },
      vel: { x: Math.cos(a) * p.speed!, y: Math.sin(a) * p.speed! },
      radius: 6,
      damage: roll.amount,
      team: 'hero',
      life: (p.range! * 1.5) / p.speed!,
      pierce: 0,
      ricochet: p.ricochet!,
      kind: roll.crit ? 'missileCrit' : 'missile',
      melee: false,
      source: 'skill',
      homingId: t.id,
    });
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { ...targets[0]!.pos } });
  return true;
};

/** A barrier that absorbs damage; rank 3 bursts with cold when broken, rank 5 freezes melee attackers. */
const iceBarrier: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addBuff(hero, {
    id: def.id,
    time: p.duration!,
    attackSpeedMult: 1,
    damageTakenMult: 1,
    shield: hero.maxHp * p.shield!,
    breakBlast: p.nova! > 0 ? { kind: 'frostNova', radius: p.novaRadius!, damage: 0, slow: p.novaSlow!, slowTime: p.novaTime! } : undefined,
    freezeAttackers: p.freezeAttackers! > 0 ? p.freezeAttackers! : undefined,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** A wall of fire across the direction to the cursor. */
const flameWall: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.length! / 2);
  if (!point) return false;
  const angle = dist(point, hero.pos) > 1 ? Math.atan2(point.y - hero.pos.y, point.x - hero.pos.x) : hero.facing;
  const half = p.length! / 2;
  const nx = -Math.sin(angle) * half;
  const ny = Math.cos(angle) * half;
  const a = clampToArenaPoint({ x: point.x + nx, y: point.y + ny }, 0);
  const c = clampToArenaPoint({ x: point.x - nx, y: point.y - ny }, 0);
  addZone(b, {
    kind: 'flameWall',
    pos: point,
    radius: p.segment! / 2,
    line: { a, b: c },
    duration: p.duration!,
    tickInterval: p.tick!,
    damage: skillAmount(hero, p.damage!),
    burn: p.burn! > 0 ? skillAmount(hero, p.burnDps!) : 0,
    burnTime: p.burnTime!,
    slow: p.slow!,
    slowTime: p.slow! > 0 ? p.tick! + 0.1 : 0,
    tickNow: true,
  });
  hero.facing = angle;
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

/** Pulls enemies into a point and grinds them; rank 5 ends with a blast. */
const vortex: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.radius!);
  if (!point) return false;
  addZone(b, {
    kind: 'vortex',
    pos: point,
    radius: p.radius!,
    duration: p.duration!,
    tickInterval: p.tick!,
    damage: skillAmount(hero, p.damage!),
    pull: p.pull!,
    tickNow: true,
    finale: p.finale! > 0 ? { kind: 'vortexBlast', radius: p.radius!, damage: skillAmount(hero, p.finaleDamage!) } : undefined,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

export const MAGE_SKILLS: Record<string, SkillImpl> = {
  fireball,
  frostRing,
  chainLightning,
  teleport,
  magicMissiles,
  iceBarrier,
  flameWall,
  vortex,
};
