// The smith (ROADMAP 14.4): rerolls a stat line of an item, raises the item's level to the top
// of what the hero's hardest cleared location drops, and takes a rune stone out. Prices grow
// with the rarity and the item level.

import type { Rarity } from './items';

export const SMITH = {
  /** NPCs who do the work. */
  at: ['capitalMatvii', 'iceSmith'],
  /** Reroll a stat line: gold × rarity × item level factor. */
  reroll: 12,
  /** Raise the level: gold per item level gained × rarity. */
  upgradePerLevel: 1.5,
  /** Take a stone out of an item. */
  removeStone: 40,
  rarityMult: { common: 1, uncommon: 1.5, rare: 2.2, epic: 3, legendary: 4 } as Record<Rarity, number>,
};
