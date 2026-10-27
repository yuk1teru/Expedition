// World map: node/edge types and the fixed world (src/data/world.ts).

import { SCALING, WORLD } from '../data/balance';
import { getBiome } from '../data/biomes';
import { CAPITAL_ID, DEFAULT_MECHANICS, type LocationMechanics, WORLD_NODES, WORLD_ROADS, type WorldNodeDef } from '../data/world';
import type { Vec } from './entities';

export interface MapNode {
  id: string;
  name: string;
  /** Difficulty; recommended level = tier × 3. Towns: 0. */
  tier: number;
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
    tier: def.tier,
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
 * Tier a location fights at: its own tier plus the boss threat (every boss defeated
 * makes what is left harder).
 */
export function effectiveTier(node: MapNode, bossesDefeated: number): number {
  if (node.isTown) return node.tier;
  const t = WORLD.bossThreat;
  return node.tier + bossesDefeated * (node.isBoss ? t.bossTier : t.locationTier);
}

export function recommendedLevel(tier: number): number {
  return Math.round(tier * SCALING.recommendedLevelPerTier);
}
