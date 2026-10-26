// Warrior skills: Whirlwind, Charge, Battle Cry, Ground Slam.

import { ARENA } from '../../data/balance';
import { addStatus, damageEnemy, heroDamage } from '../combat';
import { addBuff, addZone, startDash } from '../effects';
import { dist } from '../entities';
import { bestConeAngle, coneTargets, densestPoint, enemiesInRadius, nearestEnemy } from '../targeting';
import type { SkillImpl } from './types';

const whirlwind: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos, p.castRange!)) return false;
  addZone(b, {
    kind: def.id,
    pos: hero.pos,
    radius: p.radius!,
    followHero: true,
    duration: p.duration!,
    tickInterval: p.tick!,
    damage: hero.stats.attack * p.damage! * hero.stats.skillDamageMult,
    pull: p.pull!,
    tickNow: true,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

const charge: SkillImpl = ({ b, hero, p, def, rank }) => {
  const target = densestPoint(b.enemies, p.radius!, hero.pos, p.range!);
  if (!target) return false;
  const dest = {
    x: Math.max(ARENA.x + hero.radius, Math.min(ARENA.x + ARENA.w - hero.radius, target.pos.x)),
    y: Math.max(ARENA.y + hero.radius, Math.min(ARENA.y + ARENA.h - hero.radius, target.pos.y)),
  };
  const from = { ...hero.pos };
  if (p.trail! > 0) {
    const len = dist(from, dest);
    const steps = Math.max(1, Math.floor(len / p.trailSpacing!));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      addZone(b, {
        kind: 'fireTrail',
        pos: { x: from.x + (dest.x - from.x) * t, y: from.y + (dest.y - from.y) * t },
        radius: p.trailRadius!,
        duration: p.trailDuration!,
        tickInterval: p.trailTick!,
        damage: hero.stats.attack * p.trailDamage! * hero.stats.skillDamageMult,
      });
    }
  }
  startDash(hero, dest, p.speed!, () => {
    for (const e of enemiesInRadius(b.enemies, hero.pos, p.radius!)) {
      damageEnemy(b, e, heroDamage(b, p.damage!, 'skill'), { source: 'skill', knockFrom: hero.pos, knockback: p.knockback! });
      if (!e.dead) addStatus(e, 'stun', p.stun!);
    }
    b.events.emit({ type: 'skillTick', skillId: def.id, pos: { ...hero.pos }, radius: p.radius! });
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: from, target: dest });
  return true;
};

const battleCry: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addBuff(hero, {
    id: def.id,
    time: p.duration!,
    attackSpeedMult: 1 + p.attackSpeed!,
    damageTakenMult: 1 - p.damageReduction!,
  });
  for (const e of enemiesInRadius(b.enemies, hero.pos, p.tauntRadius!)) addStatus(e, 'taunt', p.duration!);
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

const groundSlam: SkillImpl = ({ b, hero, p, def, rank }) => {
  const width = (p.angle! * Math.PI) / 180;
  const best = bestConeAngle(b.enemies, hero.pos, width, p.range!);
  if (!best) return false;
  hero.facing = best.angle;
  for (const e of coneTargets(b.enemies, hero.pos, best.angle, width, p.range!)) {
    damageEnemy(b, e, heroDamage(b, p.damage!, 'skill'), { source: 'skill', knockFrom: hero.pos, knockback: p.knockback! });
    if (!e.dead && p.stun! > 0) addStatus(e, 'stun', p.stun!);
  }
  const target = { x: hero.pos.x + Math.cos(best.angle) * p.range!, y: hero.pos.y + Math.sin(best.angle) * p.range! };
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target });
  return true;
};

export const WARRIOR_SKILLS: Record<string, SkillImpl> = {
  whirlwind,
  charge,
  battleCry,
  groundSlam,
};
