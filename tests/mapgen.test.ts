import { describe, expect, it } from 'vitest';
import { SLICE, WORLD } from '../src/data/balance';
import { BIOME_ORDER } from '../src/data/biomes';
import {
  type MapNode,
  SLICE_GROVE_ID,
  SLICE_LAIR_ID,
  TOWN_ID,
  type World,
  effectiveTier,
  generateSliceWorld,
  buildWorld,
  getNode,
  markCleared,
  neighbours,
} from '../src/systems/mapgen';
import { canPassThrough, canTravel, createGameState, passThrough, restInTown, restoreCheckpoint, travel } from '../src/systems/run';
import { BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { CAPITAL_ID, WORLD_MAP } from '../src/data/world';

function reachable(world: World, from: string): Set<string> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    for (const n of neighbours(world, queue.shift()!)) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

describe('the fixed world', () => {
  const w = buildWorld();
  const byRegion = (r: string): MapNode[] => w.nodes.filter((n) => n.region === r);

  it('every road links existing nodes, positions fit the map, nodes do not overlap', () => {
    const ids = new Set(w.nodes.map((n) => n.id));
    expect(ids.size).toBe(w.nodes.length);
    for (const [a, b] of w.edges) expect(ids.has(a) && ids.has(b)).toBe(true);
    for (const n of w.nodes) {
      expect(n.pos.x).toBeGreaterThan(0);
      expect(n.pos.x).toBeLessThan(WORLD_MAP.width);
      expect(n.pos.y).toBeGreaterThan(0);
      expect(n.pos.y).toBeLessThan(WORLD_MAP.height);
      for (const m of w.nodes) if (m !== n) expect(Math.hypot(m.pos.x - n.pos.x, m.pos.y - n.pos.y)).toBeGreaterThan(80);
    }
  });

  it('everything is reachable from the capital; every biome has its town and its boss', () => {
    expect(reachable(w, CAPITAL_ID).size).toBe(w.nodes.length);
    for (const region of BIOME_ORDER) {
      expect(byRegion(region).filter((n) => n.isTown)).toHaveLength(1);
      const bosses = byRegion(region).filter((n) => n.isBoss);
      expect(bosses).toHaveLength(1);
      expect(BOSSES[bosses[0]!.boss]?.biome).toBe(region);
    }
    expect(w.nodes.find((n) => n.id === 'port')?.isTown).toBe(true);
  });

  it('the Ice is reached only through the mountain pass', () => {
    const cut: World = { ...w, edges: w.edges.filter(([a, b]) => a !== 'mountainPass' && b !== 'mountainPass') };
    const seen = reachable(cut, CAPITAL_ID);
    for (const n of byRegion('ice')) expect(seen.has(n.id)).toBe(false);
  });

  it('the forest is the gate: the swamp and the desert are reached through transition zones from it', () => {
    const neighboursOf = (id: string): string[] => neighbours(w, id).map((x) => getNode(w, x).region);
    expect(neighboursOf('wetwood')).toEqual(expect.arrayContaining(['forest', 'swamp']));
    expect(neighboursOf('dryEdge')).toEqual(expect.arrayContaining(['forest', 'desert']));
    // The capital is far from everything but the forest, the coast and the mountains.
    expect(new Set(neighboursOf(CAPITAL_ID))).toEqual(new Set(['forest', 'coast', 'mountain']));
  });

  it('every location has enemies, known minibosses and bosses; a boss is the hardest of its region', () => {
    for (const n of w.nodes) {
      if (n.isTown) continue;
      if (n.isBoss) expect(BOSSES[n.boss]).toBeDefined();
      else {
        expect(n.enemies.length).toBeGreaterThan(0);
        for (const e of n.enemies) expect(ENEMIES[e]).toBeDefined();
        if (n.miniboss) expect(BOSSES[n.miniboss]?.miniboss).toBe(true);
      }
    }
    for (const region of BIOME_ORDER) {
      const boss = byRegion(region).find((n) => n.isBoss)!;
      for (const n of byRegion(region)) if (!n.isBoss) expect(n.tier).toBeLessThan(boss.tier);
    }
  });

  it('the forest is the easiest biome; the ice — the hardest', () => {
    const maxTier = (r: string): number => Math.max(...byRegion(r).filter((n) => !n.isBoss).map((n) => n.tier));
    const minTier = (r: string): number => Math.min(...byRegion(r).filter((n) => !n.isTown).map((n) => n.tier));
    expect(minTier('forest')).toBe(1);
    expect(maxTier('forest')).toBeLessThan(minTier('swamp'));
    expect(maxTier('forest')).toBeLessThan(minTier('desert'));
    expect(minTier('ice')).toBeGreaterThan(minTier('swamp'));
  });
});

describe('travel in the fixed world', () => {
  it('only to adjacent nodes; the home town is always reachable; cleared locations can be crossed', () => {
    const s = createGameState(7);
    expect(canTravel(s, 'darkThicket')).toBe(false);
    expect(travel(s, 'darkThicket')).toEqual({ kind: 'blocked' });
    expect(travel(s, 'quietGrove')).toEqual({ kind: 'battle', nodeId: 'quietGrove' });
    expect(canTravel(s, CAPITAL_ID)).toBe(true);
    expect(canPassThrough(s, 'quietGrove')).toBe(false);
    markCleared(getNode(s.world, 'quietGrove'), 3);
    expect(travel(s, 'forestTown')).toEqual({ kind: 'town' });
    restInTown(s);
    expect(s.homeTown).toBe('forestTown');
    // Death brings the hero back to the town of the last rest.
    restoreCheckpoint(s);
    expect(s.currentNodeId).toBe('forestTown');
    expect(passThrough(s, 'quietGrove')).toBe(true);
    expect(canTravel(s, 'forestTown')).toBe(true);
  });

  it('cleared tiers stay fixed in the full world (they only grow in the slice grove)', () => {
    const s = createGameState(3);
    const n = getNode(s.world, 'rotMarsh');
    const tier = n.tier;
    markCleared(n, 3);
    markCleared(n, 3);
    expect(n.tier).toBe(tier);
  });
});

describe('slice world', () => {
  it('has town, grove and boss lair connected by 2 edges', () => {
    const w = generateSliceWorld();
    expect(w.kind).toBe('slice');
    expect(w.nodes.map((n) => n.id).sort()).toEqual([SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID].sort());
    expect(w.edges).toHaveLength(2);
    expect(neighbours(w, TOWN_ID).sort()).toEqual([SLICE_GROVE_ID, SLICE_LAIR_ID].sort());
    expect(w.nodes.filter((n) => n.isBoss)).toHaveLength(1);
  });

  it('grove tier grows by 0.5 per clear up to the max', () => {
    const w = generateSliceWorld();
    const grove = getNode(w, SLICE_GROVE_ID);
    const tiers = [grove.tier];
    for (let i = 0; i < 6; i++) {
      markCleared(grove);
      tiers.push(grove.tier);
    }
    expect(tiers).toEqual([1, 1.5, 2, 2.5, 3, 3, 3]);
    expect(getNode(w, SLICE_LAIR_ID).tier).toBe(SLICE.bossTier);
  });

  it('travel only to adjacent nodes; current location can be replayed', () => {
    const s = createGameState(1, 'slice');
    // The town is always reachable from the map ("До міста"), even when already there.
    expect(canTravel(s, TOWN_ID)).toBe(true);
    expect(travel(s, SLICE_GROVE_ID)).toEqual({ kind: 'battle', nodeId: SLICE_GROVE_ID });
    expect(travel(s, SLICE_GROVE_ID)).toEqual({ kind: 'battle', nodeId: SLICE_GROVE_ID });
    expect(travel(s, SLICE_LAIR_ID)).toEqual({ kind: 'blocked' });
    expect(travel(s, TOWN_ID)).toEqual({ kind: 'town' });
    expect(travel(s, SLICE_LAIR_ID)).toEqual({ kind: 'battle', nodeId: SLICE_LAIR_ID });
  });
});

describe('boss threat', () => {
  it('every defeated boss makes the locations and bosses left harder (full world only)', () => {
    const s = createGameState(8);
    const d1 = getNode(s.world, 'quietGrove');
    const boss = s.world.nodes.find((n) => n.isBoss)!;
    expect(effectiveTier(s.world, d1, 0)).toBe(d1.tier);
    expect(effectiveTier(s.world, d1, 2)).toBeCloseTo(d1.tier + 2 * WORLD.bossThreat.locationTier);
    expect(effectiveTier(s.world, boss, 1)).toBeCloseTo(boss.tier + WORLD.bossThreat.bossTier);
    const slice = createGameState(8, 'slice');
    const grove = getNode(slice.world, SLICE_GROVE_ID);
    expect(effectiveTier(slice.world, grove, 3)).toBe(grove.tier);
  });
});
