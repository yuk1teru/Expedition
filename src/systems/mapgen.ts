// World map: node/edge types and generators.

import { SCALING, SLICE } from '../data/balance';
import { getBiome } from '../data/biomes';
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
  name: string;
  pos: Vec;
}

export type MapEdge = [string, string];

export interface World {
  nodes: MapNode[];
  edges: MapEdge[];
}

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

/**
 * Vertical-slice world: Town, «Тихий гай» and the boss lair.
 * Both locations are linked to the town, so the boss is reachable from the start.
 */
export function generateSliceWorld(): World {
  const forest = getBiome('forest');
  const { layout } = SLICE;
  const town: MapNode = {
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
    name: 'Місто',
    pos: { ...layout.town },
  };
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
    name: forest.locationNames[1] ?? 'Лігво',
    pos: { ...layout.lair },
  };
  return {
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

/** Marks a location completed and updates its tier. */
export function markCleared(node: MapNode): void {
  node.cleared = true;
  node.timesCleared += 1;
  if (!node.isBoss && !node.isTown) node.tier = sliceGroveTier(node.timesCleared);
}

/** Debug: reset the grove's completion counter (and tier). */
export function resetClears(node: MapNode): void {
  node.timesCleared = 0;
  node.cleared = false;
  if (!node.isBoss && !node.isTown) node.tier = sliceGroveTier(0);
}

export function recommendedLevel(tier: number): number {
  return Math.round(tier * SCALING.recommendedLevelPerTier);
}
