// World map: node/edge types and generators.

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
