// Bot 2.0 in town (ROADMAP 15.5): it talks to everyone (quests through the same dialogue
// options a player clicks), sells trophies, hands in orders, brews, forges, sets soul stones
// and invests in the town — what a careful player would do on a rest.

import type { GameState } from '../src/core/state';
import { RECIPES } from '../src/data/alchemy';
import { TOWN_GROWTH } from '../src/data/growth';
import { ITEM_SLOTS } from '../src/data/items';
import { LIVES } from '../src/data/balance';
import { getNpc } from '../src/data/npcs';
import { SMITH } from '../src/data/smith';
import { ARTIFACT_ORDERS } from '../src/data/trophies';
import { INTERIORS, getTownLayout, grownLayout } from '../src/data/towns';
import { brew, brewBlock } from '../src/systems/alchemy';
import { invest, nextGrowth, townLevel } from '../src/systems/growth';
import { completeOrder, ordersUnlocked } from '../src/systems/orders';
import { withQuests } from '../src/systems/quests';
import { upgradeItem, upgradePrice } from '../src/systems/smith';
import { socketStone } from '../src/systems/souls';
import { sellTrophies } from '../src/systems/trophies';

/** Gold the bot keeps for potions after crafting and investing. */
const RESERVE = 120;

/** Everyone living in the town as it stands (street and rooms). */
export function townNpcs(state: GameState, townId: string): string[] {
  const layout = grownLayout(getTownLayout(townId), townLevel(state, townId));
  const out = layout.npcs.map((n) => n.id);
  for (const b of layout.buildings) if (b.interior) out.push(...(INTERIORS[b.interior]?.npcs.map((n) => n.id) ?? []));
  return out;
}

/** Talks to an NPC about the quests: hands in, reports, takes every offer (like a player clicking). */
function talkQuests(state: GameState, npcId: string): number {
  let acted = 0;
  for (let guard = 0; guard < 10; guard++) {
    const npc = withQuests(getNpc(npcId), state);
    const quest = npc.nodes[npc.start]!.options.find((o) => o.next?.startsWith('quest:'));
    if (!quest) break;
    const run = npc.nodes[quest.next!]!.options.find((o) => o.run)?.run;
    if (!run) break;
    run();
    acted++;
  }
  return acted;
}

export function botTownServices(state: GameState): void {
  const town = state.currentNodeId;
  const npcs = townNpcs(state, town);
  for (const id of npcs) talkQuests(state, id);
  sellTrophies(state);
  if (ordersUnlocked(state)) for (const o of ARTIFACT_ORDERS) completeOrder(state, o.id);
  // Alchemy: a life back first, then an elixir if none is active.
  const brewers = new Set(npcs.filter((id) => RECIPES.some((r) => r.at.includes(id))));
  const canBrew = RECIPES.filter((r) => r.at.some((a) => brewers.has(a)) && brewBlock(state, r) === null && state.gold - r.gold >= RESERVE);
  const life = canBrew.find((r) => r.result.kind === 'life');
  if (life && state.lives < LIVES.max) brew(state, life.id);
  const elixir = canBrew.find((r) => r.result.kind === 'elixir');
  if (elixir && !state.hero.elixir) brew(state, elixir.id);
  // Soul stones: the weapon first (an element), then the rest.
  for (const slot of ['weapon', ...ITEM_SLOTS.map((s) => s.id).filter((s) => s !== 'weapon')] as const) {
    if (state.hero.soulStones.length === 0) break;
    const item = state.hero.equipment[slot];
    if (item && !item.stone) socketStone(state.hero, 0, slot);
  }
  // The smith: raise worn items while gold lasts.
  if (npcs.some((id) => SMITH.at.includes(id))) {
    for (const s of ITEM_SLOTS) {
      const item = state.hero.equipment[s.id];
      if (!item) continue;
      const price = upgradePrice(state, item);
      if (price > 0 && state.gold - price >= RESERVE) upgradeItem(state, state.hero, item);
    }
  }
  // Grow the town with what is left over.
  const g = TOWN_GROWTH[town];
  const next = g ? nextGrowth(state, town) : undefined;
  if (next && state.gold - next.cost >= RESERVE * 2) invest(state, town);
}
