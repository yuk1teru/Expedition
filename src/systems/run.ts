// Run-level flow: new expedition, travel on the map, town actions.

import { Rng } from '../core/rng';
import { createRunStats, type GameState } from '../core/state';
import { createHero, healFull } from './hero';
import { TOWN_ID, areAdjacent, generateSliceWorld, getNode } from './mapgen';

export function createGameState(seed: number): GameState {
  const rng = new Rng(seed);
  return {
    seed,
    rng,
    cardRng: rng.fork('cards'),
    battleCount: 0,
    day: 1,
    gold: 0,
    hero: createHero(0),
    world: generateSliceWorld(),
    currentNodeId: TOWN_ID,
    bossesDefeated: [],
    stats: createRunStats(),
    screen: 'town',
    modalQueue: [],
  };
}

export type TravelResult = { kind: 'town' } | { kind: 'battle'; nodeId: string } | { kind: 'blocked' };

/**
 * Click on a map node. Adjacent node → move there (town opens the town,
 * a location starts its battle). Clicking the current location replays it.
 */
export function travel(state: GameState, nodeId: string): TravelResult {
  const target = getNode(state.world, nodeId);
  const here = state.currentNodeId;
  if (nodeId !== here && !areAdjacent(state.world, here, nodeId)) return { kind: 'blocked' };
  state.currentNodeId = nodeId;
  if (target.isTown) return { kind: 'town' };
  return { kind: 'battle', nodeId };
}

/** Debug / slice shortcut: jump straight to a node regardless of edges. */
export function teleport(state: GameState, nodeId: string): TravelResult {
  getNode(state.world, nodeId);
  state.currentNodeId = nodeId;
  return getNode(state.world, nodeId).isTown ? { kind: 'town' } : { kind: 'battle', nodeId };
}

export function restInTown(state: GameState): void {
  healFull(state.hero);
}

export function canTravel(state: GameState, nodeId: string): boolean {
  return nodeId === state.currentNodeId ? !getNode(state.world, nodeId).isTown : areAdjacent(state.world, state.currentNodeId, nodeId);
}
