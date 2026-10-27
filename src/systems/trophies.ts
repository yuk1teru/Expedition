// Trophies (ROADMAP 14.1): monsters drop their own kind (data/trophies.ts), minibosses rare
// ones, bosses theirs; relics lie in the treasure arenas of their region. They are counted
// in the hero's bag, sold to merchants, and "bring" quests take them.

import type { GameState } from '../core/state';
import { QUESTS } from '../data/quests';
import { TROPHIES, type TrophyDef } from '../data/trophies';
import type { Battle } from './battle';
import type { Enemy } from './entities';
import { ordersWant } from './orders';

/** Trophies by the enemy / miniboss / boss that drops them. */
const BY_SOURCE = new Map<string, TrophyDef[]>();
for (const tr of Object.values(TROPHIES)) {
  if (tr.kind === 'relic') continue;
  for (const src of tr.from) BY_SOURCE.set(src, [...(BY_SOURCE.get(src) ?? []), tr]);
}

export function trophiesOf(sourceId: string): TrophyDef[] {
  return BY_SOURCE.get(sourceId) ?? [];
}

export function addTrophy(state: GameState, id: string, count = 1): void {
  const t = state.hero.trophies;
  t[id] = (t[id] ?? 0) + count;
}

/** A killed enemy may drop its trophy (hatched and summoned ones do not). */
export function dropTrophies(b: Battle, e: Enemy): void {
  if (e.summoned && !e.boss) return;
  const source = e.boss ? e.boss.defId : e.defId;
  for (const tr of trophiesOf(source)) {
    if (!b.state.lootRng.chance(tr.chance)) continue;
    gainTrophy(b, tr, e.pos);
  }
}

function gainTrophy(b: Battle, tr: TrophyDef, pos: { x: number; y: number }): void {
  addTrophy(b.state, tr.id);
  b.stats.trophies[tr.id] = (b.stats.trophies[tr.id] ?? 0) + 1;
  b.events.emit({ type: 'trophy', pos: { ...pos }, id: tr.id, kind: tr.kind });
}

/** The treasure arena's chest: relics of the region, each by its own chance. */
export function rollRelics(b: Battle): TrophyDef[] {
  const out: TrophyDef[] = [];
  for (const tr of Object.values(TROPHIES)) {
    if (tr.kind !== 'relic' || !tr.from.includes(b.node.region)) continue;
    if (!b.state.lootRng.chance(tr.chance)) continue;
    gainTrophy(b, tr, b.hero.pos);
    out.push(tr);
  }
  return out;
}

/** How many of this trophy the quests collect and the open orders want (kept when selling). */
export function trophiesWanted(state: GameState, id: string): number {
  let n = ordersWant(state, id);
  for (const qs of state.quests.active) {
    const o = QUESTS[qs.id]?.objectives[qs.step];
    if (o?.kind === 'bring' && o.target === id) n += o.count ?? 1;
  }
  return n;
}

/** What selling all trophies gives (those quests collect are kept): pieces and gold. */
export function trophySale(state: GameState): { count: number; gold: number } {
  let count = 0;
  let gold = 0;
  for (const [id, n] of Object.entries(state.hero.trophies)) {
    const sell = Math.max(0, n - trophiesWanted(state, id));
    count += sell;
    gold += sell * (TROPHIES[id]?.price ?? 0);
  }
  return { count, gold };
}

export function sellTrophies(state: GameState): number {
  const { gold } = trophySale(state);
  for (const [id, n] of Object.entries(state.hero.trophies)) {
    const left = Math.min(n, trophiesWanted(state, id));
    if (left > 0) state.hero.trophies[id] = left;
    else delete state.hero.trophies[id];
  }
  state.gold += gold;
  return gold;
}
