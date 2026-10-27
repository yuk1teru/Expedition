// World map: node/edge types, the fixed world (src/data/world.ts) and the slice world.

import { SCALING, SLICE, WORLD } from '../data/balance';
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
  /** Slice rule: the tier grows with every completion (imitates going deeper). */
  growsOnClear?: boolean;
  pos: Vec;
}

export type MapEdge = [string, string];

export interface World {
  /** `slice`: the vertical-slice world (town, grove, lair), `full`: the fixed world. */
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

/** The starting town (the capital; the slice town too). */
export const TOWN_ID = CAPITAL_ID;
export const SLICE_GROVE_ID = 'grove';
export const SLICE_LAIR_ID = 'lair';

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
  return { kind: 'full', nodes: WORLD_NODES.map(nodeFromDef), edges: WORLD_ROADS.map(([a, b]) => [a, b]) };
}

/** The world of a new run. */
export function createWorld(kind: WorldKind): World {
  return kind === 'slice' ? generateSliceWorld() : buildWorld();
}

/**
 * Vertical-slice world: Town, «Тихий гай» and the boss lair.
 * Both locations are linked to the town, so the boss is reachable from the start.
 */
export function generateSliceWorld(): World {
  const forest = getBiome('forest');
  const { layout } = SLICE;
  const base = { biome: forest.id, region: 'forest', description: '' } as const;
  const town = nodeFromDef({ ...base, id: TOWN_ID, name: 'Місто', kind: 'town', tier: 0, pos: { ...layout.town } });
  const grove = nodeFromDef({ ...base, id: SLICE_GROVE_ID, name: forest.locationNames[0] ?? 'Гай', kind: 'location', tier: SLICE.grove.baseTier, pos: { ...layout.grove } });
  grove.growsOnClear = true;
  const lair = nodeFromDef({ ...base, id: SLICE_LAIR_ID, name: forest.bossLocation, kind: 'boss', tier: SLICE.bossTier, pos: { ...layout.lair } });
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
