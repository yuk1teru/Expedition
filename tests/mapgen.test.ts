import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { SLICE, WORLD } from '../src/data/balance';
import { BIOME_ORDER, getBiome } from '../src/data/biomes';
import {
  SECTORS,
  SLICE_GROVE_ID,
  SLICE_LAIR_ID,
  TOWN_ID,
  type World,
  effectiveTier,
  generateSliceWorld,
  generateWorld,
  getNode,
  markCleared,
  neighbours,
} from '../src/systems/mapgen';
import { canPassThrough, canTravel, createGameState, passThrough, travel } from '../src/systems/run';

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

describe('full world', () => {
  const worlds = Array.from({ length: 200 }, (_, i) => generateWorld(new Rng(i + 1)));

  it('is connected: every node (and so every boss) is reachable from the town', () => {
    for (const w of worlds) expect(reachable(w, TOWN_ID).size).toBe(w.nodes.length);
  });

  it('has exactly one boss per sector, at depth 4, and 4 different biomes', () => {
    for (const w of worlds) {
      for (const sector of SECTORS) {
        const bosses = w.nodes.filter((n) => n.sector === sector && n.isBoss);
        expect(bosses).toHaveLength(1);
        expect(bosses[0]!.depth).toBe(4);
        expect(bosses[0]!.tier).toBe(WORLD.bossTier);
      }
      const biomes = new Set(w.nodes.filter((n) => n.sector).map((n) => `${n.sector}:${n.biome}`));
      expect(biomes.size).toBe(4);
      expect(new Set(w.nodes.filter((n) => n.biome).map((n) => n.biome))).toEqual(new Set(BIOME_ORDER));
    }
  });

  it('has 2 / 3 / 3 / 1 nodes per depth in every sector; the town links to all depth-1 nodes', () => {
    for (const w of worlds) {
      for (const sector of SECTORS) {
        const counts = [1, 2, 3, 4].map((d) => w.nodes.filter((n) => n.sector === sector && n.depth === d).length);
        expect(counts).toEqual([...WORLD.nodesPerDepth]);
      }
      const depth1 = w.nodes.filter((n) => n.depth === 1).map((n) => n.id).sort();
      expect(neighbours(w, TOWN_ID).sort()).toEqual(depth1);
    }
  });

  it('every node links to 1–2 nodes one step deeper in its sector, and every deeper node has a parent', () => {
    for (const w of worlds) {
      for (const n of w.nodes) {
        if (n.isTown || n.isBoss) continue;
        const deeper = neighbours(w, n.id).map((id) => getNode(w, id)).filter((m) => m.depth === n.depth + 1);
        expect(deeper.length).toBeGreaterThanOrEqual(1);
        expect(deeper.length).toBeLessThanOrEqual(2);
        expect(deeper.every((m) => m.sector === n.sector)).toBe(true);
      }
      for (const n of w.nodes.filter((m) => m.depth >= 2)) {
        const parents = neighbours(w, n.id).map((id) => getNode(w, id)).filter((m) => m.depth === n.depth - 1 && m.sector === n.sector);
        expect(parents.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('difficulty grows with depth: max tier at depth d < min tier at depth d+1', () => {
    for (const w of worlds) {
      for (let d = 1; d < 4; d++) {
        const here = w.nodes.filter((n) => n.depth === d).map((n) => n.tier);
        const next = w.nodes.filter((n) => n.depth === d + 1).map((n) => n.tier);
        expect(Math.max(...here)).toBeLessThan(Math.min(...next));
      }
    }
  });

  it('lateral edges link neighbours of the same depth, across sector borders too (the world is a ring)', () => {
    for (const w of worlds) {
      for (const [a, b] of w.edges) {
        const na = getNode(w, a);
        const nb = getNode(w, b);
        if (na.isTown || nb.isTown || na.depth !== nb.depth) continue;
        expect(na.depth).toBeLessThanOrEqual(3);
      }
      for (let i = 0; i < SECTORS.length; i++) {
        const s = SECTORS[i]!;
        const next = SECTORS[(i + 1) % SECTORS.length]!;
        for (let d = 1; d <= 3; d++) {
          const crosses = w.edges.some(([a, b]) => {
            const [na, nb] = [getNode(w, a), getNode(w, b)];
            return na.depth === d && nb.depth === d && new Set([na.sector, nb.sector]).size === 2 && [na.sector, nb.sector].includes(s) && [na.sector, nb.sector].includes(next);
          });
          expect(crosses).toBe(true);
        }
      }
    }
  });

  it('nodes do not overlap (centres > 40 px apart) and stay on screen', () => {
    for (const w of worlds.slice(0, 5)) {
      for (const a of w.nodes) {
        expect(a.pos.x).toBeGreaterThan(20);
        expect(a.pos.x).toBeLessThan(940);
        expect(a.pos.y).toBeGreaterThan(60);
        expect(a.pos.y).toBeLessThan(530);
        for (const b of w.nodes) if (a !== b) expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThan(40);
      }
    }
  });

  it('names come from the sector biome; the same seed gives the same world, different seeds differ', () => {
    for (const w of worlds.slice(0, 20)) {
      for (const n of w.nodes.filter((m) => m.biome)) {
        const biome = getBiome(n.biome!);
        expect(n.isBoss ? [biome.bossLocation] : biome.locationNames).toContain(n.name);
      }
    }
    expect(generateWorld(new Rng(42))).toEqual(generateWorld(new Rng(42)));
    const layouts = new Set(worlds.slice(0, 20).map((w) => JSON.stringify(w.edges) + w.nodes.map((n) => n.biome).join()));
    expect(layouts.size).toBeGreaterThan(15);
  });
});

describe('travel in the full world', () => {
  it('only to adjacent nodes; the town is always reachable; cleared locations can be crossed', () => {
    const s = createGameState(7);
    const d1 = neighbours(s.world, TOWN_ID)[0]!;
    const deep = s.world.nodes.find((n) => n.depth === 3)!;
    expect(canTravel(s, deep.id)).toBe(false);
    expect(travel(s, deep.id)).toEqual({ kind: 'blocked' });
    expect(travel(s, d1)).toEqual({ kind: 'battle', nodeId: d1 });
    expect(canTravel(s, TOWN_ID)).toBe(true);
    // Not cleared yet: no crossing.
    expect(travel(s, TOWN_ID)).toEqual({ kind: 'town' });
    expect(canPassThrough(s, d1)).toBe(false);
    markCleared(getNode(s.world, d1), 3);
    expect(passThrough(s, d1)).toBe(true);
    expect(s.currentNodeId).toBe(d1);
    // The current location is replayed, not crossed.
    expect(canPassThrough(s, d1)).toBe(false);
  });

  it('cleared tiers stay fixed in the full world (they only grow in the slice grove)', () => {
    const s = createGameState(3);
    const n = s.world.nodes.find((m) => m.depth === 2)!;
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
    const d1 = s.world.nodes.find((n) => n.depth === 1)!;
    const boss = s.world.nodes.find((n) => n.isBoss)!;
    expect(effectiveTier(s.world, d1, 0)).toBe(d1.tier);
    expect(effectiveTier(s.world, d1, 2)).toBeCloseTo(d1.tier + 2 * WORLD.bossThreat.locationTier);
    expect(effectiveTier(s.world, boss, 1)).toBeCloseTo(boss.tier + WORLD.bossThreat.bossTier);
    const slice = createGameState(8, 'slice');
    const grove = getNode(slice.world, SLICE_GROVE_ID);
    expect(effectiveTier(slice.world, grove, 3)).toBe(grove.tier);
  });
});
