import { describe, expect, it } from 'vitest';
import { ARENA, ARENA_VIEW } from '../src/data/balance';
import { ARENAS, TERRAIN } from '../src/data/arenas';
import { WORLD_NODES } from '../src/data/world';
import { spawnProjectile } from '../src/systems/ai';
import { createBattle, stepBattle } from '../src/systems/battle';
import { heroHidden, setupArena, terrainAt } from '../src/systems/arena';
import { Rng } from '../src/core/rng';
import { createGameState, teleport } from '../src/systems/run';
import { edgePoint, spawnEnemy } from '../src/systems/waves';

function battleAt(nodeId: string) {
  const s = createGameState(3);
  s.hero.immortal = true;
  teleport(s, nodeId);
  const b = createBattle(s, nodeId);
  b.waves = null;
  b.enemies = [];
  return b;
}

describe('arenas', () => {
  it('data: real locations, at least the view big, everything inside, the centre clear for the hero', () => {
    for (const a of Object.values(ARENAS)) {
      expect(WORLD_NODES.some((n) => n.id === a.id), a.id).toBe(true);
      expect(a.w).toBeGreaterThanOrEqual(ARENA_VIEW.w);
      expect(a.h).toBeGreaterThanOrEqual(ARENA_VIEW.h);
      for (const o of a.obstacles) {
        expect(o.x - o.r >= 0 && o.x + o.r <= a.w && o.y - o.r >= 0 && o.y + o.r <= a.h, `${a.id}: obstacle inside`).toBe(true);
        expect(Math.hypot(o.x - a.w / 2, o.y - a.h / 2), `${a.id}: centre clear`).toBeGreaterThanOrEqual(TERRAIN.clearCentre + o.r);
      }
      for (const t of a.terrain) expect(t.x >= 0 && t.y >= 0 && t.x + t.w <= a.w && t.y + t.h <= a.h, `${a.id}: terrain inside`).toBe(true);
    }
  });

  it('a battle takes the size of its arena; a plain one is the view', () => {
    battleAt('wolfTrail');
    expect([ARENA.w, ARENA.h]).toEqual([ARENAS.wolfTrail!.w, ARENAS.wolfTrail!.h]);
    // A plain field: a location without its own arena (if any is left).
    const plain = WORLD_NODES.find((n) => n.kind !== 'town' && !ARENAS[n.id]);
    if (plain) {
      battleAt(plain.id);
      expect([ARENA.w, ARENA.h]).toEqual([ARENA_VIEW.w, ARENA_VIEW.h]);
    }
  });

  it('every location and lair of the world has its own arena (ROADMAP 16)', () => {
    for (const n of WORLD_NODES) if (n.kind !== 'town') expect(ARENAS[n.id], n.id).toBeDefined();
  });

  it('bodies never stand inside an obstacle; shots break on it', () => {
    const b = battleAt('quietGrove');
    const tree = b.arena.obstacles[0]!;
    b.hero.pos = { x: tree.x + 2, y: tree.y };
    stepBattle(b, 1 / 60);
    expect(Math.hypot(b.hero.pos.x - tree.x, b.hero.pos.y - tree.y)).toBeGreaterThanOrEqual(tree.r + b.hero.radius - 0.01);
    const p = spawnProjectile(b, { pos: { x: tree.x - tree.r - 30, y: tree.y }, vel: { x: 400, y: 0 }, radius: 5, damage: 1, team: 'hero', life: 2, pierce: 0, ricochet: 0, kind: 'arrow', melee: false });
    for (let i = 0; i < 30; i++) stepBattle(b, 1 / 60);
    expect(p.dead).toBe(true);
    expect(p.pos.x).toBeLessThan(tree.x);
  });

  it('water slows, thorns hurt the hero, tall grass hides it from far shooters', () => {
    const coast = battleAt('coastRoad');
    const water = coast.arena.terrain.find((t) => t.kind === 'water')!;
    coast.hero.pos = { x: water.x + water.w / 2, y: water.y + water.h / 2 };
    stepBattle(coast, 1 / 60);
    expect(coast.hero.statuses.slow?.value).toBeCloseTo(TERRAIN.waterSlow);

    const thicket = battleAt('darkThicket');
    thicket.hero.immortal = false;
    const thorns = thicket.arena.terrain.find((t) => t.kind === 'thorns')!;
    thicket.hero.pos = { x: thorns.x + thorns.w / 2, y: thorns.y + thorns.h / 2 };
    const hp = thicket.hero.hp;
    for (let i = 0; i < 60; i++) stepBattle(thicket, 1 / 60);
    expect(thicket.hero.hp).toBeLessThan(hp);

    const glade = battleAt('mushroomGlade');
    const grass = glade.arena.terrain.find((t) => t.kind === 'grass')!;
    glade.hero.pos = { x: grass.x + grass.w / 2, y: grass.y + grass.h / 2 };
    expect(terrainAt(glade.arena, glade.hero.pos)).toBe('grass');
    expect(heroHidden(glade, { x: glade.hero.pos.x + TERRAIN.grassSight + 50, y: glade.hero.pos.y })).toBe(true);
    expect(heroHidden(glade, { x: glade.hero.pos.x + TERRAIN.grassSight - 20, y: glade.hero.pos.y })).toBe(false);
    // A spawned enemy never stands in an obstacle.
    const o = glade.arena.obstacles[0]!;
    const e = spawnEnemy(glade, 'wolf', { x: o.x, y: o.y });
    expect(Math.hypot(e.pos.x - o.x, e.pos.y - o.y)).toBeGreaterThanOrEqual(o.r + e.radius - 0.01);
  });
  it('a mirrored arena: obstacles mirrored; a sea arena keeps its sea below and mirrors left to right instead', () => {
    const plain = setupArena('darkThicket');
    const flipped = setupArena('darkThicket', { x: true, y: true });
    const def = ARENAS.darkThicket!;
    const o0 = plain.obstacles[0]!;
    const f0 = flipped.obstacles[0]!;
    expect(f0.x - ARENA.x).toBeCloseTo(def.w - (o0.x - ARENA.x));
    expect(f0.y - ARENA.y).toBeCloseTo(def.h - (o0.y - ARENA.y));
    const coast = ARENAS.coastRoad!;
    expect(coast.fixedY).toBe(true);
    const c = setupArena('coastRoad', { x: false, y: true });
    const water = c.terrain.find((t) => t.kind === 'water')!;
    const orig = coast.terrain.find((t) => t.kind === 'water')!;
    expect(water.y - ARENA.y).toBe(orig.y);
    expect(c.obstacles[0]!.x - ARENA.x).toBeCloseTo(coast.w - coast.obstacles[0]!.x);
  });

  it('an arena with spawn sides: monsters come only from those edges (mirrored with the arena)', () => {
    const def = ARENAS.wolfTrail!;
    expect(def.spawnSides?.length).toBeGreaterThan(0);
    for (const flip of [undefined, { x: true, y: true }]) {
      const b = battleAt('wolfTrail');
      b.arena = setupArena('wolfTrail', flip);
      const rng = new Rng(9);
      for (let i = 0; i < 50; i++) {
        const p = edgePoint(rng, b.arena.spawnSides);
        const nearLeft = p.x - ARENA.x < 100;
        const nearRight = ARENA.x + ARENA.w - p.x < 100;
        expect(nearLeft || nearRight).toBe(true);
      }
    }
  });
});
