// Helpers shared by class skills: aim points, targets near the cursor, arena bounds.

import { ARENA } from '../../data/balance';
import type { Battle } from '../battle';
import { type Enemy, type Hero, type Vec, dist, normalize } from '../entities';
import { heroAttack } from '../hero';
import { densestPoint, nearestEnemy } from '../targeting';

/** Absolute skill damage: attack × multiplier × class/passive skill bonus (crits are rolled on hit). */
export function skillAmount(hero: Hero, mult: number): number {
  return heroAttack(hero) * mult * hero.stats.skillDamageMult;
}

export function clampToArenaPoint(v: Vec, r: number): Vec {
  return {
    x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, v.x)),
    y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, v.y)),
  };
}

/** `aim`, pulled within `range` of the hero and inside the arena. */
export function pointWithin(hero: Hero, aim: Vec, range: number, margin = 0): Vec {
  const d = dist(hero.pos, aim);
  const k = d > range ? range / d : 1;
  return clampToArenaPoint({ x: hero.pos.x + (aim.x - hero.pos.x) * k, y: hero.pos.y + (aim.y - hero.pos.y) * k }, margin);
}

/**
 * Where an area skill lands: the cursor (within range) for the player, the densest
 * group within range for the bot. Null when there is nobody to hit.
 */
export function areaPoint(b: Battle, hero: Hero, aim: Vec | null, range: number, radius: number): Vec | null {
  if (!nearestEnemy(b.enemies, hero.pos)) return null;
  if (aim) return pointWithin(hero, aim, range);
  return densestPoint(b.enemies, radius, hero.pos, range)?.pos ?? null;
}

/** The enemy closest to the cursor among those within `range` of the hero (bot: closest to the hero). */
export function targetNearAim(b: Battle, hero: Hero, aim: Vec | null, range: number): Enemy | null {
  const inRange = b.enemies.filter((e) => !e.dead && dist(e.pos, hero.pos) <= range + e.radius);
  return nearestEnemy(inRange, aim ?? hero.pos);
}

/** Direction from the hero towards the cursor, or towards the nearest enemy (bot). */
export function aimAngle(b: Battle, hero: Hero, aim: Vec | null, range = Infinity): number | null {
  if (aim && (aim.x !== hero.pos.x || aim.y !== hero.pos.y)) return Math.atan2(aim.y - hero.pos.y, aim.x - hero.pos.x);
  const e = nearestEnemy(b.enemies, hero.pos, range);
  return e ? Math.atan2(e.pos.y - hero.pos.y, e.pos.x - hero.pos.x) : null;
}

export function unit(angle: number): Vec {
  return normalize({ x: Math.cos(angle), y: Math.sin(angle) });
}
