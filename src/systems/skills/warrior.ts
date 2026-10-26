// Warrior skills: Whirlwind, Charge, Battle Cry, Ground Slam.

import { ARENA } from '../../data/balance';
import { spawnProjectile } from '../ai';
import { addStatus, damageEnemy, healHero, heroDamage, pull } from '../combat';
import { addBuff, addZone, startDash } from '../effects';
import type { SkillParams } from '../../data/skills';
import type { Battle } from '../battle';
import { type Hero, type Vec, dist, distToSegment } from '../entities';
import { bestConeAngle, coneTargets, densePoints, enemiesInRadius, nearestEnemy } from '../targeting';
import { telegraphContains } from '../boss';
import { heroAttack } from '../hero';
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
    damage: heroAttack(hero) * p.damage! * hero.stats.skillDamageMult,
    pull: p.pull!,
    tickNow: true,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

const charge: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const dest = aim ? aimedLanding(hero, aim, p.range!) : chargeLanding(b, hero, p);
  if (!dest) return false;
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
        damage: heroAttack(hero) * p.trailDamage! * hero.stats.skillDamageMult,
      });
    }
  }
  startDash(hero, dest, p.speed!, () => {
    // Everyone the hero ran through, plus everyone around the landing spot, is hit once.
    const hit = new Set(enemiesInRadius(b.enemies, hero.pos, p.radius!));
    for (const e of b.enemies) {
      if (!e.dead && distToSegment(e.pos, from, dest) <= p.pathWidth! / 2 + e.radius) hit.add(e);
    }
    for (const e of hit) {
      damageEnemy(b, e, heroDamage(b, p.damage!, 'skill'), { source: 'skill', knockFrom: hero.pos, knockback: p.knockback! });
      if (!e.dead) addStatus(e, 'stun', p.stun!);
    }
    b.events.emit({ type: 'skillTick', skillId: def.id, pos: { ...hero.pos }, radius: p.radius! });
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: from, target: dest });
  return true;
};

/** Aimed Charge: towards the cursor, up to the skill range, inside the arena. */
function aimedLanding(hero: Hero, aim: Vec, range: number): Vec | null {
  const d = dist(hero.pos, aim);
  if (d < 1) return null;
  const k = Math.min(1, range / d);
  return clampToArenaPoint({ x: hero.pos.x + (aim.x - hero.pos.x) * k, y: hero.pos.y + (aim.y - hero.pos.y) * k }, hero.radius);
}

function clampToArenaPoint(v: Vec, r: number): Vec {
  return {
    x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, v.x)),
    y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, v.y)),
  };
}

/**
 * Landing point for Charge: the densest group within range; while boss
 * telegraphs are active, prefers a spot next to a group that is outside them.
 */
function chargeLanding(b: Battle, hero: Hero, p: SkillParams): Vec | null {
  const clusters = densePoints(b.enemies, p.radius!, hero.pos, p.range!);
  const first = clusters[0];
  if (!first) return null;
  const clamp = (v: Vec): Vec => clampToArenaPoint(v, hero.radius);
  if (b.telegraphs.length === 0) return clamp(first.pos);
  const safe = (v: Vec): boolean => b.telegraphs.every((t) => !telegraphContains(t, v, hero.radius));
  for (const c of clusters) {
    const options = [c.pos];
    for (let k = 0; k < p.landingSamples!; k++) {
      const a = (k / p.landingSamples!) * Math.PI * 2;
      options.push({ x: c.pos.x + Math.cos(a) * p.landingRing!, y: c.pos.y + Math.sin(a) * p.landingRing! });
    }
    const ok = options.map(clamp).filter((v) => safe(v) && dist(v, hero.pos) <= p.range! + p.landingRing!);
    if (ok.length > 0) return ok.sort((x, y) => dist(x, c.pos) - dist(y, c.pos))[0] as Vec;
  }
  return clamp(first.pos);
}

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

const groundSlam: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const width = (p.angle! * Math.PI) / 180;
  // Aimed: any direction is allowed while enemies are around; otherwise the best cone.
  const best = aim
    ? nearestEnemy(b.enemies, hero.pos)
      ? { angle: Math.atan2(aim.y - hero.pos.y, aim.x - hero.pos.x) }
      : null
    : bestConeAngle(b.enemies, hero.pos, width, p.range!);
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

/** Axe thrown towards the cursor (or the nearest enemy), piercing. */
const axeThrow: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const target = aim ?? nearestEnemy(b.enemies, hero.pos, p.range!)?.pos;
  if (!target || !nearestEnemy(b.enemies, hero.pos)) return false;
  const angle = Math.atan2(target.y - hero.pos.y, target.x - hero.pos.x);
  hero.facing = angle;
  const roll = heroDamage(b, p.damage!, 'skill');
  spawnProjectile(b, {
    pos: { ...hero.pos },
    vel: { x: Math.cos(angle) * p.speed!, y: Math.sin(angle) * p.speed! },
    radius: p.radius!,
    damage: roll.amount,
    team: 'hero',
    life: p.range! / p.speed!,
    pierce: p.pierce!,
    ricochet: 0,
    kind: roll.crit ? 'axeCrit' : 'axe',
    melee: false,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: { x: hero.pos.x + Math.cos(angle) * p.range!, y: hero.pos.y + Math.sin(angle) * p.range! } });
  return true;
};

const ironSkin: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addBuff(hero, { id: def.id, time: p.duration!, attackSpeedMult: 1, damageTakenMult: 1 - p.damageReduction! });
  if (p.heal! > 0) healHero(b, hero.maxHp * p.heal!, 'show');
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Pulses around the spot where the hero stood. */
const earthquake: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos, p.castRange!)) return false;
  addZone(b, {
    kind: def.id,
    pos: hero.pos,
    radius: p.radius!,
    duration: p.interval! * (p.pulses! - 1),
    tickInterval: p.interval!,
    damage: heroAttack(hero) * p.damage! * hero.stats.skillDamageMult,
    slow: p.slow!,
    slowTime: p.slowTime!,
    stun: p.stun!,
    tickNow: true,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Pulls enemies in a cone (towards the cursor, or the best direction) to the hero. */
const hook: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const width = (p.angle! * Math.PI) / 180;
  const angle = aim
    ? Math.atan2(aim.y - hero.pos.y, aim.x - hero.pos.x)
    : bestConeAngle(b.enemies, hero.pos, width, p.range!)?.angle;
  if (angle === undefined || !nearestEnemy(b.enemies, hero.pos)) return false;
  hero.facing = angle;
  for (const e of coneTargets(b.enemies, hero.pos, angle, width, p.range!)) {
    damageEnemy(b, e, heroDamage(b, p.damage!, 'skill'), { source: 'skill' });
    if (e.dead) continue;
    pull(e, hero.pos, p.pull!);
    if (p.stun! > 0) addStatus(e, 'stun', p.stun!);
  }
  const target = { x: hero.pos.x + Math.cos(angle) * p.range!, y: hero.pos.y + Math.sin(angle) * p.range! };
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target });
  return true;
};

export const WARRIOR_SKILLS: Record<string, SkillImpl> = {
  whirlwind,
  charge,
  battleCry,
  groundSlam,
  axeThrow,
  ironSkin,
  earthquake,
  hook,
};
