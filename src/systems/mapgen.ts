// World map: node/edge types and the fixed world (src/data/world.ts).

import { PROGRESSION, WORLD } from '../data/balance';
import { getBiome } from '../data/biomes';
import { CAPITAL_ID, DEFAULT_MECHANICS, type LocationMechanics, WORLD_NODES, WORLD_ROADS, type WorldNodeDef } from '../data/world';
import type { Vec } from './entities';
import type { Item } from './items';

export interface MapNode {
  id: string;
  name: string;
  /** Monster level (towns: 0). */
  level: number;
  /** Arena look (palette, decor); for towns — their style. */
  biome: string;
  /** Map region (forest, swamp, coast…). */
  region: string;
  isBoss: boolean;
  isTown: boolean;
  /** Enemies of the waves, the miniboss of every 3rd wave ('' — none), the boss of a lair. */
  enemies: string[];
  miniboss: string;
  boss: string;
  mechanics: LocationMechanics;
  description: string;
  cleared: boolean;
  /** How many times the location was completed. */
  timesCleared: number;
  /** Waves cleared on the last completed visit (the next visit may continue from there). */
  lastWave: number;
  /** The gift altar of this location was used (it gives once, ROADMAP 13.2). */
  altarUsed?: boolean;
  /** Loot left here by a death: given back when the location is cleared again. */
  lostLoot: { items: Item[]; gold: number } | null;
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

/** The starting town (the capital). */
export const TOWN_ID = CAPITAL_ID;

/** A map node from its data: missing enemies, miniboss and mechanics come from the biome / defaults. */
export function nodeFromDef(def: WorldNodeDef): MapNode {
  const biome = getBiome(def.biome);
  return {
    id: def.id,
    name: def.name,
    level: def.level,
    biome: def.biome,
    region: def.region,
    isBoss: def.kind === 'boss',
    isTown: def.kind === 'town',
    enemies: [...(def.enemies ?? biome.enemies)],
    miniboss: def.miniboss ?? (def.kind === 'location' ? biome.miniboss : ''),
    boss: def.boss ?? (def.kind === 'boss' ? biome.boss : ''),
    mechanics: { ...DEFAULT_MECHANICS, ...def.mechanics },
    description: def.description,
    cleared: false,
    timesCleared: 0,
    lastWave: 0,
    lostLoot: null,
    pos: { ...def.pos },
  };
}

/** The fixed world (PLAN.md 8.1): towns, locations and roads from src/data/world.ts. */
export function buildWorld(): World {
  return { nodes: WORLD_NODES.map(nodeFromDef), edges: WORLD_ROADS.map(([a, b]) => [a, b]) };
}

/** Marks a location completed; `wavesCleared` is remembered for the next visit. */
export function markCleared(node: MapNode, wavesCleared = 0): void {
  node.cleared = true;
  node.lastWave = Math.max(0, wavesCleared);
  node.timesCleared += 1;
}

/** Debug: reset a location's completion counter. */
export function resetClears(node: MapNode): void {
  node.timesCleared = 0;
  node.cleared = false;
  node.lastWave = 0;
}

/**
 * Monster level a location fights at: its own level plus the boss threat (every boss
 * defeated makes what is left harder), never above the hero's maximum level (ROADMAP 10.2).
 */
export function effectiveLevel(node: MapNode, bossesDefeated: number): number {
  if (node.isTown) return node.level;
  const t = WORLD.bossThreat;
  const raised = node.level + bossesDefeated * (node.isBoss ? t.bossLevels : t.locationLevels);
  return Math.min(Math.max(node.level, PROGRESSION.maxLevel), raised);
}

/**
 * Autopath (ROADMAP 10.4): the shortest way from `from` to `to` that goes only through
 * towns and cleared locations (never through a boss lair); `to` itself may be anything
 * next to such a way. The node ids after `from`, ending with `to`; null — no such way.
 */
export function findRoute(world: World, from: string, to: string): string[] | null {
  if (from === to) return [];
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    const node = getNode(world, cur);
    // The way goes on only from the start, towns and cleared locations.
    if (cur !== from && !node.isTown && (node.isBoss || node.timesCleared === 0)) continue;
    for (const n of neighbours(world, cur)) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(to)) return null;
  const path: string[] = [];
  for (let at: string | null = to; at !== null && at !== from; at = prev.get(at) ?? null) path.unshift(at);
  return path;
}
