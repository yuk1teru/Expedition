// Skills of the rework (ROADMAP 20.6, docs/SKILLS.md): the four starting skills of each class.
// A skill is pressed (keys 1–4) and aimed at the cursor; it has five ranks, each written as what
// it changes ("Вихор: +1 с тривалості"). Ranks 2–5 change the numbers of rank 1 in order.

import type { ReworkClassId } from './rework';

export type ReworkSkillId =
  | 'whirlwind'
  | 'groundSlam'
  | 'axeThrow'
  | 'battleCry'
  | 'fireball'
  | 'frostRing'
  | 'magicMissiles'
  | 'chainLightning'
  | 'multishot'
  | 'arrowRain'
  | 'piercingShot'
  | 'hunterTrap';

/** Every number a skill may use (a skill reads only its own). */
export interface SkillParams {
  cooldown: number;
  damage: number;
  radius: number;
  duration: number;
  range: number;
  /** Cone or fan width, degrees. */
  angle: number;
  count: number;
  stun: number;
  freeze: number;
  slow: number;
  /** 1 — on (a yes/no mechanic). */
  pull: number;
  fear: number;
  heal: number;
  attackSpeed: number;
  guard: number;
  pierce: number;
  bounce: number;
  burn: number;
  echo: number;
  returns: number;
  max: number;
  width: number;
  grow: number;
}

export interface SkillRank {
  /** What the rank gives, as the card says it. */
  text: string;
  mul?: Partial<SkillParams>;
  add?: Partial<SkillParams>;
}

export interface ReworkSkillDef {
  id: ReworkSkillId;
  classId: ReworkClassId;
  name: string;
  /** What rank 1 does, one line. */
  text: string;
  base: Partial<SkillParams>;
  /** Ranks 2, 3, 4, 5. */
  ranks: [SkillRank, SkillRank, SkillRank, SkillRank];
  /** Aimed at the cursor (else it works around the hero). */
  aimed: boolean;
}

export const SKILL_SLOTS = 4;

export const REWORK_SKILLS: Record<ReworkSkillId, ReworkSkillDef> = {
  // ---- Warrior ----
  whirlwind: {
    id: 'whirlwind',
    classId: 'warrior',
    name: 'Вихор',
    text: 'Крутиться 2 с, ріже все довкола.',
    base: { cooldown: 8, damage: 7, radius: 72, duration: 2 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '+1 с тривалості', add: { duration: 1 } },
      { text: '+25% радіуса', mul: { radius: 1.25 } },
      { text: 'тягне ворогів до себе', add: { pull: 1 } },
    ],
    aimed: false,
  },
  groundSlam: {
    id: 'groundSlam',
    classId: 'warrior',
    name: 'Удар об землю',
    text: 'Конус перед собою, оглушує на 1 с.',
    base: { cooldown: 6, damage: 22, range: 120, angle: 100, stun: 1 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: 'оглушує на 1,5 с', add: { stun: 0.5 } },
      { text: '+30% дальності', mul: { range: 1.3 } },
      { text: 'кут 160°', add: { angle: 60 } },
    ],
    aimed: true,
  },
  axeThrow: {
    id: 'axeThrow',
    classId: 'warrior',
    name: 'Кидок сокири',
    text: 'Сокира летить до курсора крізь усіх.',
    base: { cooldown: 4, damage: 16, range: 360, count: 1, angle: 18 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '+1 сокира', add: { count: 1 } },
      { text: '−1 с перезарядки', add: { cooldown: -1 } },
      { text: 'сокира повертається й б’є вдруге', add: { returns: 1 } },
    ],
    aimed: true,
  },
  battleCry: {
    id: 'battleCry',
    classId: 'warrior',
    name: 'Бойовий клич',
    text: '6 с: +40% швидкості атаки, −20% шкоди герою.',
    base: { cooldown: 14, duration: 6, attackSpeed: 0.4, guard: 0.2, radius: 160 },
    ranks: [
      { text: '+2 с тривалості', add: { duration: 2 } },
      { text: 'вороги поруч тікають 1,5 с', add: { fear: 1.5 } },
      { text: '+20% швидкості атаки', add: { attackSpeed: 0.2 } },
      { text: 'лікує 15% HP', add: { heal: 0.15 } },
    ],
    aimed: false,
  },
  // ---- Mage ----
  fireball: {
    id: 'fireball',
    classId: 'mage',
    name: 'Вогняна куля',
    text: 'Вибух у точці курсора.',
    base: { cooldown: 3.5, damage: 22, radius: 60, range: 420, count: 1, angle: 16 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: 'лишає палаючу землю на 2 с', add: { burn: 2 } },
      { text: '+30% радіуса', mul: { radius: 1.3 } },
      { text: '+1 куля', add: { count: 1 } },
    ],
    aimed: true,
  },
  frostRing: {
    id: 'frostRing',
    classId: 'mage',
    name: 'Крижане кільце',
    text: 'Кільце довкола, заморожує на 1,5 с.',
    base: { cooldown: 7, damage: 12, radius: 110, freeze: 1.5 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: 'заморожує на 2,5 с', add: { freeze: 1 } },
      { text: '+30% радіуса', mul: { radius: 1.3 } },
      { text: 'друга хвиля за 0,5 с', add: { echo: 1 } },
    ],
    aimed: false,
  },
  magicMissiles: {
    id: 'magicMissiles',
    classId: 'mage',
    name: 'Магічні стріли',
    text: '3 стріли самі летять у найближчих.',
    base: { cooldown: 3, damage: 9, count: 3, range: 420 },
    ranks: [
      { text: '+1 стріла', add: { count: 1 } },
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '+1 стріла', add: { count: 1 } },
      { text: 'стріли відскакують ще раз', add: { bounce: 1 } },
    ],
    aimed: false,
  },
  chainLightning: {
    id: 'chainLightning',
    classId: 'mage',
    name: 'Ланцюгова блискавка',
    text: 'Від ворога біля курсора стрибає між 4.',
    base: { cooldown: 5, damage: 16, count: 4, range: 140 },
    ranks: [
      { text: '+2 стрибки', add: { count: 2 } },
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '−1 с перезарядки', add: { cooldown: -1 } },
      { text: 'оглушує на 0,5 с', add: { stun: 0.5 } },
    ],
    aimed: true,
  },
  // ---- Archer ----
  multishot: {
    id: 'multishot',
    classId: 'archer',
    name: 'Мультипостріл',
    text: 'Віяло з 5 стріл до курсора.',
    base: { cooldown: 4, damage: 9, count: 5, angle: 40, range: 420 },
    ranks: [
      { text: '+2 стріли', add: { count: 2 } },
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: 'стріли пробивають ще одного', add: { pierce: 1 } },
      { text: '+2 стріли', add: { count: 2 } },
    ],
    aimed: true,
  },
  arrowRain: {
    id: 'arrowRain',
    classId: 'archer',
    name: 'Дощ стріл',
    text: 'Зона в точці курсора на 2,5 с.',
    base: { cooldown: 8, damage: 6, radius: 80, duration: 2.5, range: 420 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '+1 с тривалості', add: { duration: 1 } },
      { text: '+30% радіуса', mul: { radius: 1.3 } },
      { text: 'сповільнює на 40%', add: { slow: 0.4 } },
    ],
    aimed: true,
  },
  piercingShot: {
    id: 'piercingShot',
    classId: 'archer',
    name: 'Пронизлива стріла',
    text: 'Стріла крізь усіх на лінії.',
    base: { cooldown: 5, damage: 30, range: 620, width: 10 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: 'удвічі ширша', mul: { width: 2 } },
      { text: '−1,5 с перезарядки', add: { cooldown: -1.5 } },
      { text: 'кожен пробитий +15% шкоди наступному', add: { grow: 0.15 } },
    ],
    aimed: true,
  },
  hunterTrap: {
    id: 'hunterTrap',
    classId: 'archer',
    name: 'Пастка',
    text: 'Пастка біля курсора вибухає під ворогом (до 3).',
    base: { cooldown: 3, damage: 25, radius: 60, max: 3, range: 300 },
    ranks: [
      { text: '+40% шкоди', mul: { damage: 1.4 } },
      { text: '+1 пастка одночасно', add: { max: 1 } },
      { text: '+30% радіуса', mul: { radius: 1.3 } },
      { text: 'оглушує на 1 с', add: { stun: 1 } },
    ],
    aimed: true,
  },
};

/** The starting skills of each class (skills 5–8 open from bosses later, VISION §4). */
export const CLASS_SKILLS: Record<ReworkClassId, ReworkSkillId[]> = {
  warrior: ['whirlwind', 'groundSlam', 'axeThrow', 'battleCry'],
  mage: ['fireball', 'frostRing', 'magicMissiles', 'chainLightning'],
  archer: ['multishot', 'arrowRain', 'piercingShot', 'hunterTrap'],
};

const ZERO: SkillParams = {
  cooldown: 0, damage: 0, radius: 0, duration: 0, range: 0, angle: 0, count: 0, stun: 0, freeze: 0, slow: 0, pull: 0, fear: 0, heal: 0,
  attackSpeed: 0, guard: 0, pierce: 0, bounce: 0, burn: 0, echo: 0, returns: 0, max: 0, width: 0, grow: 0,
};

/** The numbers of a skill at a rank (1…5). */
export function skillParams(id: ReworkSkillId, rank: number): SkillParams {
  const d = REWORK_SKILLS[id];
  const p: SkillParams = { ...ZERO, ...d.base };
  for (let r = 2; r <= rank; r++) {
    const step = d.ranks[r - 2]!;
    for (const [k, v] of Object.entries(step.mul ?? {})) p[k as keyof SkillParams] *= v as number;
    for (const [k, v] of Object.entries(step.add ?? {})) p[k as keyof SkillParams] += v as number;
  }
  return p;
}

/**
 * Evolutions (20.8, docs/SKILLS.md): a skill at rank 5 and the named passive (any rank) bring a
 * golden card; the evolved skill keeps its rank-5 numbers changed by `mul`/`add` and gains its
 * new form (the cast reads `evolved`). Three per class open with the starting passives; the
 * others wait for passives that bosses open later.
 */
export interface EvolutionDef {
  name: string;
  needs: 'amount' | 'area' | 'cooldown' | 'health' | 'swiftness' | 'magnet';
  text: string;
  mul?: Partial<SkillParams>;
  add?: Partial<SkillParams>;
}

export const EVOLUTIONS: Partial<Record<ReworkSkillId, EvolutionDef>> = {
  whirlwind: { name: 'Буревій', needs: 'swiftness', text: 'вихор довший, ширший і тягне ворогів до себе', mul: { duration: 1.5, radius: 1.25, damage: 1.3 }, add: { pull: 1 } },
  groundSlam: { name: 'Розлам', needs: 'area', text: 'удар лишає тріщину, що тричі вибухає вздовж лінії', mul: { damage: 1.2 } },
  axeThrow: { name: 'Сокировий вир', needs: 'amount', text: 'сокири 3 с кружляють довкола героя й ріжуть усіх поруч', add: { count: 2 } },
  fireball: { name: 'Вогняний розсип', needs: 'amount', text: 'кожна куля розпадається на 3 менші вибухи', mul: { damage: 1.1 } },
  frostRing: { name: 'Полярне коло', needs: 'area', text: 'кільце розходиться трьома хвилями, кожна ширша', mul: { damage: 1.1 } },
  magicMissiles: { name: 'Чарівний рій', needs: 'magnet', text: 'стріли кружляють довкола героя й зриваються на тих, хто підійшов', add: { count: 3, bounce: 1 } },
  multishot: { name: 'Залп', needs: 'amount', text: 'три віяла стріл поспіль', mul: { damage: 1.1 } },
  arrowRain: { name: 'Злива', needs: 'area', text: 'дощ стріл іде за героєм і триває довше', mul: { duration: 1.6 } },
  piercingShot: { name: 'Стріла долі', needs: 'cooldown', text: 'стріла летить далі й повертається, пробиваючи всіх удруге', mul: { range: 1.6 }, add: { returns: 1 } },
};
