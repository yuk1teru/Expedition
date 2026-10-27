// World map: node/edge types and generators.

import type { Rng } from '../core/rng';
import { SCALING, SLICE, VIEW, WORLD } from '../data/balance';
import { BIOME_ORDER, getBiome } from '../data/biomes';
import type { Vec } from './entities';

export type Sector = 'N' | 'E' | 'S' | 'W';

export interface MapNode {
  id: string;
  /** null for the town. */
  sector: Sector | null;
  /** 0 = town, 4 = boss. */
  depth: number;
  lateralIndex: number;
  tier: number;
  biome: string | null;
  isBoss: boolean;
  isTown: boolean;
  cleared: boolean;
  /** How many times the location was completed. */
  timesCleared: number;
  /** Waves cleared on the last completed visit (the next visit may continue from there). */
  lastWave: number;
  /** Slice rule: the tier grows with every completion (imitates going deeper). */
  growsOnClear?: boolean;
  name: string;
  pos: Vec;
}

export type MapEdge = [string, string];

export interface World {
  /** `slice`: the vertical-slice world (town, grove, lair), `full`: 4 sectors. */
  kind: WorldKind;
  nodes: MapNode[];
  edges: MapEdge[];
}

export type WorldKind = 'full' | 'slice';

export function getNode(world: World, id: string): MapNode {
  const node = world.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown map node: ${id}`);
  return node;
}

export function neighbours(world: World, id: string): string[] {
  const out: string[] = [];
  for (const [a, b] of world.edges) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

export function areAdjacent(world: World, a: string, b: string): boolean {
  return world.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export const TOWN_ID = 'town';
export const SLICE_GROVE_ID = 'grove';
export const SLICE_LAIR_ID = 'lair';

export const SECTORS: Sector[] = ['N', 'E', 'S', 'W'];

/** Direction of a sector's centre on the map, radians (screen y points down, N is up). */
const SECTOR_ANGLE: Record<Sector, number> = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI };

function townNode(pos: Vec): MapNode {
  return {
    id: TOWN_ID,
    sector: null,
    depth: 0,
    lateralIndex: 0,
    tier: 0,
    biome: null,
    isBoss: false,
    isTown: true,
    cleared: false,
    timesCleared: 0,
    lastWave: 0,
    name: 'Місто',
    pos,
  };
}

export function nodeId(sector: Sector, depth: number, lateralIndex: number): string {
  return `${sector}${depth}-${lateralIndex}`;
}

/**
 * Full world (PLAN.md 1.11): the town in the centre and 4 sectors with 2 / 3 / 3
 * locations at depths 1–3 and the boss at depth 4. Biomes are shuffled between the
 * sectors; positions are shifted a little at random. Edges: town ↔ every depth-1 node;
 * each node ↔ 1–2 nodes one step deeper in its sector (every deeper node has a parent);
 * some side roads between neighbours of the same depth, and at least one road across
 * every sector border (the world is a ring).
 */
export function generateWorld(rng: Rng): World {
  const r = rng.fork('world');
  const { layout } = WORLD;
  const biomes = r.shuffle([...BIOME_ORDER]);
  const nodes: MapNode[] = [townNode({ ...layout.center })];
  const edges: MapEdge[] = [];
  /** Node ids per sector and depth, ordered clockwise (by angle). */
  const grid: Record<Sector, string[][]> = { N: [], E: [], S: [], W: [] };

  SECTORS.forEach((sector, si) => {
    const biome = getBiome(biomes[si]!);
    const names = r.shuffle(biome.locationNames);
    let nameIdx = 0;
    for (let depth = 1; depth <= WORLD.nodesPerDepth.length; depth++) {
      const count = WORLD.nodesPerDepth[depth - 1]!;
      const isBoss = depth === WORLD.nodesPerDepth.length;
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const id = nodeId(sector, depth, i);
        ids.push(id);
        nodes.push({
          id,
          sector,
          depth,
          lateralIndex: i,
          tier: isBoss ? WORLD.bossTier : depth + r.float(0, WORLD.lateralShift),
          biome: biome.id,
          isBoss,
          isTown: false,
          cleared: false,
          timesCleared: 0,
          lastWave: 0,
          name: isBoss ? biome.bossLocation : (names[nameIdx++ % names.length] ?? biome.name),
          pos: jitteredPos(r, nodes, sector, depth, i, count),
        });
      }
      grid[sector].push(ids);
    }
  });

  for (const sector of SECTORS) {
    const depths = grid[sector];
    for (const id of depths[0]!) edges.push([TOWN_ID, id]);
    for (let d = 0; d + 1 < depths.length; d++) linkDepths(r, depths[d]!, depths[d + 1]!, edges);
    // Some side roads inside the sector (not every neighbour is linked; not for the lone boss).
    for (let d = 0; d < depths.length - 1; d++) {
      const row = depths[d]!;
      for (let i = 0; i + 1 < row.length; i++) if (r.chance(WORLD.lateralChance)) edges.push([row[i]!, row[i + 1]!]);
    }
  }
  // Across sector borders: the last (clockwise) node of a sector ↔ the first of the next one,
  // at some depths — at least one road per border, so the world stays a ring.
  SECTORS.forEach((sector, si) => {
    const next = SECTORS[(si + 1) % SECTORS.length]!;
    const depthsWithRoads: number[] = [];
    for (let d = 0; d < WORLD.nodesPerDepth.length - 1; d++) if (r.chance(WORLD.crossSectorChance)) depthsWithRoads.push(d);
    if (depthsWithRoads.length === 0) depthsWithRoads.push(r.int(0, WORLD.nodesPerDepth.length - 2));
    for (const d of depthsWithRoads) {
      const a = grid[sector][d]!;
      const b = grid[next][d]!;
      edges.push([a[a.length - 1]!, b[0]!]);
    }
  });
  return { kind: 'full', nodes, edges };
}

/**
 * Parents (one depth) ↔ children (the next depth). Every child gets the parent at the
 * closest relative position; then a parent with a single child may get a second
 * (a neighbouring child), at most 2 per parent.
 */
function linkDepths(rng: Rng, parents: string[], children: string[], edges: MapEdge[]): void {
  const rel = (i: number, n: number): number => (n === 1 ? 0.5 : i / (n - 1));
  const kids = new Map<string, string[]>(parents.map((p) => [p, []]));
  children.forEach((child, ci) => {
    const t = rel(ci, children.length);
    let best: string[] = [];
    let bestD = Infinity;
    parents.forEach((p, pi) => {
      const d = Math.abs(rel(pi, parents.length) - t);
      if (d < bestD - 1e-9) {
        bestD = d;
        best = [p];
      } else if (Math.abs(d - bestD) < 1e-9) best.push(p);
    });
    // A tie (a middle child between two parents) goes to the parent with fewer children.
    best.sort((a, b) => kids.get(a)!.length - kids.get(b)!.length);
    const pick = kids.get(best[0]!)!.length === kids.get(best[best.length - 1]!)!.length ? rng.pick(best) : best[0]!;
    kids.get(pick)!.push(child);
  });
  parents.forEach((p, pi) => {
    const own = kids.get(p)!;
    if (own.length === 0) {
      // More parents than children (the boss row): link to the nearest child.
      const ci = Math.round(rel(pi, parents.length) * (children.length - 1));
      own.push(children[ci]!);
    } else if (own.length === 1 && children.length > 1 && rng.chance(WORLD.secondChildChance)) {
      const ci = children.indexOf(own[0]!);
      const options = [ci - 1, ci + 1].filter((j) => j >= 0 && j < children.length).map((j) => children[j]!);
      own.push(rng.pick(options));
    }
    for (const c of own) edges.push([p, c]);
  });
}

function nodePos(sector: Sector, depth: number, i: number, count: number, angleShift = 0, radiusMult = 1): Vec {
  const { center, radiusX, radiusY, arcDeg, staggerDeg } = WORLD.layout;
  const deg = Math.PI / 180;
  const arc = (arcDeg[depth] ?? 0) * deg;
  const a = SECTOR_ANGLE[sector] + (staggerDeg[depth] ?? 0) * deg + (count === 1 ? 0 : (i / (count - 1) - 0.5) * arc) + angleShift;
  return {
    x: Math.round(center.x + Math.cos(a) * (radiusX[depth] ?? 0) * radiusMult),
    y: Math.round(center.y + Math.sin(a) * (radiusY[depth] ?? 0) * radiusMult),
  };
}

/**
 * Node position with a random shift (angle along the arc, radius), retried until it
 * keeps `minGap` from every node placed so far; otherwise the roomiest spot tried.
 */
function jitteredPos(rng: Rng, placed: MapNode[], sector: Sector, depth: number, i: number, count: number): Vec {
  const j = WORLD.jitter;
  const deg = Math.PI / 180;
  const slot = count > 1 ? ((WORLD.layout.arcDeg[depth] ?? 0) * deg) / (count - 1) : (WORLD.layout.arcDeg[2] ?? 60) * deg * 0.3;
  const gap = (p: Vec): number => Math.min(Infinity, ...placed.map((n) => Math.hypot(n.pos.x - p.x, n.pos.y - p.y)));
  // The regular slot is the fallback; any shifted spot that keeps more room wins.
  let best = nodePos(sector, depth, i, count);
  let bestGap = gap(best);
  for (let t = 0; t < j.tries; t++) {
    // Depth 3 only shifts inwards and the boss not at all: the outer ring stays free for the lairs.
    const outward = depth >= WORLD.nodesPerDepth.length - 1 ? 0 : j.radius;
    const inward = depth >= WORLD.nodesPerDepth.length ? 0 : j.radius;
    const p = nodePos(sector, depth, i, count, rng.float(-j.angle, j.angle) * slot, 1 + rng.float(-inward, outward));
    const inside = p.x >= j.margin.x && p.x <= VIEW.width - j.margin.x && p.y >= j.margin.top && p.y <= VIEW.height - j.margin.bottom;
    if (!inside) continue;
    const g = gap(p);
    if (g >= j.minGap) return p;
    if (g > bestGap) {
      best = p;
      bestGap = g;
    }
  }
  return best;
}

/** The world of a new run. */
export function createWorld(kind: WorldKind, rng: Rng): World {
  return kind === 'slice' ? generateSliceWorld() : generateWorld(rng);
}

/**
 * Vertical-slice world: Town, «Тихий гай» and the boss lair.
 * Both locations are linked to the town, so the boss is reachable from the start.
 */
export function generateSliceWorld(): World {
  const forest = getBiome('forest');
  const { layout } = SLICE;
  const town = townNode({ ...layout.town });
  const grove: MapNode = {
    id: SLICE_GROVE_ID,
    sector: 'N',
    depth: 1,
    lateralIndex: 0,
    tier: SLICE.grove.baseTier,
    biome: forest.id,
    isBoss: false,
    isTown: false,
    cleared: false,
    timesCleared: 0,
    lastWave: 0,
    growsOnClear: true,
    name: forest.locationNames[0] ?? 'Гай',
    pos: { ...layout.grove },
  };
  const lair: MapNode = {
    id: SLICE_LAIR_ID,
    sector: 'N',
    depth: 4,
    lateralIndex: 0,
    tier: SLICE.bossTier,
    biome: forest.id,
    isBoss: true,
    isTown: false,
    cleared: false,
    timesCleared: 0,
    lastWave: 0,
    name: forest.bossLocation,
    pos: { ...layout.lair },
  };
  return {
    kind: 'slice',
    nodes: [town, grove, lair],
    edges: [
      [TOWN_ID, SLICE_GROVE_ID],
      [TOWN_ID, SLICE_LAIR_ID],
    ],
  };
}

/** Slice rule: the grove gets harder with each completion to imitate going deeper. */
export function sliceGroveTier(timesCleared: number): number {
  const g = SLICE.grove;
  return Math.min(g.maxTier, g.baseTier + g.tierPerClear * timesCleared);
}

/** Marks a location completed and updates its tier; `wavesCleared` is remembered for the next visit. */
export function markCleared(node: MapNode, wavesCleared = 0): void {
  node.cleared = true;
  node.lastWave = Math.max(0, wavesCleared);
  node.timesCleared += 1;
  if (node.growsOnClear) node.tier = sliceGroveTier(node.timesCleared);
}

/** Debug: reset the grove's completion counter (and tier). */
export function resetClears(node: MapNode): void {
  node.timesCleared = 0;
  node.cleared = false;
  node.lastWave = 0;
  if (node.growsOnClear) node.tier = sliceGroveTier(0);
}

/**
 * Tier a location fights at: its own tier plus the boss threat (every boss defeated in
 * the full world makes what is left harder).
 */
export function effectiveTier(world: World, node: MapNode, bossesDefeated: number): number {
  if (world.kind !== 'full' || node.isTown) return node.tier;
  const t = WORLD.bossThreat;
  return node.tier + bossesDefeated * (node.isBoss ? t.bossTier : t.locationTier);
}

export function recommendedLevel(tier: number): number {
  return Math.round(tier * SCALING.recommendedLevelPerTier);
}
