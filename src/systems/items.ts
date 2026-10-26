// Item rolls, loot drops, equipping.

import type { Rng } from '../core/rng';
import { ITEM_BASES, ITEM_SLOTS, type ItemSlot, type ItemStat, RARITY_EXTRA_STATS, type Rarity, STAT_LABELS } from '../data/items';
import type { Hero } from './entities';
import { recomputeHeroStats } from './hero';

export interface ItemStatValue {
  stat: ItemStat;
  value: number;
}

export interface Item {
  uid: number;
  slot: ItemSlot;
  rarity: Rarity;
  name: string;
  stats: ItemStatValue[];
}

function rollValue(rng: Rng, range: [number, number], stat: ItemStat): number {
  const v = rng.float(range[0], range[1]);
  return STAT_LABELS[stat].percent ? Math.round(v * 100) / 100 : Math.round(v);
}

/** Rolls an item of the given rarity (random slot unless given). */
export function rollItem(rng: Rng, rarity: Rarity, uid: number, slot?: ItemSlot): Item {
  const s = slot ?? rng.pick(ITEM_SLOTS).id;
  const base = ITEM_BASES[s];
  const stats: ItemStatValue[] = [{ stat: base.main.stat, value: rollValue(rng, base.main[rarity], base.main.stat) }];
  for (const extra of rng.shuffle(base.extras).slice(0, RARITY_EXTRA_STATS[rarity])) {
    stats.push({ stat: extra.stat, value: rollValue(rng, extra[rarity], extra.stat) });
  }
  return { uid, slot: s, rarity, name: rng.pick(base.names[rarity]), stats };
}

/** New loot goes into an empty slot, otherwise into the bag. Returns true if equipped. */
export function equipOrStash(hero: Hero, item: Item): boolean {
  if (!hero.equipment[item.slot]) {
    hero.equipment[item.slot] = item;
    recomputeHeroStats(hero);
    return true;
  }
  hero.bag.push(item);
  return false;
}

/** Equips a bag item; the previously worn item goes back into the bag. */
export function equipFromBag(hero: Hero, bagIndex: number): void {
  const item = hero.bag[bagIndex];
  if (!item) return;
  hero.bag.splice(bagIndex, 1);
  const worn = hero.equipment[item.slot];
  if (worn) hero.bag.push(worn);
  hero.equipment[item.slot] = item;
  recomputeHeroStats(hero);
}

export function formatStat(s: ItemStatValue): string {
  const l = STAT_LABELS[s.stat];
  return l.percent ? `+${Math.round(s.value * 100)}% ${l.label}` : `+${s.value} ${l.label}`;
}

/** Sum of a stat over all equipped items. */
export function equippedStat(hero: Hero, stat: ItemStat): number {
  let sum = 0;
  for (const item of Object.values(hero.equipment)) {
    if (!item) continue;
    for (const s of item.stats) if (s.stat === stat) sum += s.value;
  }
  return sum;
}

/** Takes a worn item off into the bag. */
export function unequip(hero: Hero, slot: ItemSlot): void {
  const item = hero.equipment[slot];
  if (!item) return;
  delete hero.equipment[slot];
  hero.bag.push(item);
  recomputeHeroStats(hero);
}
