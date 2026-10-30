// The rework's field (ROADMAP 20.1): the hero walking on a bounded location and dummy enemies
// running at him, pushed apart through a grid of cells so hundreds of them stay cheap.
// No DOM here: the field steps the same in the browser and in Node.

import { REWORK_FIELD, REWORK_STRESS } from '../../data/rework';
import { Rng } from '../../core/rng';
import type { Vec } from '../entities';

export interface FieldHero {
  pos: Vec;
  vel: Vec;
  /** Where the hero looks (radians). */
  facing: number;
  radius: number;
  /** The rework has no dashes yet (step 20.4). */
  dash: null;
}

export interface Dummy {
  pos: Vec;
  vel: Vec;
  /** Walk cycle offset, so the crowd does not step in sync. */
  phase: number;
}

export interface Field {
  width: number;
  height: number;
  hero: FieldHero;
  dummies: Dummy[];
  rng: Rng;
  time: number;
}

export function createField(seed: number): Field {
  const F = REWORK_FIELD;
  return {
    width: F.width,
    height: F.height,
    hero: { pos: { x: F.width / 2, y: F.height / 2 }, vel: { x: 0, y: 0 }, facing: 0, radius: F.hero.radius, dash: null },
    dummies: [],
    rng: new Rng(seed).fork('field'),
    time: 0,
  };
}

/** Replaces the dummies with `count` new ones on a ring around the hero. */
export function spawnDummies(f: Field, count: number): void {
  const S = REWORK_STRESS;
  f.dummies = [];
  for (let i = 0; i < count; i++) {
    const a = f.rng.next() * Math.PI * 2;
    const d = S.spawnMin + f.rng.next() * (S.spawnMax - S.spawnMin);
    f.dummies.push({
      pos: { x: clamp(f.hero.pos.x + Math.cos(a) * d, S.radius, f.width - S.radius), y: clamp(f.hero.pos.y + Math.sin(a) * d, S.radius, f.height - S.radius) },
      vel: { x: 0, y: 0 },
      phase: f.rng.next(),
    });
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** One fixed step: the hero walks along `move` (normalised), the dummies run at him. */
export function stepField(f: Field, dt: number, move: Vec): void {
  f.time += dt;
  const h = f.hero;
  const speed = REWORK_FIELD.hero.speed;
  h.vel = { x: move.x * speed, y: move.y * speed };
  if (move.x !== 0 || move.y !== 0) h.facing = Math.atan2(move.y, move.x);
  h.pos.x = clamp(h.pos.x + h.vel.x * dt, h.radius, f.width - h.radius);
  h.pos.y = clamp(h.pos.y + h.vel.y * dt, h.radius, f.height - h.radius);
  stepDummies(f, dt);
}

function stepDummies(f: Field, dt: number): void {
  const S = REWORK_STRESS;
  const h = f.hero;
  // Seek the hero.
  for (const d of f.dummies) {
    const dx = h.pos.x - d.pos.x;
    const dy = h.pos.y - d.pos.y;
    const l = Math.hypot(dx, dy) || 1;
    d.vel.x = (dx / l) * S.speed;
    d.vel.y = (dy / l) * S.speed;
    d.pos.x += d.vel.x * dt;
    d.pos.y += d.vel.y * dt;
  }
  // Push apart: each dummy checks only the 3 × 3 cells around it.
  const cells = new Map<number, Dummy[]>();
  const key = (cx: number, cy: number): number => cx * 100003 + cy;
  for (const d of f.dummies) {
    const k = key(Math.floor(d.pos.x / S.cell), Math.floor(d.pos.y / S.cell));
    const list = cells.get(k);
    if (list) list.push(d);
    else cells.set(k, [d]);
  }
  const min = S.radius * 2;
  for (const d of f.dummies) {
    const cx = Math.floor(d.pos.x / S.cell);
    const cy = Math.floor(d.pos.y / S.cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = cells.get(key(cx + ox, cy + oy));
        if (!list) continue;
        for (const o of list) {
          if (o === d) continue;
          const dx = d.pos.x - o.pos.x;
          const dy = d.pos.y - o.pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= min || dist === 0) continue;
          const push = (min - dist) / 2 / dist;
          d.pos.x += dx * push;
          d.pos.y += dy * push;
          o.pos.x -= dx * push;
          o.pos.y -= dy * push;
        }
      }
    }
    // They do not walk through the hero.
    const dx = d.pos.x - h.pos.x;
    const dy = d.pos.y - h.pos.y;
    const dist = Math.hypot(dx, dy);
    const reach = S.radius + h.radius;
    if (dist < reach && dist > 0) {
      d.pos.x = h.pos.x + (dx / dist) * reach;
      d.pos.y = h.pos.y + (dy / dist) * reach;
    }
    d.pos.x = clamp(d.pos.x, S.radius, f.width - S.radius);
    d.pos.y = clamp(d.pos.y, S.radius, f.height - S.radius);
  }
}
