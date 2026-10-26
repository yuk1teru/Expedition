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
  // Rare has as many stats as uncommon, so it gets a clearly bigger power.
  common: { name: 'Звичайна', color: '#c9ced8', power: 1, extraStats: 0, sellPrice: 4 },
  uncommon: { name: 'Незвичайна', color: '#5fd35f', power: 1.3, extraStats: 1, sellPrice: 8 },
  rare: { name: 'Рідкісна', color: '#4aa3ff', power: 1.9, extraStats: 1, sellPrice: 15 },
  epic: { name: 'Епічна', color: '#c77dff', power: 2.3, extraStats: 2, sellPrice: 30 },
  legendary: { name: 'Легендарна', color: '#ff9f1c', power: 3, extraStats: 3, sellPrice: 60 },
};

/**
 * Item level (ilvl): how strong an item is within its rarity. The ilvl range of a location
 * follows its tier (`byTier`, interpolated): the first locations drop up to 40, the bosses
 * at the edge of the world up to 300 — the strongest items in the game.
 * Base stat ranges are tuned for `reference`. Flat stats (attack, armor) and the sell
 * price scale by `floor + (1 − floor) · ilvl / reference` (ilvl 10 ×0.8, 40 ×1.4,
 * 300 ×6.6); percent stats by its square root (×0.89 / ×1.18 / ×2.57), so crit and
 * speed stay sane late in the game.
 */
export const ITEM_LEVEL = {
  max: 300,
  /** [tier, min ilvl, max ilvl]; tiers in between are interpolated, outside — clamped. */
  byTier: [
    [1, 5, 35],
    [1.3, 8, 40],
    [2, 35, 90],
    [3, 85, 160],
    [4, 150, 240],
    [4.5, 200, 300],
  ] as [number, number, number][],
  reference: 20,
  floor: 0.6,
  /** Miniboss items climb from the bottom of the biome range to `top` of it by wave `fullWave` (± jitter). */
  miniboss: { top: 0.75, fullWave: 15, jitter: 2 },
  /** Boss items: from this fraction of the biome range to its top. */
  bossFrom: 0.85,
  /** Merchant items: this band of the range of the hardest location cleared. */
  merchant: [0.3, 0.6] as [number, number],
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
  weights: { uncommon: 65, rare: 30, epic: 5 } as Partial<Record<Rarity, number>>,
};

/** Boot dash flight speed, px/s (the hero is invulnerable for the short flight). */
export const BOOT_DASH_SPEED = 1100;

/**
 * What drops from minibosses and bosses: count and rarity weights (relative, they need
 * not sum to 100). Boss 70 / 20 / 14 / 7 / 4 ≈ 61% / 17% / 12% / 6% / 3.5%.
 * Minibosses never drop anything better than uncommon.
 */
export const LOOT: Record<'miniboss' | 'boss', { count: number; weights: Partial<Record<Rarity, number>> }> = {
  miniboss: { count: 1, weights: { common: 70, uncommon: 20 } },
  boss: { count: 2, weights: { common: 70, uncommon: 20, rare: 14, epic: 7, legendary: 4 } },
};

export const STAT_LABELS: Record<ItemStat, { label: string; percent: boolean }> = {
  attack: { label: 'атаки', percent: false },
  critChance: { label: 'шансу криту', percent: true },
  armor: { label: 'броні', percent: false },
  hpPct: { label: 'HP', percent: true },
  moveSpeedPct: { label: 'швидкості руху', percent: true },
  attackSpeedPct: { label: 'швидкості атаки', percent: true },
};
