// Items: rolls (with a unique look), identification, equipping, selling, consumables.

import { shopPrice } from './growth';
import { LEGENDARIES } from '../data/uniques';
import { applyUniques, pickLegendary, uniqueLines } from './uniques';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { CONSUMABLES, type ConsumableId, HEAL_ORDER, type HealId } from '../data/consumables';
import {
  BOOT_DASH,
  ITEM_ACCENTS,
  ITEM_LEVEL,
  MERCHANT_ITEMS,
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
  BLIND_BUYER,
  STASH,
} from '../data/items';
import type { Hero } from './entities';
import { effectiveLevel } from './mapgen';
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
  /** Item level (1–300): scales the stats and the price. */
  ilvl: number;
  stats: ItemStatValue[];
  look: ItemLook;
  /** Unidentified items show "???" and can't be worn until a magnifier is used. */
  identified: boolean;
  /** Not looked at in the inventory yet (drives the blinking hint). */
  isNew?: boolean;
  /** A rune stone with this soul set into it (ROADMAP 14.3); one per item. */
  stone?: string;
  /** Legendary power (ROADMAP 14.5): a LEGENDARIES id. */
  legendary?: string;
  /** A skill affix: +1 to a skill's rank or a cut of its cooldown. */
  affix?: { kind: 'rank' | 'cooldown'; skill: string; value: number };
  /** A piece of this set (ITEM_SETS id). */
  set?: string;
}

/** Stat multiplier of an item level: linear for flat stats, square root for percent ones. */
export function itemLevelMult(ilvl: number, percent: boolean): number {
  const flat = ITEM_LEVEL.floor + ((1 - ITEM_LEVEL.floor) * ilvl) / ITEM_LEVEL.reference;
  return percent ? Math.sqrt(flat) : flat;
}

function rollValue(rng: Rng, range: [number, number], power: number, stat: ItemStat, ilvl: number): number {
  const percent = STAT_LABELS[stat].percent;
  const v = rng.float(range[0], range[1]) * power * itemLevelMult(ilvl, percent);
  return percent ? Math.round(v * 100) / 100 : Math.max(1, Math.round(v));
}

/** Rolls an item of the given rarity and level (random slot unless given). New items are unidentified. */
export function rollItem(rng: Rng, rarity: Rarity, uid: number, slot?: ItemSlot, ilvl: number = ITEM_LEVEL.reference, classId?: string | null): Item {
  // A legendary: one of the powers (of the hero's class most often) — its slot comes from it.
  const power = rarity === 'legendary' && !slot ? pickLegendary(rng, Object.values(LEGENDARIES), classId) : undefined;
  const s = slot ?? power?.slot ?? rng.pick(ITEM_SLOTS).id;
  const base = ITEM_BASES[s];
  const r = RARITIES[rarity];
  const level = Math.max(1, Math.min(ITEM_LEVEL.max, Math.round(ilvl)));
  const stats: ItemStatValue[] = [{ stat: base.main.stat, value: rollValue(rng, base.main.range, r.power, base.main.stat, level) }];
  for (const extra of rng.shuffle(base.extras).slice(0, r.extraStats)) {
    stats.push({ stat: extra.stat, value: rollValue(rng, extra.range, r.power, extra.stat, level) });
  }
  const kind = rng.pick(ITEM_KINDS[s]);
  const item: Item = {
    uid,
    slot: s,
    rarity,
    kind: kind.id,
    name: `${kind.name} ${rng.pick(ITEM_SUFFIXES)}`,
    ilvl: level,
    stats,
    look: { accent: rng.pick(ITEM_ACCENTS), gem: rng.chance(0.5) ? rng.pick(ITEM_ACCENTS) : null, shape: rng.next() },
    identified: false,
    ...(power ? { legendary: power.id } : {}),
  };
  applyUniques(rng, item, classId);
  return item;
}

/** Item level range [min, max] of a location of this monster level. */
export function itemLevelRange(level: number): [number, number] {
  const pts = ITEM_LEVEL.byLevel;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (level <= first[0]) return [first[1], first[2]];
  if (level >= last[0]) return [last[1], last[2]];
  for (let i = 1; i < pts.length; i++) {
    const [t1, lo1, hi1] = pts[i]!;
    if (level > t1) continue;
    const [t0, lo0, hi0] = pts[i - 1]!;
    const k = (level - t0) / (t1 - t0);
    return [Math.round(lo0 + (lo1 - lo0) * k), Math.round(hi0 + (hi1 - hi0) * k)];
  }
  return [last[1], last[2]];
}

/**
 * Item level of a drop at a location with ilvl range `range`: minibosses climb with the
 * wave (`wave` = 1-based wave number), the boss drops from the top of the range.
 */
export function dropItemLevel(rng: Rng, range: [number, number], source: 'miniboss' | 'boss', wave: number): number {
  const [min, max] = range;
  if (source === 'boss') return rng.int(Math.round(min + (max - min) * ITEM_LEVEL.bossFrom), max);
  const m = ITEM_LEVEL.miniboss;
  const t = Math.min(1, wave / m.fullWave) * m.top;
  const jitter = rng.int(-m.jitter, m.jitter);
  return Math.max(min, Math.min(max, Math.round(min + (max - min) * t) + jitter));
}

/** Item level range the merchant sells: a band of the range of the hardest location cleared. */
export function merchantItemLevels(state: GameState): [number, number] {
  const locations = state.world.nodes.filter((n) => !n.isTown);
  const cleared = locations.filter((n) => n.timesCleared > 0);
  // Nothing cleared yet: the easiest location.
  const levelOf = (n: (typeof locations)[number]): number => effectiveLevel(n, state.bossesDefeated.length);
  const level = cleared.length > 0 ? Math.max(...cleared.map(levelOf)) : Math.min(...locations.map(levelOf));
  const [min, max] = itemLevelRange(level);
  const [lo, hi] = ITEM_LEVEL.merchant;
  return [Math.round(min + (max - min) * lo), Math.round(min + (max - min) * hi)];
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
  const base = Math.round(RARITIES[item.rarity].sellPrice * itemLevelMult(item.ilvl, false));
  return item.identified ? base : Math.round(base * UNIDENTIFIED_SELL_MULT);
}

/** What the buyer of unidentified items pays for one. */
export function blindPrice(item: Item): number {
  return Math.round(RARITIES[item.rarity].sellPrice * itemLevelMult(item.ilvl, false) * BLIND_BUYER.mult);
}

/** The buyer takes every unidentified bag item: how many and for how much. */
export function sellBlind(state: GameState): { count: number; gold: number } {
  const blind = state.hero.bag.filter((x) => !x.identified);
  const gold = blind.reduce((a, x) => a + blindPrice(x), 0);
  state.hero.bag = state.hero.bag.filter((x) => x.identified);
  state.gold += gold;
  return { count: blind.length, gold };
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

/**
 * Adds a carried consumable (if there is room). A healing item that is on no quick
 * slot yet takes the first empty one.
 */
export function gainConsumable(hero: Hero, id: ConsumableId): boolean {
  if (hero.consumables[id] >= CONSUMABLES[id].max) return false;
  hero.consumables[id] += 1;
  if (isHeal(id) && !hero.quickSlots.includes(id)) {
    const free = hero.quickSlots.indexOf(null);
    if (free >= 0) hero.quickSlots[free] = id;
  }
  return true;
}

export function isHeal(id: ConsumableId): id is HealId {
  return (HEAL_ORDER as string[]).includes(id);
}

/** Puts a healing item on a quick slot (it leaves any other slot it was on); null clears. */
export function assignQuickSlot(hero: Hero, slot: number, id: HealId | null): void {
  if (slot < 0 || slot >= hero.quickSlots.length) return;
  if (id) hero.quickSlots = hero.quickSlots.map((x) => (x === id ? null : x));
  hero.quickSlots[slot] = id;
}

/** Merchant: a random identified item for `slot` (uncommon to epic) into the bag; null if no gold. */
export function buyItem(state: GameState, slot: ItemSlot): Item | null {
  const price = shopPrice(state, MERCHANT_ITEMS.price);
  if (state.gold < price) return null;
  state.gold -= price;
  const [lo, hi] = merchantItemLevels(state);
  const rarity = rollRarity(state.lootRng, MERCHANT_ITEMS.weights);
  const item = rollItem(state.lootRng, rarity, state.nextItemUid++, slot, state.lootRng.int(lo, hi), state.hero.classId);
  item.identified = true;
  item.isNew = true;
  state.hero.bag.push(item);
  return item;
}

export function canBuy(state: GameState, id: ConsumableId): boolean {
  const def = CONSUMABLES[id];
  return def.price > 0 && state.gold >= shopPrice(state, def.price) && state.hero.consumables[id] < def.max;
}

export function buyConsumable(state: GameState, id: ConsumableId): boolean {
  if (!canBuy(state, id)) return false;
  state.gold -= shopPrice(state, CONSUMABLES[id].price);
  gainConsumable(state.hero, id);
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

/** Stat change if `item` replaced `worn`: one entry per stat that differs (positive = better). */
export function compareItems(item: Item, worn: Item): ItemStatValue[] {
  const sum = (it: Item, stat: ItemStat): number => it.stats.filter((x) => x.stat === stat).reduce((a, x) => a + x.value, 0);
  const stats = new Set<ItemStat>([...item.stats.map((x) => x.stat), ...worn.stats.map((x) => x.stat)]);
  const out: ItemStatValue[] = [];
  for (const stat of stats) {
    const value = Math.round((sum(item, stat) - sum(worn, stat)) * 100) / 100;
    if (value !== 0) out.push({ stat, value });
  }
  return out;
}

/** "+3% швидкості руху" / "−2 броні". */
export function formatStatDelta(s: ItemStatValue): string {
  const l = STAT_LABELS[s.stat];
  const sign = s.value > 0 ? '+' : '−';
  const v = Math.abs(s.value);
  return l.percent ? `${sign}${Math.round(v * 100)}% ${l.label}` : `${sign}${v} ${l.label}`;
}

/** The Shift dash of the worn boots, if they have one. */
export function bootDash(hero: Hero): { distance: number; cooldown: number } | null {
  const boots = hero.equipment.boots;
  return boots ? (BOOT_DASH[boots.rarity] ?? null) : null;
}

/** Extra item lines beyond stats (the boot dash). */
export function itemPerks(item: Item): string[] {
  const dash = item.slot === 'boots' ? BOOT_DASH[item.rarity] : undefined;
  return [...(dash ? [`Shift — ривок у напрямку руху на ${dash.distance} px (перезарядка ${dash.cooldown} с)`] : []), ...uniqueLines(item)];
}

export function equippedStat(hero: Hero, stat: ItemStat): number {
  let sum = 0;
  for (const item of Object.values(hero.equipment)) {
    if (!item) continue;
    for (const s of item.stats) if (s.stat === stat) sum += s.value;
  }
  return sum;
}

/** A bag item goes to the stash (false: the stash is full). */
export function toStash(state: GameState, bagIndex: number): boolean {
  const item = state.hero.bag[bagIndex];
  if (!item || state.stash.length >= STASH.size) return false;
  state.hero.bag.splice(bagIndex, 1);
  state.stash.push(item);
  return true;
}

/** A stash item comes back to the bag. */
export function fromStash(state: GameState, index: number): boolean {
  const item = state.stash[index];
  if (!item) return false;
  state.stash.splice(index, 1);
  state.hero.bag.push(item);
  return true;
}
