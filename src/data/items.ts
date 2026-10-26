// Equipment: slots, rarities, item bases and loot tables.

export type ItemSlot = 'weapon' | 'hat' | 'armor' | 'boots';

export type ItemStat = 'attack' | 'critChance' | 'armor' | 'hpPct' | 'moveSpeedPct' | 'attackSpeedPct';

export type Rarity = 'common' | 'epic';

export const ITEM_SLOTS: { id: ItemSlot; name: string }[] = [
  { id: 'weapon', name: 'Зброя' },
  { id: 'hat', name: 'Капелюх' },
  { id: 'armor', name: 'Броня' },
  { id: 'boots', name: 'Черевики' },
];

export const RARITIES: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Звичайна', color: '#c9ced8' },
  epic: { name: 'Епічна', color: '#c77dff' },
};

export interface StatRoll {
  stat: ItemStat;
  /** [min, max] per rarity. */
  common: [number, number];
  epic: [number, number];
}

export interface ItemBase {
  slot: ItemSlot;
  names: Record<Rarity, string[]>;
  /** Main stat, always present. */
  main: StatRoll;
  /** Extra stats; epic items get `epicExtraStats` of them. */
  extras: StatRoll[];
}

export const ITEM_BASES: Record<ItemSlot, ItemBase> = {
  weapon: {
    slot: 'weapon',
    names: {
      common: ['Іржавий меч', 'Дубовий кийок', 'Мисливський ніж'],
      epic: ['Клинок Ената', 'Сокира ватажка', 'Меч світанку'],
    },
    main: { stat: 'attack', common: [3, 5], epic: [10, 14] },
    extras: [{ stat: 'critChance', common: [0.02, 0.03], epic: [0.05, 0.08] }],
  },
  hat: {
    slot: 'hat',
    names: {
      common: ['Повстяний капелюх', 'Шкіряний каптур', 'Солом’яний бриль'],
      epic: ['Корона з гілок', 'Шолом вартового', 'Капюшон тіні'],
    },
    main: { stat: 'critChance', common: [0.03, 0.05], epic: [0.08, 0.12] },
    extras: [{ stat: 'attackSpeedPct', common: [0.03, 0.05], epic: [0.08, 0.12] }],
  },
  armor: {
    slot: 'armor',
    names: {
      common: ['Стьобана куртка', 'Шкіряний обладунок', 'Кольчуга новобранця'],
      epic: ['Кора-панцир', 'Лати лісового лицаря', 'Обладунок ведмедя'],
    },
    main: { stat: 'armor', common: [6, 10], epic: [20, 28] },
    extras: [{ stat: 'hpPct', common: [0.04, 0.06], epic: [0.1, 0.15] }],
  },
  boots: {
    slot: 'boots',
    names: {
      common: ['Старі чоботи', 'Мокасини', 'Похідні черевики'],
      epic: ['Чоботи вітру', 'Кроки вовка', 'Черевики мандрівника'],
    },
    main: { stat: 'moveSpeedPct', common: [0.08, 0.12], epic: [0.18, 0.25] },
    extras: [{ stat: 'hpPct', common: [0.03, 0.05], epic: [0.08, 0.12] }],
  },
};

/** How many extra stats an item of each rarity rolls. */
export const RARITY_EXTRA_STATS: Record<Rarity, number> = { common: 0, epic: 1 };

/** What drops from minibosses and bosses. */
export const LOOT = {
  miniboss: { rarity: 'common' as Rarity, count: 1 },
  boss: { rarity: 'epic' as Rarity, count: 2 },
} as const;

export const STAT_LABELS: Record<ItemStat, { label: string; percent: boolean }> = {
  attack: { label: 'атаки', percent: false },
  critChance: { label: 'шансу криту', percent: true },
  armor: { label: 'броні', percent: false },
  hpPct: { label: 'HP', percent: true },
  moveSpeedPct: { label: 'швидкості руху', percent: true },
  attackSpeedPct: { label: 'швидкості атаки', percent: true },
};
