// Consumables (carried by the hero): the magnifier and healing items — herbs that grow
// on the arena (green < red < white) and potions sold by the merchant (heal a bigger
// share of HP). Healing items go on the quick slots Z / X / C. Also arena pickups.

export type HealId = 'herbGreen' | 'herbRed' | 'herbWhite' | 'potionSmall' | 'potionMedium' | 'potionLarge';

export type ConsumableId = 'magnifier' | HealId;

export interface HealDef {
  /** Share of max HP restored. */
  pct: number;
  /** Plus this many HP. */
  flat: number;
  /** Over this many seconds (works while being hit). */
  duration: number;
}

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  /** Merchant price, gold (0: not sold, only found). */
  price: number;
  /** Max carried. */
  max: number;
  /** Icon colour (herb leaves, potion liquid). */
  color: string;
  heal?: HealDef;
  /** Description for items without `heal` (healing items describe themselves from numbers). */
  description?: string;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  magnifier: {
    id: 'magnifier',
    name: 'Лупа',
    description: 'Розпізнає одну річ, після чого її можна вдягнути.',
    price: 25,
    max: 9,
    color: '#d9c9a3',
  },
  herbGreen: { id: 'herbGreen', name: 'Зелена трава', price: 0, max: 3, color: '#6fd16f', heal: { pct: 0.04, flat: 8, duration: 4 } },
  herbRed: { id: 'herbRed', name: 'Червона трава', price: 0, max: 3, color: '#e0484f', heal: { pct: 0.07, flat: 15, duration: 4 } },
  herbWhite: { id: 'herbWhite', name: 'Біла трава', price: 0, max: 3, color: '#f2f4f8', heal: { pct: 0.11, flat: 25, duration: 4 } },
  potionSmall: { id: 'potionSmall', name: 'Мале зілля', price: 20, max: 3, color: '#e05a5a', heal: { pct: 0.15, flat: 10, duration: 3 } },
  potionMedium: { id: 'potionMedium', name: 'Зілля', price: 45, max: 3, color: '#c0306a', heal: { pct: 0.25, flat: 15, duration: 3 } },
  potionLarge: { id: 'potionLarge', name: 'Велике зілля', price: 90, max: 3, color: '#8a2be2', heal: { pct: 0.4, flat: 20, duration: 3 } },
};

/** Healing items, weakest first. */
export const HEAL_ORDER: HealId[] = ['herbGreen', 'herbRed', 'herbWhite', 'potionSmall', 'potionMedium', 'potionLarge'];

/** Quick slots for healing items (keys Z, X, C). */
export const QUICK_SLOTS = {
  keys: ['KeyZ', 'KeyX', 'KeyC'] as const,
  labels: ['Z', 'X', 'C'] as const,
  /** Seconds between two healing items (shared). */
  cooldown: 1,
} as const;

export function healAmount(def: HealDef, maxHp: number): number {
  return def.pct * maxHp + def.flat;
}

/** "Відновлює 7% макс. HP + 15 HP за 4 с." or the plain description. */
export function describeConsumable(id: ConsumableId): string {
  const def = CONSUMABLES[id];
  const h = def.heal;
  if (!h) return def.description ?? '';
  return `Відновлює ${Math.round(h.pct * 100)}% макс. HP + ${h.flat} HP за ${h.duration} с.`;
}

export type PickupKind = 'herbGreen' | 'herbRed' | 'herbWhite' | 'rageBerry';

export interface PickupDef {
  id: PickupKind;
  name: string;
  /** Relative spawn chance. */
  weight: number;
  color: string;
  /** `stash`: goes to the hero's consumables; `buff`: applied on pickup. */
  effect: { kind: 'stash'; consumable: ConsumableId } | { kind: 'buff'; attackSpeed: number; duration: number };
}

export const PICKUPS: Record<PickupKind, PickupDef> = {
  herbGreen: { id: 'herbGreen', name: 'Зелена трава', weight: 45, color: '#6fd16f', effect: { kind: 'stash', consumable: 'herbGreen' } },
  herbRed: { id: 'herbRed', name: 'Червона трава', weight: 20, color: '#e0484f', effect: { kind: 'stash', consumable: 'herbRed' } },
  herbWhite: { id: 'herbWhite', name: 'Біла трава', weight: 8, color: '#f2f4f8', effect: { kind: 'stash', consumable: 'herbWhite' } },
  rageBerry: {
    id: 'rageBerry',
    name: 'Ягода люті',
    weight: 27,
    color: '#ff8a3c',
    effect: { kind: 'buff', attackSpeed: 0.3, duration: 8 },
  },
};

/** Plants grow on the arena now and then. */
export const PICKUP_SPAWN = {
  /** A plant may appear at the start of every N-th wave (bonus waves included). */
  everyWaves: 2,
  /** Never more than this many on the arena (they grow even when the hero's pockets are full). */
  max: 2,
  /** Seconds to grow before it can be picked. */
  growTime: 2,
  radius: 14,
  /** Distance from the arena edge, px; also keeps it away from the hero (×2). */
  inset: 60,
  placementTries: 12,
} as const;
