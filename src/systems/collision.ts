// Circle separation (enemies with each other and with the hero) and arena bounds.

import { ARENA } from '../data/balance';
import type { Body } from './entities';

/** Pushes overlapping circles apart, proportionally to the other body's mass. */
export function separateBodies(bodies: readonly Body[]): void {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const a = bodies[i] as Body;
    if (a.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j] as Body;
      if (b.dead) continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2);
      let nx: number;
      let ny: number;
      if (d < 1e-6) {
        // Perfect overlap: deterministic nudge.
        nx = i % 2 === 0 ? 1 : -1;
        ny = 0;
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const overlap = min - d;
      const total = a.mass + b.mass;
      const pa = b.mass / total;
      const pb = a.mass / total;
      a.pos.x -= nx * overlap * pa;
      a.pos.y -= ny * overlap * pa;
      b.pos.x += nx * overlap * pb;
      b.pos.y += ny * overlap * pb;
    }
  }
}

export function clampToArena(body: Body): void {
  const r = body.radius;
  body.pos.x = Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, body.pos.x));
  body.pos.y = Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, body.pos.y));
}

export function insideArena(x: number, y: number, margin = 0): boolean {
  return x >= ARENA.x - margin && x <= ARENA.x + ARENA.w + margin && y >= ARENA.y - margin && y <= ARENA.y + ARENA.h + margin;
}
