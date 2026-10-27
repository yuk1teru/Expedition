// Enemy-made hazards on the ground: lingering puddles (acid, poison) that hurt the
// hero standing in them, and expanding rings (Toxic Wave, Spike Ring) that hit once
// as they pass the hero — a gap in the ring, a dash or invulnerability avoids them.

import { HAZARDS } from '../data/bosses';
import type { Battle } from './battle';
import { damageHero, debuffHero } from './combat';
import { type Vec, dist } from './entities';

export interface Hazard {
  id: number;
  /** Render key: acid, poison, toxicWave, spikeRing. */
  kind: string;
  pos: Vec;
  radius: number;
  time: number;
  duration: number;
  /** Puddle: damage per second to the hero inside (applied every HAZARDS.tick). */
  dps: number;
  slow: number;
  tickTimer: number;
  /** Expanding ring instead of a puddle. */
  ring: { speed: number; width: number; damage: number; gaps: number[]; gapHalf: number; maxRadius: number; hit: boolean } | null;
  dead: boolean;
}

export function addPuddle(b: Battle, kind: string, pos: Vec, radius: number, duration: number, dps: number, slow = 0): Hazard {
  const h: Hazard = { id: b.nextId++, kind, pos: { ...pos }, radius, time: 0, duration, dps, slow, tickTimer: 0, ring: null, dead: false };
  b.hazards.push(h);
  return h;
}

/** A ring growing from `pos`; `gaps`: directions (radians) of safe openings. */
export function addRing(b: Battle, kind: string, pos: Vec, spec: { speed: number; width: number; damage: number; maxRadius: number; gaps?: number[]; gapDeg?: number }): Hazard {
  const h: Hazard = {
    id: b.nextId++,
    kind,
    pos: { ...pos },
    radius: 0,
    time: 0,
    duration: spec.maxRadius / spec.speed,
    dps: 0,
    slow: 0,
    tickTimer: 0,
    ring: {
      speed: spec.speed,
      width: spec.width,
      damage: spec.damage,
      // Directions kept in [0, 2π) so the drawn arcs between gaps line up.
      gaps: (spec.gaps ?? []).map((g) => ((g % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
      gapHalf: ((spec.gapDeg ?? 0) * Math.PI) / 360,
      maxRadius: spec.maxRadius,
      hit: false,
    },
    dead: false,
  };
  b.hazards.push(h);
  return h;
}

/** Whether direction `a` from the ring centre falls into one of its gaps. */
export function inRingGap(h: Hazard, a: number): boolean {
  if (!h.ring) return false;
  for (const g of h.ring.gaps) {
    let d = Math.abs(a - g) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d <= h.ring.gapHalf) return true;
  }
  return false;
}

export function updateHazards(b: Battle, dt: number): void {
  const hero = b.hero;
  for (const h of b.hazards) {
    if (h.dead) continue;
    h.time += dt;
    if (h.time >= h.duration) {
      h.dead = true;
      continue;
    }
    if (hero.dead) continue;
    if (h.ring) {
      h.radius = h.ring.speed * h.time;
      if (h.ring.hit) continue;
      const d = dist(hero.pos, h.pos);
      const a = Math.atan2(hero.pos.y - h.pos.y, hero.pos.x - h.pos.x);
      if (Math.abs(d - h.radius) <= h.ring.width / 2 + hero.radius * 0.5 && !inRingGap(h, a)) {
        // A ring hits once — unless the hero is invulnerable at that moment (dash, teleport).
        if (hero.invulnerable <= 0) {
          h.ring.hit = true;
          damageHero(b, h.ring.damage, { melee: false });
        }
      }
      continue;
    }
    h.tickTimer -= dt;
    if (h.tickTimer > 0) continue;
    h.tickTimer = HAZARDS.tick;
    if (dist(hero.pos, h.pos) <= h.radius + hero.radius * 0.3) {
      damageHero(b, h.dps * HAZARDS.tick, { melee: false });
      if (h.slow > 0) debuffHero(b, 'slow', HAZARDS.tick + 0.2, h.slow);
    }
  }
  if (b.hazards.some((h) => h.dead)) b.hazards = b.hazards.filter((h) => !h.dead);
}
