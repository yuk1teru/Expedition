// Hero classes. Mage and Archer are visible but locked in the slice.

export type ClassIcon = 'shield' | 'orb' | 'bow';

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
  startingSkill: string;
  /** Display name of the starting skill (locked classes have no skill data yet). */
  startingSkillName: string;
  skills: string[];
  passives: string[];
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
    startingSkill: 'whirlwind',
    startingSkillName: 'Вихор',
    skills: ['whirlwind', 'charge', 'battleCry', 'groundSlam'],
    passives: ['armor', 'vampirism', 'thorns'],
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
    startingSkill: 'fireball',
    startingSkillName: 'Вогняна куля',
    skills: [],
    passives: [],
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
    startingSkill: 'multishot',
    startingSkillName: 'Мультипостріл',
    skills: [],
    passives: [],
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
