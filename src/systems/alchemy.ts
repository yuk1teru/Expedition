// Alchemy (ROADMAP 14.2): brewing a recipe takes its trophies and gold; potions go to the
// bag, an elixir is drunk at once (one at a time, it holds for some arenas), the Elixir of
// return gives a life.

import type { GameState } from '../core/state';
import { RECIPES, type RecipeDef } from '../data/alchemy';
import { LIVES } from '../data/balance';
import { CONSUMABLES } from '../data/consumables';
import type { GiftStat } from '../data/gifts';
import type { Hero } from './entities';
import { recomputeHeroStats } from './hero';

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function recipesAt(npcId: string): RecipeDef[] {
  return RECIPES.filter((r) => r.at.includes(npcId));
}

export function recipeKnown(state: GameState, r: RecipeDef): boolean {
  return !r.quest || state.quests.done.includes(r.quest);
}

/** Why it cannot be brewed now (null: it can). */
export function brewBlock(state: GameState, r: RecipeDef): string | null {
  if (!recipeKnown(state, r)) return 'рецепт ще не відомий';
  const res = r.result;
  if (res.kind === 'consumable' && state.hero.consumables[res.id] >= CONSUMABLES[res.id].max) return 'сумка повна';
  if (res.kind === 'life' && state.lives >= LIVES.max) return 'життів досить';
  if (r.needs.some((n) => (state.hero.trophies[n.trophy] ?? 0) < n.count)) return 'бракує частин';
  if (state.gold < r.gold) return 'бракує золота';
  return null;
}

export function brew(state: GameState, id: string): boolean {
  const r = getRecipe(id);
  if (!r || brewBlock(state, r)) return false;
  const bag = state.hero.trophies;
  for (const n of r.needs) {
    const left = (bag[n.trophy] ?? 0) - n.count;
    if (left > 0) bag[n.trophy] = left;
    else delete bag[n.trophy];
  }
  state.gold -= r.gold;
  const res = r.result;
  if (res.kind === 'consumable') state.hero.consumables[res.id] += 1;
  else if (res.kind === 'life') state.lives = Math.min(LIVES.max, state.lives + 1);
  else {
    state.hero.elixir = { recipe: r.id, arenas: res.arenas };
    recomputeHeroStats(state.hero);
  }
  return true;
}

/** The active elixir's bonus to a stat (0: none). */
export function elixirStat(hero: Hero, stat: GiftStat): number {
  const e = hero.elixir;
  if (!e) return 0;
  const res = getRecipe(e.recipe)?.result;
  return res?.kind === 'elixir' && res.stat === stat ? res.value : 0;
}

/** An arena is behind: the elixir wanes; the last one ends it. */
export function elixirArenaDone(hero: Hero): void {
  const e = hero.elixir;
  if (!e) return;
  e.arenas -= 1;
  if (e.arenas > 0) return;
  hero.elixir = null;
  recomputeHeroStats(hero);
}
