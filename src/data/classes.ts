// Hero classes. Mage and Archer are visible but locked in the slice.

export type ClassIcon = 'shield' | 'orb' | 'bow';

/**
 * Basic (auto) attack of a class. `melee`: hits the nearest enemy in an arc
 * towards the aim; others in the arc take `splash` × damage.
 * `ranged`: described for Mage/Archer, not implemented in the slice yet.
 */
export type BasicAttackDef =
  | { kind: 'melee'; arcDeg: number; splash: number; description: string }
  | { kind: 'ranged'; description: string };

/** Hero before the class choice. */
export const NOVICE_ATTACK: BasicAttackDef = {
  kind: 'melee',
  arcDeg: 50,
  splash: 0,
  description: 'Одиночний удар вузькою дугою: б’є одного найближчого ворога прямо перед собою.',
};

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
}

export const CLASSES: Record<string, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Воїн',
    role: 'Ближній бій, багато HP',
    description: 'Врізається в натовп і тримає удар.',
    locked: false,
    hpMult: 1.4,
    attackSpeedMult: 1,
    skillDamageMult: 1,
    ranged: false,
    range: 40,
    defaultPicks: ['whirlwind', 'charge', 'groundSlam'],
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
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    role: 'Дальній бій, мало HP',
    description: 'Вогонь, лід і блискавки здалеку.',
    locked: true,
    hpMult: 0.8,
    attackSpeedMult: 1,
    skillDamageMult: 1.25,
    ranged: true,
    range: 260,
    defaultPicks: [],
    skills: [],
    passives: [],
    basicAttack: { kind: 'ranged', description: 'Вогняний снаряд; вороги впритул обпікаються (мале AoE).' },
    preview: {
      skills: ['Вогняна куля', 'Крижане кільце', 'Ланцюгова блискавка', 'Телепорт'],
      passives: ['Сила чар', 'Зосередження', "Магічний бар'єр"],
      passiveMaxStacks: 5,
    },
    color: '#3b7dd8',
    icon: 'orb',
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    role: 'Дальній бій, швидкі атаки',
    description: 'Злива стріл і пастки.',
    locked: true,
    hpMult: 1,
    attackSpeedMult: 1.4,
    skillDamageMult: 1,
    ranged: true,
    range: 300,
    defaultPicks: [],
    skills: [],
    passives: [],
    basicAttack: { kind: 'ranged', description: 'Стріла прошиває першого ворога й ранить того, хто позаду.' },
    preview: {
      skills: ['Мультипостріл', 'Пастка', 'Дощ стріл', 'Відскок'],
      passives: ['Влучність', 'Спритність', 'Пробиття'],
      passiveMaxStacks: 5,
    },
    color: '#3fa34d',
    icon: 'bow',
  },
};

export const CLASS_ORDER = ['warrior', 'mage', 'archer'] as const;

export function getClass(id: string): ClassDef {
  const c = CLASSES[id];
  if (!c) throw new Error(`Unknown class: ${id}`);
  return c;
}
