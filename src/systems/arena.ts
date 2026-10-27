// Obstacles and terrain of the battle arena (ROADMAP 13.1): bodies are pushed out of
// obstacles (circles — they slide around), projectiles break on them; water slows, thorns
// hurt the hero, tall grass hides the hero from shooters further than TERRAIN.grassSight.

import { ARENA, ARENA_VIEW, setArenaSize } from '../data/balance';
import { type ArenaObstacle, type ArenaTerrain, TERRAIN, type TerrainKind, arenaFor } from '../data/arenas';
import type { Battle } from './battle';
import { addStatus, damageHero, debuffHero } from './combat';
import type { Body, Vec } from './entities';

export interface ArenaState {
  id: string;
  /** Obstacles in world coordinates. */
  obstacles: ArenaObstacle[];
  terrain: ArenaTerrain[];
  /** Thorns damage is dealt in ticks. */
  thornsTimer: number;
}

/** Sets up the arena of a location: its size and its obstacles and terrain in world coordinates. */
export function setupArena(nodeId: string): ArenaState {
  const def = arenaFor(nodeId, ARENA_VIEW.w, ARENA_VIEW.h);
  setArenaSize(def.w, def.h);
  return {
    id: def.id,
    obstacles: def.obstacles.map((o) => ({ ...o, x: o.x + ARENA.x, y: o.y + ARENA.y })),
    terrain: def.terrain.map((t) => ({ ...t, x: t.x + ARENA.x, y: t.y + ARENA.y })),
    thornsTimer: 0,
  };
}

/** The arena's centre (where the hero starts). */
export function arenaCentre(): Vec {
  return { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
}

/** Pushes a body out of every obstacle it overlaps. */
export function pushOutOfObstacles(a: ArenaState, body: Pick<Body, 'pos' | 'radius'>): void {
  for (const o of a.obstacles) {
    const dx = body.pos.x - o.x;
    const dy = body.pos.y - o.y;
    const min = o.r + body.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = d2 > 1e-12 ? dx / d : 1;
    const ny = d2 > 1e-12 ? dy / d : 0;
    body.pos.x = o.x + nx * min;
    body.pos.y = o.y + ny * min;
  }
}

/** Does a circle at (x, y) touch an obstacle (projectiles break on them). */
export function hitsObstacle(a: ArenaState, x: number, y: number, r: number): boolean {
  return a.obstacles.some((o) => (x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + r) ** 2);
}

export function terrainAt(a: ArenaState, p: Vec): TerrainKind | null {
  for (const t of a.terrain) if (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h) return t.kind;
  return null;
}

/** The hero is in tall grass: shooters further than TERRAIN.grassSight do not see it. */
export function heroHidden(b: Battle, from: Vec): boolean {
  if (terrainAt(b.arena, b.hero.pos) !== 'grass') return false;
  return Math.hypot(from.x - b.hero.pos.x, from.y - b.hero.pos.y) > TERRAIN.grassSight;
}

/** Terrain effects every step: water slows (everyone), thorns hurt the hero. */
export function updateTerrain(b: Battle, dt: number): void {
  const a = b.arena;
  if (a.terrain.length === 0) return;
  const hero = b.hero;
  if (!hero.dead && !hero.dash) {
    const t = terrainAt(a, hero.pos);
    if (t === 'water') debuffHero(b, 'slow', 0.15, TERRAIN.waterSlow);
    if (t === 'thorns') {
      a.thornsTimer -= dt;
      if (a.thornsTimer <= 0) {
        a.thornsTimer = 0.5;
        damageHero(b, hero.maxHp * TERRAIN.thornsDps * 0.5, { melee: false, cause: { kind: 'hazard', hazard: 'thorns' } });
      }
    } else a.thornsTimer = 0;
  }
  for (const e of b.enemies) if (!e.dead && terrainAt(a, e.pos) === 'water') addStatus(e, 'slow', 0.15, TERRAIN.waterSlow);
}
