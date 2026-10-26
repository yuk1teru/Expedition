// Class promotions (level 13): two branches per class. Each branch has a passive
// mechanic, a signature skill (own slot, key R) and its own cards (signature upgrades
// and two passives) that join the card pool with double weight.

export type PromotionEffect =
  /** +1% damage per 1% of missing HP, up to `maxBonus`. */
  | { kind: 'berserk'; maxBonus: number }
  /** Every `interval` s a barrier of `shield` × max HP. */
  | { kind: 'aegis'; interval: number; shield: number }
  /** Fire skills (and the basic bolt) set enemies on fire: `dps` × attack per second for `time` s. */
  | { kind: 'ignite'; dps: number; time: number; skills: string[] }
  /** Frozen enemies take +`frozenBonus` damage; one dying frozen bursts into ice shards. */
  | { kind: 'shatter'; frozenBonus: number; shards: number; shardDamage: number; shardSpeed: number; shardRange: number }
  /** +`crit` crit chance, basic arrows pierce `pierce` more enemies. */
  | { kind: 'marksman'; crit: number; pierce: number }
  /** A wolf companion: `hpFrac` × hero max HP, bites for `damage` × hero attack, back `respawn` s after dying. */
  | { kind: 'companion'; hpFrac: number; damage: number; respawn: number };

export interface PromotionDef {
  id: string;
  classId: string;
  name: string;
  /** Short role line for the choice card. */
  description: string;
  /** Text of the passive mechanic. */
  mechanic: string;
  effect: PromotionEffect;
  signature: string;
  passives: string[];
  /** Outline colour of the hero after the promotion. */
  color: string;
}

export const PROMOTIONS: Record<string, PromotionDef> = {
  berserker: {
    id: 'berserker',
    classId: 'warrior',
    name: 'Берсерк',
    description: 'Що менше HP — то страшніший.',
    mechanic: '+1% шкоди за кожен 1% втраченого HP (до +60%).',
    effect: { kind: 'berserk', maxBonus: 0.6 },
    signature: 'rage',
    passives: ['bloodlust', 'unstoppable'],
    color: '#e04a2f',
  },
  paladin: {
    id: 'paladin',
    classId: 'warrior',
    name: 'Паладин',
    description: 'Світло, щити й лікування.',
    mechanic: 'Кожні 10 с — бар’єр на 15% макс. HP.',
    effect: { kind: 'aegis', interval: 10, shield: 0.15 },
    signature: 'holyShield',
    passives: ['blessing', 'sacredArmor'],
    color: '#f2d16b',
  },
  pyromancer: {
    id: 'pyromancer',
    classId: 'mage',
    name: 'Піромант',
    description: 'Усе горить.',
    mechanic: 'Вогняні скіли й снаряд підпалюють: 30% атаки героя за секунду, 3 с.',
    effect: { kind: 'ignite', dps: 0.3, time: 3, skills: ['fireball', 'flameWall', 'meteor'] },
    signature: 'meteor',
    passives: ['embers', 'ashes'],
    color: '#ff7a2f',
  },
  cryomancer: {
    id: 'cryomancer',
    classId: 'mage',
    name: 'Кріомант',
    description: 'Холод, що сковує й розбиває.',
    mechanic: 'Заморожені вороги отримують +50% шкоди й розлітаються крижаними уламками, коли гинуть.',
    effect: { kind: 'shatter', frozenBonus: 0.5, shards: 6, shardDamage: 0.5, shardSpeed: 420, shardRange: 170 },
    signature: 'blizzard',
    passives: ['coldHeart', 'rime'],
    color: '#7fd0ff',
  },
  sniper: {
    id: 'sniper',
    classId: 'archer',
    name: 'Снайпер',
    description: 'Один постріл — одна ціль. Або п’ять.',
    mechanic: '+15% шансу криту; базові стріли пробивають ще 2 ворогів.',
    effect: { kind: 'marksman', crit: 0.15, pierce: 2 },
    signature: 'aimedShot',
    passives: ['hawkEye', 'steadyHand'],
    color: '#c8e06a',
  },
  beastmaster: {
    id: 'beastmaster',
    classId: 'archer',
    name: 'Звіролов',
    description: 'Полює не сам.',
    mechanic: 'Вовк-компаньйон: 40% атаки героя, повертається через 10 с після загибелі.',
    effect: { kind: 'companion', hpFrac: 0.4, damage: 0.4, respawn: 10 },
    signature: 'callOfPack',
    passives: ['packLeader', 'instinct'],
    color: '#b08a5a',
  },
};

export function getPromotion(id: string): PromotionDef {
  const p = PROMOTIONS[id];
  if (!p) throw new Error(`Unknown promotion: ${id}`);
  return p;
}

/** The two branches of a class. */
export function classPromotions(classId: string): PromotionDef[] {
  return Object.values(PROMOTIONS).filter((p) => p.classId === classId);
}

/** Companion wolf body and AI numbers (Beastmaster, Call of the Pack). */
export const ALLY_WOLF = {
  radius: 11,
  speed: 175,
  attackInterval: 1,
  /** Extra reach beyond touching, px. */
  reach: 6,
  mass: 1.5,
  /** Summoned pack wolves have this fraction of the hero's max HP. */
  packHpFrac: 0.25,
} as const;
