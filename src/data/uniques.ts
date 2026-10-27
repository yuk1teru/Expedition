// Items with effects (ROADMAP 14.5): legendaries that change a skill (two per class for now),
// skill affixes on rare and epic items ("+1 до рангу", "−X% перезарядки") and the Forest set
// with bonuses for 2 and 4 pieces. Their effects work like the gifts' (gifts.ts).

import type { GiftEffect } from './gifts';
import type { ItemSlot, Rarity } from './items';

export interface LegendaryDef {
  id: string;
  name: string;
  slot: ItemSlot;
  /** The class whose skill it changes (others can wear it for the stats). */
  classId: string;
  text: string;
  effects: GiftEffect[];
}

export const LEGENDARIES: Record<string, LegendaryDef> = {
  stormAxe: {
    id: 'stormAxe',
    name: 'Сокира Бурі',
    slot: 'weapon',
    classId: 'warrior',
    text: 'Вихор ширший (радіус 130) і притягує ворогів з першого рангу.',
    effects: [
      { kind: 'skill', skill: 'whirlwind', param: 'radius', value: 130 },
      { kind: 'skill', skill: 'whirlwind', param: 'pull', value: 240 },
    ],
  },
  quakeHelm: {
    id: 'quakeHelm',
    name: 'Шолом Землетрусу',
    slot: 'hat',
    classId: 'warrior',
    text: 'Удар об землю б’є півколом (180°) і оглушує на 1 с.',
    effects: [
      { kind: 'skill', skill: 'groundSlam', param: 'angle', value: 180 },
      { kind: 'skill', skill: 'groundSlam', param: 'stun', value: 1 },
    ],
  },
  emberStaff: {
    id: 'emberStaff',
    name: 'Жезл Жарини',
    slot: 'weapon',
    classId: 'mage',
    text: 'Вогняна куля вибухає ширше (радіус 140) і з першого рангу лишає вогонь.',
    effects: [
      { kind: 'skill', skill: 'fireball', param: 'radius', value: 140 },
      { kind: 'skill', skill: 'fireball', param: 'ground', value: 1 },
    ],
  },
  winterMantle: {
    id: 'winterMantle',
    name: 'Мантія Зими',
    slot: 'armor',
    classId: 'mage',
    text: 'Крижане кільце ширше (радіус 230) і заморожує на 2.5 с.',
    effects: [
      { kind: 'skill', skill: 'frostRing', param: 'radius', value: 230 },
      { kind: 'skill', skill: 'frostRing', param: 'freeze', value: 2.5 },
    ],
  },
  galeBow: {
    id: 'galeBow',
    name: 'Лук Вітрів',
    slot: 'weapon',
    classId: 'archer',
    text: 'Мультипостріл — 13 стріл віялом 100°.',
    effects: [
      { kind: 'skill', skill: 'multishot', param: 'count', value: 13 },
      { kind: 'skill', skill: 'multishot', param: 'angle', value: 100 },
    ],
  },
  rainHood: {
    id: 'rainHood',
    name: 'Каптур Зливи',
    slot: 'hat',
    classId: 'archer',
    text: 'Дощ стріл ширший (радіус 170) і сповільнює на 40%.',
    effects: [
      { kind: 'skill', skill: 'arrowRain', param: 'radius', value: 170 },
      { kind: 'skill', skill: 'arrowRain', param: 'slow', value: 0.4 },
    ],
  },
};

export const AFFIXES = {
  /**
   * Chance an item rolls a skill affix (a skill of the hero's class). It stays hidden until the
   * item is identified — the gamble of the magnifier (ROADMAP 14.6).
   */
  chance: { common: 0.05, uncommon: 0.15, rare: 0.35, epic: 0.6 } as Partial<Record<Rarity, number>>,
  /** "+1 до рангу" or "−X% перезарядки" — this share of the affixes is a rank. */
  rankShare: 0.4,
  /** Cooldown cut range. */
  cooldown: [0.1, 0.2] as [number, number],
  /** A legendary drop is one of the hero's class with this chance. */
  legendaryOwnClass: 0.7,
};

export interface ItemSetDef {
  id: string;
  name: string;
  /** Item names of the set by slot. */
  pieces: Record<ItemSlot, string>;
  /** Region whose minibosses and boss drop the pieces. */
  region: string;
  /** Chance a miniboss / boss item of the region is a piece. */
  chance: number;
  bonus2: { text: string; effects: GiftEffect[] };
  bonus4: { text: string; effects: GiftEffect[] };
}

export const ITEM_SETS: Record<string, ItemSetDef> = {
  forest: {
    id: 'forest',
    name: 'Комплект Лісу',
    pieces: { hat: 'Каптур Лісника', armor: 'Кора-обладунок', weapon: 'Сучкувата палиця', boots: 'Мохові чоботи' },
    region: 'forest',
    chance: 0.3,
    bonus2: { text: '+10% макс. HP', effects: [{ kind: 'stat', stat: 'hpPct', value: 0.1 }] },
    bonus4: {
      text: '+12% швидкості атаки, +20% шкоди Землею',
      effects: [
        { kind: 'stat', stat: 'attackSpeedPct', value: 0.12 },
        { kind: 'element', element: 'earth', value: 0.2 },
      ],
    },
  },
};
