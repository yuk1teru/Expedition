import { describe, expect, it } from 'vitest';
import { PROGRESSION, WORLD } from '../src/data/balance';
import { BIOME_ORDER } from '../src/data/biomes';
import { type MapNode, type World, effectiveLevel, buildWorld, findRoute, getNode, markCleared, neighbours } from '../src/systems/mapgen';
import { canPassThrough, canTravel, completeBattle, createGameState, restInTown, restoreCheckpoint, teleport, travel } from '../src/systems/run';
import { createBattle, killAll, stepBattle } from '../src/systems/battle';
import { BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { CAPITAL_ID, WORLD_MAP, WORLD_NODES } from '../src/data/world';

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
      for (const n of byRegion(region)) if (!n.isBoss) expect(n.level).toBeLessThan(boss.level);
    }
  });

  it('the coast road (prologue) is the easiest, then the forest; the ice — the hardest', () => {
    const maxTier = (r: string): number => Math.max(...byRegion(r).filter((n) => !n.isBoss).map((n) => n.level));
    const minTier = (r: string): number => Math.min(...byRegion(r).filter((n) => !n.isTown).map((n) => n.level));
    // The coast road is the prologue: the easiest place; after it — the forest.
    const levels = WORLD_NODES.filter((n) => n.kind !== 'town');
    expect(Math.min(...levels.map((n) => n.level))).toBe(WORLD_NODES.find((n) => n.id === 'coastRoad')!.level);
    expect(minTier('forest')).toBe(Math.min(...levels.filter((n) => n.region !== 'coast').map((n) => n.level)));
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
    expect(canPassThrough(s, 'quietGrove')).toBe(true);
    expect(canTravel(s, 'forestTown')).toBe(true);
  });

  it('autopath: the shortest way over towns and cleared locations only', () => {
    const s = createGameState(7);
    // Nothing cleared: only the neighbours.
    expect(findRoute(s.world, CAPITAL_ID, 'darkThicket')).toBeNull();
    expect(findRoute(s.world, CAPITAL_ID, 'quietGrove')).toEqual(['quietGrove']);
    markCleared(getNode(s.world, 'quietGrove'));
    const way = findRoute(s.world, CAPITAL_ID, 'forestTown')!;
    expect(way[way.length - 1]).toBe('forestTown');
    for (const id of way.slice(0, -1)) {
      const n = getNode(s.world, id);
      expect(n.isTown || (n.timesCleared > 0 && !n.isBoss), id).toBe(true);
    }
    // Every step is a road.
    let at = CAPITAL_ID;
    for (const id of way) {
      expect(neighbours(s.world, at)).toContain(id);
      at = id;
    }
  });

  it('a crossing is one wave: it ends when the wave is cleared, costs a day and does not count as a clear', () => {
    const s = createGameState(7);
    const grove = getNode(s.world, 'quietGrove');
    markCleared(grove, 3);
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove', 0, true);
    expect(b.transit).toBe(true);
    let guard = 0;
    while (!b.finished && guard++ < 60 * 120) {
      killAll(b);
      stepBattle(b, 1 / 60);
    }
    expect(b.outcome).toBe('won');
    expect(b.waves!.cleared).toBe(1);
    const day = s.day;
    const sum = completeBattle(s, b);
    expect(sum.transit).toBe(true);
    expect(s.day).toBe(day + 1);
    expect(grove.timesCleared).toBe(1);
    expect(grove.lastWave).toBe(3);
  });

  it('a cleared location keeps its level', () => {
    const s = createGameState(3);
    const n = getNode(s.world, 'rotMarsh');
    const level = n.level;
    markCleared(n, 3);
    markCleared(n, 3);
    expect(n.level).toBe(level);
  });
});

describe('boss threat', () => {
  it('every defeated boss makes the locations and bosses left harder', () => {
    const s = createGameState(8);
    const d1 = getNode(s.world, 'quietGrove');
    const boss = s.world.nodes.find((n) => n.isBoss)!;
    expect(effectiveLevel(d1, 0)).toBe(d1.level);
    expect(effectiveLevel(d1, 2)).toBe(d1.level + 2 * WORLD.bossThreat.locationLevels);
    expect(effectiveLevel(boss, 1)).toBe(boss.level + WORLD.bossThreat.bossLevels);
  });

  it('the threat never lifts a location above the hero maximum level', () => {
    const s = createGameState(8);
    for (const n of s.world.nodes) if (!n.isTown) expect(effectiveLevel(n, 10)).toBeLessThanOrEqual(Math.max(n.level, PROGRESSION.maxLevel));
  });
});
