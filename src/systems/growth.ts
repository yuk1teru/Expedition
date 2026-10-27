// Town growth (ROADMAP 15.4): investing gold, the town's level and what it gives.

import type { GameState } from '../core/state';
import { TOWN_GROWTH, type GrowthLevel } from '../data/growth';

export function townLevel(state: GameState, townId: string): number {
  return state.townGrowth[townId] ?? 0;
}

/** The next level to invest in (undefined: fully grown or no growth here). */
export function nextGrowth(state: GameState, townId: string): GrowthLevel | undefined {
  return TOWN_GROWTH[townId]?.levels[townLevel(state, townId)];
}

/** Pays for the next level. */
export function invest(state: GameState, townId: string): boolean {
  const next = nextGrowth(state, townId);
  if (!next || state.gold < next.cost) return false;
  state.gold -= next.cost;
  state.townGrowth[townId] = townLevel(state, townId) + 1;
  return true;
}

/** The levels a town has reached. */
function reached(state: GameState, townId: string): GrowthLevel[] {
  return TOWN_GROWTH[townId]?.levels.slice(0, townLevel(state, townId)) ?? [];
}

/** Waves fewer in the battle at this town's gates. */
export function townDefense(state: GameState, townId: string): number {
  return reached(state, townId).reduce((a, l) => a + (l.defense ?? 0), 0);
}

/** Merchant price multiplier where the hero stands (a grown town is cheaper). */
export function priceMult(state: GameState): number {
  const discount = reached(state, state.currentNodeId).reduce((a, l) => a + (l.discount ?? 0), 0);
  return Math.max(0.5, 1 - discount);
}

/** A merchant price with the town's discount. */
export function shopPrice(state: GameState, base: number): number {
  return Math.round(base * priceMult(state));
}
