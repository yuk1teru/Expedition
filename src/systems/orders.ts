// The artifact buyer's orders (ROADMAP 14.1а): a set of trophies for far more gold than a
// merchant gives. Each order is done once. Where to look is told from the world data.

import type { GameState } from '../core/state';
import { BOSSES } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { fillNames } from '../data/names';
import { ARTIFACT_ORDERS, type ArtifactOrder, TROPHIES } from '../data/trophies';
import { WORLD_MAP } from '../data/world';

export function getOrder(id: string): ArtifactOrder | undefined {
  return ARTIFACT_ORDERS.find((o) => o.id === id);
}

/** The buyer shows his orders after this quest (he first wants to see an old coin). */
export const ORDERS_QUEST = 'systemBuyer';

export function ordersUnlocked(state: GameState): boolean {
  return state.quests.done.includes(ORDERS_QUEST);
}

export function orderOpen(state: GameState, id: string): boolean {
  return !state.ordersDone.includes(id);
}

/** What the bag holds for each wanted trophy, and whether the whole set is there. */
export function orderProgress(state: GameState, order: ArtifactOrder): { have: number[]; ready: boolean } {
  const have = order.wants.map((w) => Math.min(w.count, state.hero.trophies[w.trophy] ?? 0));
  return { have, ready: order.wants.every((w, i) => have[i]! >= w.count) };
}

/** Hands the set in: the trophies leave the bag, the gold comes. False — not ready or done. */
export function completeOrder(state: GameState, id: string): boolean {
  const order = getOrder(id);
  if (!order || !ordersUnlocked(state) || !orderOpen(state, id) || !orderProgress(state, order).ready) return false;
  for (const w of order.wants) {
    const left = (state.hero.trophies[w.trophy] ?? 0) - w.count;
    if (left > 0) state.hero.trophies[w.trophy] = left;
    else delete state.hero.trophies[w.trophy];
  }
  state.gold += order.pay;
  state.ordersDone.push(id);
  return true;
}

/** How many of this trophy the open orders want (kept from the merchant). */
export function ordersWant(state: GameState, trophyId: string): number {
  if (!ordersUnlocked(state)) return 0;
  let n = 0;
  for (const o of ARTIFACT_ORDERS) {
    if (!orderOpen(state, o.id)) continue;
    for (const w of o.wants) if (w.trophy === trophyId) n += w.count;
  }
  return n;
}

/** Where a trophy comes from, in a line: "Вовк — Тихий гай, Вовча стежка" or "скарби: Ліс". */
export function trophyWhere(state: GameState, trophyId: string): string {
  const tr = TROPHIES[trophyId];
  if (!tr) return '';
  if (tr.kind === 'relic') return `скарби: ${tr.from.map((r) => WORLD_MAP.regions.find((x) => x.id === r)?.name ?? r).join(', ')}`;
  return tr.from
    .map((src) => {
      const who = ENEMIES[src]?.name ?? BOSSES[src]?.name ?? src;
      const at = state.world.nodes.filter((n) => !n.isTown && (n.enemies.includes(src) || n.miniboss === src || n.boss === src)).map((n) => n.name);
      return `${fillNames(who)} — ${at.slice(0, 3).join(', ') || '?'}`;
    })
    .join('; ');
}
