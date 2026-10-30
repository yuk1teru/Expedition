// The Forest location (ROADMAP 20.2): trees, bushes, stones and three landmarks scattered over a
// bounded field, a clear patch where the hero starts; the deeper forest (20.14) is denser and hung
// with cobwebs. Bodies are circles on the ground and are
// pushed out of obstacles; a static grid keeps the lookups cheap.

import type { Rng } from '../../core/rng';
import { REWORK_LOCATIONS, REWORK_MAP, type ReworkLocation } from '../../data/rework';
import type { Vec } from '../entities';
import type { Obstacle, ObstacleKind } from './types';

const between = (rng: Rng, [a, b]: readonly [number, number] | readonly number[]): number => a! + rng.next() * (b! - a!);

export function makeForest(rng: Rng, width: number, height: number, start: Vec, L: ReworkLocation['map'] = REWORK_LOCATIONS[0]!.map): Obstacle[] {
  const M = REWORK_MAP;
  const out: Obstacle[] = [];
  const fits = (pos: Vec, radius: number): boolean => {
    if (pos.x < radius + 20 || pos.y < radius + 20 || pos.x > width - radius - 20 || pos.y > height - radius - 20) return false;
    if (Math.hypot(pos.x - start.x, pos.y - start.y) < M.startClear + radius) return false;
    return out.every((o) => Math.hypot(o.pos.x - pos.x, o.pos.y - pos.y) >= o.radius + radius + M.gap);
  };
  const place = (kind: ObstacleKind, radius: number, tall: number): void => {
    for (let tries = 0; tries < 40; tries++) {
      const pos = { x: rng.next() * width, y: rng.next() * height };
      if (!fits(pos, radius)) continue;
      out.push({ kind, pos, radius, height: tall, seed: rng.next(), webbed: kind === 'tree' && rng.next() < L.webbed });
      return;
    }
  };
  // Landmarks first, spread over the field's thirds so they are found while walking.
  M.landmarks.forEach((l, i) => {
    for (let tries = 0; tries < 60; tries++) {
      const pos = { x: ((i + 0.5) / M.landmarks.length) * width + (rng.next() - 0.5) * width * 0.2, y: height * (0.25 + rng.next() * 0.5) };
      if (!fits(pos, l.radius)) continue;
      out.push({ kind: l.kind, pos, radius: l.radius, height: l.radius * 2, seed: rng.next(), webbed: l.kind === 'oak' && L.webbed > 0 });
      break;
    }
  });
  for (let i = 0; i < L.trees; i++) place('tree', between(rng, M.tree.radius), between(rng, M.tree.height));
  for (let i = 0; i < L.bushes; i++) place('bush', between(rng, M.bush.radius), 0);
  for (let i = 0; i < L.stones; i++) place('stone', between(rng, M.stone.radius), 0);
  return out;
}

const key = (cx: number, cy: number): number => cx * 100003 + cy;

/** The widest body radius (the stump) with a margin. */
const BODY_MAX = 24;

export function buildGrid(obstacles: Obstacle[]): Map<number, Obstacle[]> {
  const C = REWORK_MAP.cell;
  const grid = new Map<number, Obstacle[]>();
  for (const o of obstacles) {
    // Listed in every cell a body could touch it from (bodies are at most `BODY_MAX` wide).
    const r = o.radius + BODY_MAX;
    for (let cx = Math.floor((o.pos.x - r) / C); cx <= Math.floor((o.pos.x + r) / C); cx++) {
      for (let cy = Math.floor((o.pos.y - r) / C); cy <= Math.floor((o.pos.y + r) / C); cy++) {
        const k = key(cx, cy);
        const list = grid.get(k);
        if (list) list.push(o);
        else grid.set(k, [o]);
      }
    }
  }
  return grid;
}

/** Obstacles near a point (within one cell). */
export function obstaclesNear(grid: Map<number, Obstacle[]>, p: Vec): Obstacle[] {
  return grid.get(key(Math.floor(p.x / REWORK_MAP.cell), Math.floor(p.y / REWORK_MAP.cell))) ?? [];
}

/** Pushes a body (circle) out of the obstacles and inside the field; true if it touched one. */
export function resolveBody(grid: Map<number, Obstacle[]>, pos: Vec, radius: number, width: number, height: number): boolean {
  let touched = false;
  for (const o of obstaclesNear(grid, pos)) {
    const dx = pos.x - o.pos.x;
    const dy = pos.y - o.pos.y;
    const d = Math.hypot(dx, dy);
    const min = o.radius + radius;
    if (d >= min) continue;
    touched = true;
    if (d === 0) {
      pos.x += min;
      continue;
    }
    pos.x = o.pos.x + (dx / d) * min;
    pos.y = o.pos.y + (dy / d) * min;
  }
  pos.x = Math.max(radius, Math.min(width - radius, pos.x));
  pos.y = Math.max(radius, Math.min(height - radius, pos.y));
  return touched;
}

/** True if a point is free for a body of this radius. */
export function isFree(grid: Map<number, Obstacle[]>, p: Vec, radius: number): boolean {
  return obstaclesNear(grid, p).every((o) => Math.hypot(p.x - o.pos.x, p.y - o.pos.y) >= o.radius + radius);
}

/** A tree trunk blocks beast shots (spores); bushes and stones are low. */
export function blocksShot(grid: Map<number, Obstacle[]>, p: Vec): boolean {
  return obstaclesNear(grid, p).some((o) => (o.kind === 'tree' || o.kind === 'oak') && Math.hypot(p.x - o.pos.x, p.y - o.pos.y) < o.radius * 0.7);
}
