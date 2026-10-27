// Souls and rune stones (ROADMAP 14.3). Since the seal cracked, the souls of beasts do not
// leave: now and then one lingers over a killed monster. One soul per kind of beast (the
// wolves of every land share one). A rune stone in the bag catches it; the stone goes into
// an item, one per item. In a weapon it gives the attacks the soul's element; in anything
// else — the soul's property. Only the smith takes a stone out.

import type { Element } from './elements';
import type { GiftStat } from './gifts';

export type SoulResist = 'poison' | 'slow' | 'stun';

export type StoneEffect = { kind: 'stat'; stat: GiftStat; value: number } | { kind: 'resist'; against: SoulResist; value: number };

export interface SoulDef {
  id: string;
  name: string;
  /** Monsters whose soul it is. */
  from: string[];
  /** In a weapon: the element of the attacks. */
  element: Element;
  /** In a hat, armour or boots. */
  effect: StoneEffect;
  color: string;
}

export const SOUL_RULES = {
  /** Chance a killed monster leaves its soul (summoned and hatched ones never do). */
  chance: 0.03,
  /** Seconds the soul lingers before it fades. */
  life: 12,
  /** The hero catches it this close, px. */
  radius: 26,
  /** Chance a miniboss drops an empty rune stone; a treasure chest has one this often. */
  minibossStone: 0.2,
  treasureStone: 0.1,
};

export const RESIST_NAMES: Record<SoulResist, string> = { poison: 'отруті', slow: 'сповільненню й корінню', stun: 'оглушенню' };

export const SOULS: Record<string, SoulDef> = {
  wolfSoul: { id: 'wolfSoul', name: 'Вовча душа', from: ['wolf', 'jackal', 'iceWolf', 'goat'], element: 'wind', effect: { kind: 'stat', stat: 'moveSpeedPct', value: 0.05 }, color: '#b8c4d8' },
  sporeSoul: { id: 'sporeSoul', name: 'Грибна душа', from: ['mushroom', 'sporeCap'], element: 'poison', effect: { kind: 'resist', against: 'poison', value: 0.4 }, color: '#a7e08a' },
  woodSoul: { id: 'woodSoul', name: 'Деревна душа', from: ['stump', 'rotStump', 'thornBush', 'cactus'], element: 'earth', effect: { kind: 'stat', stat: 'armor', value: 2 }, color: '#c49a5a' },
  birdSoul: { id: 'birdSoul', name: 'Пташина душа', from: ['gull', 'harpy'], element: 'wind', effect: { kind: 'stat', stat: 'attackSpeedPct', value: 0.05 }, color: '#d8f0ff' },
  shellSoul: { id: 'shellSoul', name: 'Панцирна душа', from: ['crab', 'scarab', 'rockling'], element: 'earth', effect: { kind: 'stat', stat: 'hpPct', value: 0.06 }, color: '#d8b070' },
  bogSoul: { id: 'bogSoul', name: 'Болотяна душа', from: ['mossToad', 'frog', 'slime', 'bogman'], element: 'water', effect: { kind: 'resist', against: 'slow', value: 0.4 }, color: '#5ab0c8' },
  sandSoul: { id: 'sandSoul', name: 'Пустельна душа', from: ['scorpion', 'dustBoar'], element: 'fire', effect: { kind: 'stat', stat: 'critChance', value: 0.04 }, color: '#ff9a4a' },
  frostSoul: { id: 'frostSoul', name: 'Крижана душа', from: ['snowman', 'iceGolem'], element: 'water', effect: { kind: 'resist', against: 'stun', value: 0.4 }, color: '#a8e0ff' },
};
