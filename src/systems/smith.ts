// The smith (ROADMAP 14.4): reroll a stat line, raise an item's level, take a stone out.
// Works on worn items and identified bag items; prices from data/smith.ts.

import type { GameState } from '../core/state';
import { ITEM_BASES, ITEM_LEVEL, type ItemStat, RARITIES, STAT_LABELS } from '../data/items';
import { SMITH } from '../data/smith';
import { effectiveLevel } from './mapgen';
import type { Hero } from './entities';
import { recomputeHeroStats } from './hero';
import { type Item, itemLevelMult, itemLevelRange } from './items';

/** The highest item level the smith raises to: the top of the hardest cleared location's range. */
export function smithMaxLevel(state: GameState): number {
  const locations = state.world.nodes.filter((n) => !n.isTown);
  const cleared = locations.filter((n) => n.timesCleared > 0);
  const levelOf = (n: (typeof locations)[number]): number => effectiveLevel(n, state.bossesDefeated.length);
  const level = cleared.length > 0 ? Math.max(...cleared.map(levelOf)) : Math.min(...locations.map(levelOf));
  return Math.min(ITEM_LEVEL.max, itemLevelRange(level)[1]);
}

export function rerollPrice(item: Item): number {
  return Math.round(SMITH.reroll * SMITH.rarityMult[item.rarity] * itemLevelMult(item.ilvl, false));
}

export function upgradePrice(state: GameState, item: Item): number {
  const gain = smithMaxLevel(state) - item.ilvl;
  return gain > 0 ? Math.round(gain * SMITH.upgradePerLevel * SMITH.rarityMult[item.rarity]) : 0;
}

export function removeStonePrice(item: Item): number {
  return Math.round(SMITH.removeStone * SMITH.rarityMult[item.rarity]);
}

function pay(state: GameState, price: number): boolean {
  if (state.gold < price) return false;
  state.gold -= price;
  return true;
}

function rollStat(state: GameState, item: Item, stat: ItemStat, range: [number, number]): number {
  const percent = STAT_LABELS[stat].percent;
  const v = state.lootRng.float(range[0], range[1]) * RARITIES[item.rarity].power * itemLevelMult(item.ilvl, percent);
  return percent ? Math.round(v * 100) / 100 : Math.max(1, Math.round(v));
}

/**
 * Rerolls stat line `index`: the main stat gets a new value; an extra one becomes a new stat
 * of the slot's pool (not one the item already has) with a new value.
 */
export function rerollStat(state: GameState, hero: Hero, item: Item, index: number): boolean {
  const line = item.stats[index];
  if (!item.identified || !line || !pay(state, rerollPrice(item))) return false;
  const base = ITEM_BASES[item.slot];
  if (index === 0) line.value = rollStat(state, item, base.main.stat, base.main.range);
  else {
    const taken = new Set(item.stats.map((s, i) => (i === index ? null : s.stat)));
    const pool = base.extras.filter((x) => !taken.has(x.stat));
    const extra = state.lootRng.pick(pool.length > 0 ? pool : base.extras);
    item.stats[index] = { stat: extra.stat, value: rollStat(state, item, extra.stat, extra.range) };
  }
  recomputeHeroStats(hero);
  return true;
}

/** Raises the item to the smith's top level; its stats grow by the level factor. */
export function upgradeItem(state: GameState, hero: Hero, item: Item): boolean {
  const to = smithMaxLevel(state);
  if (!item.identified || to <= item.ilvl || !pay(state, upgradePrice(state, item))) return false;
  for (const s of item.stats) {
    const percent = STAT_LABELS[s.stat].percent;
    const v = (s.value * itemLevelMult(to, percent)) / itemLevelMult(item.ilvl, percent);
    s.value = percent ? Math.round(v * 100) / 100 : Math.max(1, Math.round(v));
  }
  item.ilvl = to;
  recomputeHeroStats(hero);
  return true;
}

/** Takes the stone out: it goes back to the bag (still holding its soul). */
export function removeStone(state: GameState, hero: Hero, item: Item): boolean {
  if (!item.stone || !pay(state, removeStonePrice(item))) return false;
  hero.soulStones.push(item.stone);
  delete item.stone;
  recomputeHeroStats(hero);
  return true;
}
