// Hero classes: Warrior, Mage, Archer (8 skills and 3 passives each).

export type ClassIcon = 'shield' | 'orb' | 'bow';

/**
 * Basic (auto) attack of a class. `melee`: hits the nearest enemy in an arc
 * towards the aim; others in the arc take `splash` × damage.
 * `ranged`: a projectile towards the aim (when an enemy is in the aim cone); it passes
 * through `pierce` enemies (damage × `pierceMult` after each), and may burst on hit:
 * everyone else within `splashRadius` takes `splash` × damage.
 */
export type BasicAttackDef =
  | { kind: 'melee'; arcDeg: number; splash: number; description: string }
  | {
      kind: 'ranged';
      projectile: 'bolt' | 'arrow';
      speed: number;
      radius: number;
      pierce: number;
      pierceMult: number;
      splash: number;
      splashRadius: number;
      description: string;
    };

/** Hero before the class choice. */
export const NOVICE_ATTACK: BasicAttackDef = {
  kind: 'melee',
  arcDeg: 50,
  splash: 0,
  description: 'Одиночний удар вузькою дугою: б’є одного найближчого ворога прямо перед собою.',
};

/**
 * What makes a class itself besides skills: the Warrior regenerates even in a fight,
 * the Archer is quick and dodges melee hits, the Mage hides behind a mana shield.
 */
export interface ClassTraits {
  /** HP per second as a fraction of max HP, always (also while being hit). */
  combatRegenPct?: number;
  /** Chance to dodge a melee hit completely. */
  dodgeMelee?: number;
  /** Move speed multiplier. */
  moveSpeedMult?: number;
  /**
   * Mana: `base` + `perLevel` × (level − 1). Mana takes hits before HP: one mana point
   * absorbs `absorb` HP. Every kill gives `perKill`; with chance `orbChance` a killed
   * enemy leaves an orb worth `orbMana` (step on it). Full again in town.
   */
  mana?: { base: number; perLevel: number; absorb: number; perKill: number; orbChance: number; orbMana: number; orbLife: number; orbRadius: number };
}

export interface ClassDef {
  id: string;
  name: string;
  role: string;
  description: string;
  locked: boolean;
  hpMult: number;
  attackSpeedMult: number;
  skillDamageMult: number;
  ranged: boolean;
  /** Melee reach or shooting range, px. */
  range: number;
  /** Skills the bot (simulation) picks at the class choice. */
  defaultPicks: string[];
  /** Full class skill pool: the player picks some at the class choice, the rest come from cards. */
  skills: string[];
  passives: string[];
  basicAttack: BasicAttackDef;
  /** Names shown in the class choice for classes without skill data yet. */
  preview?: { skills: string[]; passives: string[]; passiveMaxStacks: number };
  /** Outline colour of the hero and class accents. */
  color: string;
  icon: ClassIcon;
  traits: ClassTraits;
  /** One line about the traits for the class choice. */
  traitText: string;
}

export const CLASSES: Record<string, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Воїн',
    role: 'Ближній бій, живучий',
    description: 'Врізається в натовп і тримає удар.',
    locked: false,
    hpMult: 1,
    attackSpeedMult: 1,
    skillDamageMult: 1,
    ranged: false,
    range: 40,
    defaultPicks: ['whirlwind', 'charge'],
    skills: ['whirlwind', 'charge', 'battleCry', 'groundSlam', 'axeThrow', 'ironSkin', 'earthquake', 'hook'],
    passives: ['armor', 'vampirism', 'fervor'],
    basicAttack: {
      kind: 'melee',
      arcDeg: 140,
      splash: 0.4,
      description: 'Широкий удар: ціль — повна шкода, решта в дузі — 40%.',
    },
    color: '#c0392b',
    icon: 'shield',
    traits: { combatRegenPct: 0.002 },
    traitText: 'Реген 0.2% HP/с навіть у бою',
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    role: 'Дальній бій, щит мани',
    description: 'Вогонь, лід і блискавки здалеку.',
    locked: false,
    hpMult: 0.8,
    attackSpeedMult: 1,
    skillDamageMult: 1.25,
    ranged: true,
    range: 260,
    defaultPicks: ['fireball', 'frostRing'],
    skills: ['fireball', 'frostRing', 'chainLightning', 'teleport', 'magicMissiles', 'iceBarrier', 'flameWall', 'vortex'],
    passives: ['spellPower', 'focus', 'arcaneBarrier'],
    basicAttack: {
      kind: 'ranged',
      projectile: 'bolt',
      speed: 480,
      radius: 6,
      pierce: 0,
      pierceMult: 1,
      splash: 0.35,
      splashRadius: 40,
      description: 'Вогняний снаряд: ціль — повна шкода, вороги поруч — 35%.',
    },
    color: '#3b7dd8',
    icon: 'orb',
    traits: { mana: { base: 100, perLevel: 6, absorb: 2, perKill: 3, orbChance: 0.35, orbMana: 10, orbLife: 10, orbRadius: 16 } },
    traitText: 'Щит мани поглинає удари',
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    role: 'Дальній бій, прудкий',
    description: 'Злива стріл і пастки.',
    locked: false,
    hpMult: 1.15,
    attackSpeedMult: 1.4,
    skillDamageMult: 1,
    ranged: true,
    range: 300,
    defaultPicks: ['multishot', 'arrowRain'],
    skills: ['multishot', 'hunterTrap', 'arrowRain', 'vault', 'piercingShot', 'hunterMark', 'net', 'barrage'],
    passives: ['precision', 'agility', 'piercing'],
    basicAttack: {
      kind: 'ranged',
      projectile: 'arrow',
      speed: 640,
      radius: 4,
      pierce: 1,
      pierceMult: 0.6,
      splash: 0,
      splashRadius: 0,
      description: 'Стріла прошиває першого ворога; той, хто позаду, — 60%.',
    },
    color: '#3fa34d',
    icon: 'bow',
    traits: { dodgeMelee: 0.5, moveSpeedMult: 1.2 },
    traitText: '+20% руху, 50% ухилення впритул',
  },
};

export const CLASS_ORDER = ['warrior', 'mage', 'archer'] as const;

export function getClass(id: string): ClassDef {
  const c = CLASSES[id];
  if (!c) throw new Error(`Unknown class: ${id}`);
  return c;
}
