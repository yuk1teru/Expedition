// Archer skills: Multishot, Trap, Arrow Rain, Vault, Piercing Shot, Hunter's Mark,
// Net, Barrage.

import { spawnProjectile } from '../ai';
import { addStatus, heroDamage } from '../combat';
import { addBuff, addZone, startDash } from '../effects';
import { type Vec, dist, normalize } from '../entities';
import { bestConeAngle, enemiesInRadius, nearestEnemy, safestDirection } from '../targeting';
import type { Battle } from '../battle';
import { aimAngle, areaPoint, clampToArenaPoint, pointWithin, skillAmount, targetNearAim } from './common';
import type { SkillImpl } from './types';

function arrow(b: Battle, from: Vec, angle: number, speed: number, range: number, mult: number, pierce: number, kind = 'arrow'): void {
  const roll = heroDamage(b, mult, 'skill');
  spawnProjectile(b, {
    pos: { ...from },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: 5,
    damage: roll.amount,
    team: 'hero',
    life: range / speed,
    pierce,
    ricochet: 0,
    kind: roll.crit ? `${kind}Crit` : kind,
    melee: false,
    source: 'skill',
  });
}

/** A fan of arrows towards the cursor (bot: the direction that covers the most enemies). */
const multishot: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const width = (p.angle! * Math.PI) / 180;
  const angle = aim ? aimAngle(b, hero, aim) : (bestConeAngle(b.enemies, hero.pos, width, p.range!)?.angle ?? null);
  if (angle === null || !nearestEnemy(b.enemies, hero.pos)) return false;
  hero.facing = angle;
  for (let i = 0; i < p.count!; i++) {
    const a = angle + (p.count! === 1 ? 0 : (i / (p.count! - 1) - 0.5) * width);
    arrow(b, hero.pos, a, p.speed!, p.range!, p.damage!, p.pierce!);
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { x: hero.pos.x + Math.cos(angle) * p.range!, y: hero.pos.y + Math.sin(angle) * p.range! } });
  return true;
};

/** A trap near the cursor (bot: under its feet); the oldest one goes when there are too many. */
const hunterTrap: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  const pos = aim ? pointWithin(hero, aim, p.range!, 12) : { ...hero.pos };
  const mine = b.zones.filter((z) => !z.dead && z.kind === def.id);
  for (let i = 0; i <= mine.length - p.max!; i++) mine[i]!.dead = true;
  addZone(b, {
    kind: def.id,
    pos,
    radius: p.trigger!,
    duration: p.life!,
    tickInterval: p.life!,
    damage: 0,
    trigger: p.trigger!,
    finale: { kind: 'trapBlast', radius: p.radius!, damage: skillAmount(hero, p.damage!), slow: p.slow!, slowTime: p.slowTime!, stun: p.stun! },
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: pos });
  return true;
};

const arrowRain: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.radius!);
  if (!point) return false;
  addZone(b, {
    kind: def.id,
    pos: point,
    radius: p.radius!,
    duration: p.duration!,
    tickInterval: p.tick!,
    damage: skillAmount(hero, p.damage!),
    slow: p.slow!,
    slowTime: p.slow! > 0 ? 0.5 : 0,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

/** Leap away from the cursor (bot: from the crowd), then shoot towards the cursor (bot: the nearest enemy). */
const vault: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const nearest = nearestEnemy(b.enemies, hero.pos);
  if (!nearest) return false;
  let away = aim ? normalize({ x: hero.pos.x - aim.x, y: hero.pos.y - aim.y }) : safestDirection(b.enemies, hero.pos, 260);
  if (!away || (away.x === 0 && away.y === 0)) away = normalize({ x: hero.pos.x - nearest.pos.x, y: hero.pos.y - nearest.pos.y });
  if (away.x === 0 && away.y === 0) away = { x: 0, y: 1 };
  const dest = clampToArenaPoint({ x: hero.pos.x + away.x * p.range!, y: hero.pos.y + away.y * p.range! }, hero.radius);
  const target = aim ? { ...aim } : null;
  const from = { ...hero.pos };
  if (p.frenzy! > 0) addBuff(hero, { id: 'frenzy', time: p.frenzyTime!, attackSpeedMult: 1 + p.frenzy!, damageTakenMult: 1 });
  startDash(hero, dest, p.speed!, () => {
    const t = target ?? nearestEnemy(b.enemies, hero.pos)?.pos;
    if (!t) return;
    const angle = Math.atan2(t.y - hero.pos.y, t.x - hero.pos.x);
    hero.facing = angle;
    const shots = 1 + p.extraShots!;
    const step = (p.spreadDeg! * Math.PI) / 180;
    for (let i = 0; i < shots; i++) arrow(b, hero.pos, angle + (i - (shots - 1) / 2) * step, p.arrowSpeed!, 420, p.damage!, 0);
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: from, target: dest });
  return true;
};

/** A heavy arrow through every enemy on its line. */
const piercingShot: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const angle = aim ? aimAngle(b, hero, aim) : (bestConeAngle(b.enemies, hero.pos, 0.2, p.range!)?.angle ?? null);
  if (angle === null || !nearestEnemy(b.enemies, hero.pos)) return false;
  hero.facing = angle;
  const roll = heroDamage(b, p.damage!, 'skill');
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: Math.cos(angle) * p.speed!, y: Math.sin(angle) * p.speed! },
    radius: 8,
    damage: roll.amount,
    team: 'hero',
    life: p.range! / p.speed!,
    pierce: 999,
    pierceMult: p.growth!,
    ricochet: 0,
    kind: roll.crit ? 'bigArrowCrit' : 'bigArrow',
    melee: false,
    source: 'skill',
    onHit: p.vuln! > 0 ? { id: 'vuln', time: p.vulnTime!, value: p.vuln! } : undefined,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { x: hero.pos.x + Math.cos(angle) * p.range!, y: hero.pos.y + Math.sin(angle) * p.range! } });
  return true;
};

/** Marks the enemy nearest the cursor (bot: the boss, else the nearest): it takes more damage. */
const hunterMark: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const boss = !aim ? b.enemies.find((e) => !e.dead && e.boss && dist(e.pos, hero.pos) <= p.range!) : undefined;
  const target = boss ?? targetNearAim(b, hero, aim, p.range!);
  if (!target) return false;
  const marked = p.spread! > 0 ? [target, ...enemiesInRadius(b.enemies, target.pos, p.spreadRadius!).filter((e) => e !== target)] : [target];
  for (const e of marked) {
    addStatus(e, 'vuln', p.duration!, p.vuln!);
    if (p.slow! > 0) addStatus(e, 'slow', p.duration!, p.slow!);
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { ...target.pos } });
  return true;
};

/** A net that opens on the first enemy or at the point and binds everyone inside. */
const net: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.radius!);
  if (!point) return false;
  const d = Math.max(1, dist(hero.pos, point));
  const dir = { x: (point.x - hero.pos.x) / d, y: (point.y - hero.pos.y) / d };
  hero.facing = Math.atan2(dir.y, dir.x);
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: dir.x * p.speed!, y: dir.y * p.speed! },
    radius: 10,
    damage: 0,
    team: 'hero',
    life: d / p.speed!,
    pierce: 0,
    ricochet: 0,
    kind: 'net',
    melee: false,
    source: 'skill',
    explode: { kind: 'net', radius: p.radius!, damage: p.damage! > 0 ? skillAmount(hero, p.damage!) : 0, stun: p.stun!, vuln: p.vuln!, vulnTime: p.vulnTime! },
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

const barrage: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addBuff(hero, {
    id: def.id,
    time: p.duration!,
    attackSpeedMult: 1 + p.attackSpeed!,
    damageTakenMult: 1,
    damageMult: 1 + p.damageBonus!,
    pierceBonus: p.pierce!,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

export const ARCHER_SKILLS: Record<string, SkillImpl> = {
  multishot,
  hunterTrap,
  arrowRain,
  vault,
  piercingShot,
  hunterMark,
  net,
  barrage,
};
