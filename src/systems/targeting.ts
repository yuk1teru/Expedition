// Target selection helpers for AI and skills.

import type { Enemy, Vec } from './entities';
import { dist, dist2, normalize } from './entities';

export function aliveEnemies(enemies: readonly Enemy[]): Enemy[] {
  return enemies.filter((e) => !e.dead);
}

export function nearestEnemy(enemies: readonly Enemy[], from: Vec, maxRange = Infinity): Enemy | null {
  let best: Enemy | null = null;
  let bestD = maxRange * maxRange;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist2(e.pos, from);
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function enemiesInRadius(enemies: readonly Enemy[], center: Vec, radius: number): Enemy[] {
  return enemies.filter((e) => !e.dead && dist(e.pos, center) <= radius + e.radius);
}

export interface DensePoint {
  pos: Vec;
  count: number;
}

/**
 * Densest point: tries every enemy position as a candidate centre and counts
 * enemies within `radius`. Optionally only candidates within `maxRange` of `from`.
 */
export function densestPoint(
  enemies: readonly Enemy[],
  radius: number,
  from?: Vec,
  maxRange = Infinity,
): DensePoint | null {
  let best: DensePoint | null = null;
  for (const c of enemies) {
    if (c.dead) continue;
    if (from && dist(c.pos, from) > maxRange) continue;
    let count = 0;
    let sx = 0;
    let sy = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      if (dist(e.pos, c.pos) <= radius) {
        count++;
        sx += e.pos.x;
        sy += e.pos.y;
      }
    }
    // Prefer more enemies; tie-break by distance to `from`.
    const pos = { x: sx / count, y: sy / count };
    if (
      !best ||
      count > best.count ||
      (count === best.count && from && dist(pos, from) < dist(best.pos, from))
    ) {
      best = { pos, count };
    }
  }
  return best;
}

/** All candidate clusters (one per enemy as centre), most enemies first. */
export function densePoints(enemies: readonly Enemy[], radius: number, from: Vec, maxRange: number): DensePoint[] {
  const out: DensePoint[] = [];
  for (const c of enemies) {
    if (c.dead || dist(c.pos, from) > maxRange) continue;
    let count = 0;
    let sx = 0;
    let sy = 0;
    for (const e of enemies) {
      if (e.dead || dist(e.pos, c.pos) > radius) continue;
      count++;
      sx += e.pos.x;
      sy += e.pos.y;
    }
    out.push({ pos: { x: sx / count, y: sy / count }, count });
  }
  return out.sort((a, b) => b.count - a.count || dist(a.pos, from) - dist(b.pos, from));
}

/** Direction away from the centre of mass of enemies within `radius` (unit vector). */
export function safestDirection(enemies: readonly Enemy[], from: Vec, radius: number): Vec | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const e of enemies) {
    if (e.dead || dist(e.pos, from) > radius) continue;
    sx += e.pos.x;
    sy += e.pos.y;
    n++;
  }
  if (n === 0) return null;
  const d = normalize({ x: from.x - sx / n, y: from.y - sy / n });
  if (d.x === 0 && d.y === 0) return { x: 0, y: 1 };
  return d;
}

/** Enemies inside a cone from `origin` facing `angle` with full width `width` (radians). */
export function coneTargets(enemies: readonly Enemy[], origin: Vec, angle: number, width: number, range: number): Enemy[] {
  const half = width / 2;
  return enemies.filter((e) => {
    if (e.dead) return false;
    const d = dist(e.pos, origin);
    if (d > range + e.radius) return false;
    if (d < 1) return true;
    const a = Math.atan2(e.pos.y - origin.y, e.pos.x - origin.x);
    let diff = Math.abs(a - angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    // Allow the body's angular size so big enemies on the edge are hit.
    const slack = Math.asin(Math.min(1, e.radius / Math.max(d, e.radius)));
    return diff <= half + slack;
  });
}

/** Best cone direction: the angle (towards some enemy) that hits the most enemies. */
export function bestConeAngle(enemies: readonly Enemy[], origin: Vec, width: number, range: number): { angle: number; count: number } | null {
  let best: { angle: number; count: number } | null = null;
  for (const e of enemies) {
    if (e.dead || dist(e.pos, origin) > range + e.radius) continue;
    const a = Math.atan2(e.pos.y - origin.y, e.pos.x - origin.x);
    const count = coneTargets(enemies, origin, a, width, range).length;
    if (!best || count > best.count) best = { angle: a, count };
  }
  return best;
}
