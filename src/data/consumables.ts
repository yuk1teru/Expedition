// Consumables (sold by the merchant, carried by the hero) and arena pickups.

export type ConsumableId = 'magnifier' | 'herb';

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  description: string;
  /** Merchant price, gold. */
  price: number;
  /** Max carried. */
  max: number;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  magnifier: {
    id: 'magnifier',
    name: 'Лупа',
    description: 'Розпізнає одну річ, після чого її можна вдягнути.',
    price: 25,
    max: 9,
  },
  herb: {
    id: 'herb',
    name: 'Цілюща трава',
    description: 'G — відновити 25% HP. Можна носити в наступні бої.',
    price: 40,
    max: 3,
  },
};

export const HERB = {
  /** Fraction of max HP restored. */
  healPct: 0.25,
  /** Seconds between uses. */
  cooldown: 1,
} as const;

export type PickupKind = 'herb' | 'rageBerry';

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
  herb: { id: 'herb', name: 'Цілюща трава', weight: 70, color: '#6fd16f', effect: { kind: 'stash', consumable: 'herb' } },
  rageBerry: {
    id: 'rageBerry',
    name: 'Ягода люті',
    weight: 30,
    color: '#ff5a5a',
    effect: { kind: 'buff', attackSpeed: 0.3, duration: 8 },
  },
};

/** Plants grow on the arena now and then. */
export const PICKUP_SPAWN = {
  /** A plant may appear at the start of every N-th wave (bonus waves included). */
  everyWaves: 2,
  /** Never more than this many on the arena. */
  max: 2,
  /** Seconds to grow before it can be picked. */
  growTime: 2,
  radius: 14,
  /** Distance from the arena edge, px. */
  inset: 60,
} as const;
