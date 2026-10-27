// Fog of war on the world map (ROADMAP 10.6): the hero sees the places already visited and
// the ones next to them. Secret places (`secret` in the world data) stay hidden even next
// door, until something reveals them (a hint, a quest — stage 16).

import type { GameState } from '../core/state';
import { WORLD_NODES } from '../data/world';
import { neighbours } from './mapgen';
import { questsArrive } from './quests';

const isSecret = (id: string): boolean => WORLD_NODES.some((n) => n.id === id && n.secret);

/** Marks a node as visited (the hero has been there). */
export function markVisited(state: GameState, id: string): void {
  if (!state.nodesVisited.includes(id)) state.nodesVisited.push(id);
  // Arriving somewhere may finish a "reach" objective.
  questsArrive(state, id);
}

/** Reveals a secret place (it shows once the hero has been next to it). */
export function revealSecret(state: GameState, id: string): void {
  if (!state.revealed.includes(id)) state.revealed.push(id);
}

/** Node ids the map shows: visited places, cleared locations, reached towns and their neighbours. */
export function visibleNodes(state: GameState): Set<string> {
  if (state.noFog) return new Set(state.world.nodes.map((n) => n.id));
  const base = new Set<string>([state.currentNodeId, ...state.nodesVisited, ...state.townsVisited]);
  for (const n of state.world.nodes) if (n.timesCleared > 0) base.add(n.id);
  const seen = new Set(base);
  for (const id of base) for (const n of neighbours(state.world, id)) seen.add(n);
  for (const id of [...seen]) if (isSecret(id) && !state.revealed.includes(id) && !base.has(id)) seen.delete(id);
  return seen;
}

export function isVisible(state: GameState, id: string): boolean {
  return visibleNodes(state).has(id);
}
