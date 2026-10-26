// Equipment: slots, rarities, item kinds (each with its own look), stat rolls,
// loot tables and prices.

export type ItemSlot = 'weapon' | 'hat' | 'armor' | 'boots';

export type ItemStat = 'attack' | 'critChance' | 'armor' | 'hpPct' | 'moveSpeedPct' | 'attackSpeedPct';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const ITEM_SLOTS: { id: ItemSlot; name: string }[] = [
  { id: 'weapon', name: 'Зброя' },
  { id: 'hat', name: 'Капелюх' },
  { id: 'armor', name: 'Броня' },
  { id: 'boots', name: 'Черевики' },
];

export interface RarityDef {
  name: string;
  color: string;
  /** Multiplier on the base stat ranges. */
  power: number;
  /** Extra stats on top of the main one. */
  extraStats: number;
  /** Gold the merchant pays for an identified item. */
  sellPrice: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  // Stats per item: common 1, uncommon and rare 2, epic 3, legendary 4.
  common: { name: 'Звичайна', color: '#c9ced8', power: 1, extraStats: 0, sellPrice: 4 },
  uncommon: { name: 'Незвичайна', color: '#5fd35f', power: 1.35, extraStats: 1, sellPrice: 8 },
  rare: { name: 'Рідкісна', color: '#4aa3ff', power: 1.75, extraStats: 1, sellPrice: 15 },
  epic: { name: 'Епічна', color: '#c77dff', power: 2.3, extraStats: 2, sellPrice: 30 },
  legendary: { name: 'Легендарна', color: '#ff9f1c', power: 3, extraStats: 3, sellPrice: 60 },
};

/** Unidentified items sell for this fraction of the price. */
export const UNIDENTIFIED_SELL_MULT = 0.5;

/** Item kinds: each has its own icon shape (see src/render/icons.ts). */
export const ITEM_KINDS: Record<ItemSlot, { id: string; name: string }[]> = {
  weapon: [
    { id: 'sword', name: 'Меч' },
    { id: 'axe', name: 'Сокира' },
    { id: 'mace', name: 'Булава' },
    { id: 'dagger', name: 'Кинджал' },
    { id: 'spear', name: 'Спис' },
  ],
  hat: [
    { id: 'brim', name: 'Капелюх' },
    { id: 'hood', name: 'Каптур' },
    { id: 'helm', name: 'Шолом' },
    { id: 'crown', name: 'Корона' },
    { id: 'band', name: 'Пов’язка' },
  ],
  armor: [
    { id: 'jacket', name: 'Куртка' },
    { id: 'mail', name: 'Кольчуга' },
    { id: 'plate', name: 'Лати' },
    { id: 'robe', name: 'Мантія' },
    { id: 'vest', name: 'Панцир' },
  ],
  boots: [
    { id: 'boots', name: 'Чоботи' },
    { id: 'shoes', name: 'Черевики' },
    { id: 'sandals', name: 'Сандалі' },
    { id: 'greaves', name: 'Поножі' },
    { id: 'wraps', name: 'Обмотки' },
  ],
};

/** Name suffixes ("Меч вовка"). */
export const ITEM_SUFFIXES = ['вовка', 'світанку', 'лісовика', 'бурі', 'вартового', 'мисливця', 'тіні', 'кореня', 'ватажка', 'мандрівника'];

/** Accent and gem colours for the unique look of each item. */
export const ITEM_ACCENTS = ['#e8d5a3', '#b0b8c8', '#8fd18f', '#e07a5f', '#7ec8e3', '#d4a5ff', '#f2c14e'];

export interface StatRoll {
  stat: ItemStat;
  /** Base [min, max]; multiplied by the rarity power. */
  range: [number, number];
}

export interface ItemBase {
  main: StatRoll;
  extras: StatRoll[];
}

export const ITEM_BASES: Record<ItemSlot, ItemBase> = {
  // Every slot has 3 extras, so a legendary item rolls all of them.
  weapon: {
    main: { stat: 'attack', range: [3, 4] },
    extras: [
      { stat: 'critChance', range: [0.02, 0.03] },
      { stat: 'attackSpeedPct', range: [0.03, 0.05] },
      { stat: 'hpPct', range: [0.02, 0.03] },
    ],
  },
  hat: {
    main: { stat: 'critChance', range: [0.02, 0.03] },
    extras: [
      { stat: 'attackSpeedPct', range: [0.03, 0.04] },
      { stat: 'hpPct', range: [0.03, 0.04] },
      { stat: 'armor', range: [2, 3] },
    ],
  },
  armor: {
    // Kept low on purpose: armor shouldn't trivialise incoming damage.
    main: { stat: 'armor', range: [4, 6] },
    extras: [
      { stat: 'hpPct', range: [0.03, 0.05] },
      { stat: 'critChance', range: [0.01, 0.02] },
      { stat: 'moveSpeedPct', range: [0.02, 0.03] },
    ],
  },
  boots: {
    main: { stat: 'moveSpeedPct', range: [0.1, 0.13] },
    extras: [
      { stat: 'hpPct', range: [0.03, 0.04] },
      { stat: 'attackSpeedPct', range: [0.02, 0.03] },
      { stat: 'armor', range: [2, 3] },
    ],
  },
};

/**
 * Boots of uncommon rarity and better give a short dash on Shift in the direction of
 * movement (standing still: where the hero faces):
 * the better the boots, the longer the dash and the shorter its cooldown.
 */
export const BOOT_DASH: Partial<Record<Rarity, { distance: number; cooldown: number }>> = {
  uncommon: { distance: 70, cooldown: 15 },
  rare: { distance: 95, cooldown: 14 },
  epic: { distance: 120, cooldown: 13 },
  legendary: { distance: 150, cooldown: 12 },
};

/** The merchant sells a random identified item for a chosen slot: expensive, uncommon to epic. */
export const MERCHANT_ITEMS = {
  price: 120,
  weights: { uncommon: 60, rare: 30, epic: 10 } as Partial<Record<Rarity, number>>,
};

/** Boot dash flight speed, px/s (the hero is invulnerable for the short flight). */
export const BOOT_DASH_SPEED = 1100;

/** What drops from minibosses and bosses: count and rarity weights. */
export const LOOT: Record<'miniboss' | 'boss', { count: number; weights: Partial<Record<Rarity, number>> }> = {
  miniboss: { count: 1, weights: { common: 50, uncommon: 32, rare: 15, epic: 3 } },
  boss: { count: 2, weights: { rare: 30, epic: 45, legendary: 25 } },
};

export const STAT_LABELS: Record<ItemStat, { label: string; percent: boolean }> = {
  attack: { label: 'атаки', percent: false },
  critChance: { label: 'шансу криту', percent: true },
  armor: { label: 'броні', percent: false },
  hpPct: { label: 'HP', percent: true },
  moveSpeedPct: { label: 'швидкості руху', percent: true },
  attackSpeedPct: { label: 'швидкості атаки', percent: true },
};
