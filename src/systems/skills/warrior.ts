// Warrior skills: Whirlwind, Charge, Battle Cry, Ground Slam.

import { ARENA } from '../../data/balance';
import { addStatus, damageEnemy, heroDamage } from '../combat';
import { addBuff, addZone, startDash } from '../effects';
import type { SkillParams } from '../../data/skills';
import type { Battle } from '../battle';
import { type Hero, type Vec, dist } from '../entities';
import { bestConeAngle, coneTargets, densePoints, enemiesInRadius, nearestEnemy } from '../targeting';
import { telegraphContains } from '../boss';
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

export const WARRIOR_SKILLS: Record<string, SkillImpl> = {
  whirlwind,
  charge,
  battleCry,
  groundSlam,
};
