// «Швидка тарадайка» (ROADMAP 10.5): the coachman takes the hero between towns already
// reached on foot, for gold, without days or battles.

import type { GameState } from '../core/state';
import { COACH, WAVES } from '../data/balance';
import { markVisited } from './fog';
import { getNode } from './mapgen';
import { clearBonusGold, goldReward, levelTier, waveGoldMult } from './scaling';
import { waveSize } from './waves';

/** Gold one visit of a location of this monster level brings: the mandatory waves' kills and the clear bonus. */
export function locationGold(level: number): number {
  const tier = levelTier(level);
  let kills = 0;
  for (let i = 0; i < WAVES.count; i++) kills += waveSize(tier, i) * goldReward(tier) * waveGoldMult(i);
  return kills + clearBonusGold(tier);
}

/** The ride's price to a town: a share of the gold of the easiest location of its region. */
export function coachPrice(state: GameState, townId: string): number {
  if (state.freeCoach) return 0;
  const town = getNode(state.world, townId);
  const locations = state.world.nodes.filter((n) => !n.isTown && !n.isBoss);
  const own = locations.filter((n) => n.region === town.region);
  const level = Math.min(...(own.length > 0 ? own : locations).map((n) => n.level));
  const raw = locationGold(level) * COACH.share;
  return Math.max(COACH.min, Math.round(raw / COACH.roundTo) * COACH.roundTo);
}

/** Towns the coachman can take the hero to: reached on foot before, not the current one. */
export function coachDestinations(state: GameState): string[] {
  return state.townsVisited.filter((id) => id !== state.currentNodeId);
}

/** Marks a town reached (on foot): the coachman can go there from now on. */
export function visitTown(state: GameState, townId: string): void {
  if (getNode(state.world, townId).isTown && !state.townsVisited.includes(townId)) state.townsVisited.push(townId);
}

/** Pays and moves the hero; false — not a destination or not enough gold. */
export function rideCoach(state: GameState, townId: string): boolean {
  if (!coachDestinations(state).includes(townId)) return false;
  const price = coachPrice(state, townId);
  if (state.gold < price) return false;
  state.gold -= price;
  state.currentNodeId = townId;
  markVisited(state, townId);
  return true;
}
