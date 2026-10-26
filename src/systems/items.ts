// Items: rolls (with a unique look), identification, equipping, selling, consumables.

import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { CONSUMABLES, type ConsumableId } from '../data/consumables';
import {
  BOOT_DASH,
  ITEM_ACCENTS,
  ITEM_BASES,
  ITEM_KINDS,
  ITEM_SLOTS,
  ITEM_SUFFIXES,
  type ItemSlot,
  type ItemStat,
  RARITIES,
  type Rarity,
  STAT_LABELS,
  UNIDENTIFIED_SELL_MULT,
} from '../data/items';
import type { Hero } from './entities';
import { recomputeHeroStats } from './hero';

export interface ItemStatValue {
  stat: ItemStat;
  value: number;
}

/** Per-item visual variation on top of the kind's shape. */
export interface ItemLook {
  accent: string;
  gem: string | null;
  /** 0..1, small shape variation (blade length, brim width…). */
  shape: number;
}

export interface Item {
  uid: number;
  slot: ItemSlot;
  rarity: Rarity;
  /** Kind id (sword, axe, hood…), decides the icon. */
  kind: string;
  name: string;
  stats: ItemStatValue[];
  look: ItemLook;
  /** Unidentified items show "???" and can't be worn until a magnifier is used. */
  identified: boolean;
  /** Not looked at in the inventory yet (drives the blinking hint). */
  isNew?: boolean;
}

function rollValue(rng: Rng, range: [number, number], power: number, stat: ItemStat): number {
  const v = rng.float(range[0], range[1]) * power;
  return STAT_LABELS[stat].percent ? Math.round(v * 100) / 100 : Math.max(1, Math.round(v));
}

/** Rolls an item of the given rarity (random slot unless given). New items are unidentified. */
export function rollItem(rng: Rng, rarity: Rarity, uid: number, slot?: ItemSlot): Item {
  const s = slot ?? rng.pick(ITEM_SLOTS).id;
  const base = ITEM_BASES[s];
  const r = RARITIES[rarity];
  const stats: ItemStatValue[] = [{ stat: base.main.stat, value: rollValue(rng, base.main.range, r.power, base.main.stat) }];
  for (const extra of rng.shuffle(base.extras).slice(0, r.extraStats)) {
    stats.push({ stat: extra.stat, value: rollValue(rng, extra.range, r.power, extra.stat) });
  }
  const kind = rng.pick(ITEM_KINDS[s]);
  return {
    uid,
    slot: s,
    rarity,
    kind: kind.id,
    name: `${kind.name} ${rng.pick(ITEM_SUFFIXES)}`,
    stats,
    look: { accent: rng.pick(ITEM_ACCENTS), gem: rng.chance(0.5) ? rng.pick(ITEM_ACCENTS) : null, shape: rng.next() },
    identified: false,
  };
}

/** Rolls a rarity from a weight table. */
export function rollRarity(rng: Rng, weights: Partial<Record<Rarity, number>>): Rarity {
  return rng.weighted((Object.entries(weights) as [Rarity, number][]).map(([item, weight]) => ({ item, weight })));
}

/** Name as the player sees it. */
export function displayName(item: Item): string {
  if (item.identified) return item.name;
  const slot = ITEM_SLOTS.find((x) => x.id === item.slot)?.name ?? '';
  return `??? (${slot.toLowerCase()})`;
}

/** Loot always goes into the bag, marked as new; the player wears it from the inventory. */
export function stashLoot(hero: Hero, item: Item): void {
  hero.bag.push({ ...item, isNew: true });
}

export function hasNewItems(hero: Hero): boolean {
  return hero.bag.some((i) => i.isNew);
}

/** Called when the inventory is closed: everything has been seen. */
export function markItemsSeen(hero: Hero): void {
  for (const i of hero.bag) delete i.isNew;
}

/** Uses a magnifier on a bag item. */
export function identifyItem(hero: Hero, bagIndex: number): boolean {
  const item = hero.bag[bagIndex];
  if (!item || item.identified || hero.consumables.magnifier <= 0) return false;
  hero.consumables.magnifier -= 1;
  item.identified = true;
  return true;
}

/** Wears a bag item (must be identified); the previously worn item goes back to the bag. */
export function equipFromBag(hero: Hero, bagIndex: number): boolean {
  const item = hero.bag[bagIndex];
  if (!item || !item.identified) return false;
  hero.bag.splice(bagIndex, 1);
  delete item.isNew;
  const worn = hero.equipment[item.slot];
  if (worn) hero.bag.push(worn);
  hero.equipment[item.slot] = item;
  recomputeHeroStats(hero);
  return true;
}

/** Takes a worn item off into the bag. */
export function unequip(hero: Hero, slot: ItemSlot): void {
  const item = hero.equipment[slot];
  if (!item) return;
  delete hero.equipment[slot];
  hero.bag.push(item);
  recomputeHeroStats(hero);
}

export function sellPrice(item: Item): number {
  const base = RARITIES[item.rarity].sellPrice;
  return item.identified ? base : Math.round(base * UNIDENTIFIED_SELL_MULT);
}

/** Merchant buys a bag item. */
export function sellItem(state: GameState, bagIndex: number): number {
  const item = state.hero.bag[bagIndex];
  if (!item) return 0;
  const price = sellPrice(item);
  state.hero.bag.splice(bagIndex, 1);
  state.gold += price;
  return price;
}

export function canBuy(state: GameState, id: ConsumableId): boolean {
  const def = CONSUMABLES[id];
  return state.gold >= def.price && state.hero.consumables[id] < def.max;
}

export function buyConsumable(state: GameState, id: ConsumableId): boolean {
  if (!canBuy(state, id)) return false;
  state.gold -= CONSUMABLES[id].price;
  state.hero.consumables[id] += 1;
  return true;
}

/**
 * Simulation bot: buys magnifiers for unidentified items it can afford,
 * identifies them and wears whatever fits an empty slot.
 */
export function botIdentifyAndEquip(state: GameState): void {
  const hero = state.hero;
  for (let i = 0; i < hero.bag.length; i++) {
    const item = hero.bag[i]!;
    if (item.identified || hero.equipment[item.slot]) continue;
    if (hero.consumables.magnifier <= 0 && !buyConsumable(state, 'magnifier')) continue;
    identifyItem(hero, i);
  }
  for (let i = hero.bag.length - 1; i >= 0; i--) {
    const item = hero.bag[i];
    if (item && item.identified && !hero.equipment[item.slot]) equipFromBag(hero, i);
  }
}

export function formatStat(s: ItemStatValue): string {
  const l = STAT_LABELS[s.stat];
  return l.percent ? `+${Math.round(s.value * 100)}% ${l.label}` : `+${s.value} ${l.label}`;
}

/** Sum of a stat over all equipped items. */
/** The Shift dash of the worn boots, if they have one. */
export function bootDash(hero: Hero): { distance: number; cooldown: number } | null {
  const boots = hero.equipment.boots;
  return boots ? (BOOT_DASH[boots.rarity] ?? null) : null;
}

/** Extra item lines beyond stats (the boot dash). */
export function itemPerks(item: Item): string[] {
  const dash = item.slot === 'boots' ? BOOT_DASH[item.rarity] : undefined;
  return dash ? [`Shift — ривок до курсора на ${dash.distance} px (перезарядка ${dash.cooldown} с)`] : [];
}

export function equippedStat(hero: Hero, stat: ItemStat): number {
  let sum = 0;
  for (const item of Object.values(hero.equipment)) {
    if (!item) continue;
    for (const s of item.stats) if (s.stat === stat) sum += s.value;
  }
  return sum;
}
