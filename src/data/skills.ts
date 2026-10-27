// Skills and passives. Each skill has rank-1 parameters and 4 upgrades (ranks 2–5):
// every upgrade sets new absolute values; ranks 3 and 5 add a special modifier.

import { RANKS } from './balance';
import type { Element } from './elements';

export type Targeting =
  /** Around the hero; needs an enemy within `castRange`. */
  | 'self'
  /** Densest enemy cluster within `range`. */
  | 'densest'
  /** Cone towards the direction that hits the most enemies within `range`. */
  | 'cone'
  /** Any living enemy on the field. */
  | 'any';

export type SkillParams = Record<string, number>;

export type SkillIcon =
  | 'whirl'
  | 'dash'
  | 'shout'
  | 'slam'
  | 'axe'
  | 'shield'
  | 'quake'
  | 'hook'
  | 'fireball'
  | 'frost'
  | 'chain'
  | 'blink'
  | 'missiles'
  | 'barrier'
  | 'wall'
  | 'vortex'
  | 'multishot'
  | 'trap'
  | 'rain'
  | 'vault'
  | 'pierce'
  | 'mark'
  | 'net'
  | 'barrage'
  | 'rage'
  | 'holy'
  | 'meteor'
  | 'blizzard'
  | 'scope'
  | 'pack';

export interface SkillUpgrade {
  /** New absolute parameter values from this rank on. */
  set: SkillParams;
  /** Qualitative change (special modifier); numeric changes are listed automatically. */
  text?: string;
}

/** One of the two variants of a fork rank (ROADMAP 12.3): its own parameters and maybe an element. */
export interface SkillFork {
  name: string;
  text: string;
  set: SkillParams;
  element?: Element;
}

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  branch?: string;
  targeting: Targeting;
  /** Direction follows the mouse when the cursor is inside the arena. */
  aimable?: boolean;
  /** Moves the hero (blocked while rooted by a trap). */
  moves?: boolean;
  /** Element of the skill's damage (ROADMAP 12.2); 'arrows' — the archer's chosen arrows. Default: neutral. */
  element?: Element | 'arrows';
  icon: SkillIcon;
  /** Short description; {param} placeholders are filled from rank params. */
  description: string;
  /** Upgrades for ranks 2..RANKS.max. */
  upgrades: SkillUpgrade[];
  /**
   * Forks: at these ranks the player picks one of two variants instead of the plain upgrade
   * (the first variant is the plain one, maybe with an element).
   */
  forks?: { rank: 3 | 5; options: [SkillFork, SkillFork] }[];
  /** Params per rank: index 0 → rank 1. */
  ranks: SkillParams[];
}

function skill(def: Omit<SkillDef, 'ranks'> & { base: SkillParams }): SkillDef {
  const { base, ...rest } = def;
  if (def.upgrades.length !== RANKS.max - 1) throw new Error(`Skill ${def.id} needs ${RANKS.max - 1} upgrades`);
  const ranks: SkillParams[] = [{ ...base }];
  for (const u of def.upgrades) ranks.push({ ...(ranks[ranks.length - 1] as SkillParams), ...u.set });
  return { ...rest, ranks };
}

export const SKILLS: Record<string, SkillDef> = {
  whirlwind: skill({
    id: 'whirlwind',
    name: 'Вихор',
    classId: 'warrior',
    targeting: 'self',
    icon: 'whirl',
    description: 'Герой крутиться {duration} с і кожні {tick} с б’є всіх ворогів у радіусі {radius} px на {damage%} своєї атаки.',
    base: { cooldown: 8, duration: 1.5, tick: 0.25, damage: 0.6, radius: 90, castRange: 150, pull: 0, guard: 0 },
    forks: [
      {
        rank: 3,
        options: [
          { name: 'Вихор бурі', text: 'Стає Вітром і притягує ворогів до центру.', set: { pull: 240 }, element: 'wind' },
          { name: 'Сталевий вихор', text: 'Без притягування, зате б’є сильніше.', set: { damage: 0.95 } },
        ],
      },
    ],
    upgrades: [
      { set: { damage: 0.72 } },
      { set: { pull: 240 }, text: 'Притягує ворогів до центру.' },
      { set: { duration: 2, cooldown: 7 } },
      { set: { guard: 0.3 }, text: 'Під час обертання −30% отриманої шкоди.' },
    ],
  }),
  charge: skill({
    id: 'charge',
    name: 'Ривок',
    classId: 'warrior',
    targeting: 'densest',
    aimable: true,
    moves: true,
    icon: 'dash',
    description: 'Стрибок до курсора (до {range} px) з невразливістю: вороги на шляху й біля приземлення — {damage%} атаки героя й оглушення {stun} с.',
    base: {
      cooldown: 8,
      range: 240,
      damage: 1.5,
      radius: 70,
      /** Width of the damaging path, px. */
      pathWidth: 56,
      stun: 0.6,
      speed: 900,
      knockback: 220,
      trail: 0,
      trailDamage: 0.3,
      trailDuration: 2,
      trailTick: 0.25,
      trailRadius: 24,
      trailSpacing: 30,
      // Safe-landing search around a group while boss telegraphs are active.
      landingRing: 80,
      landingSamples: 12,
    },
    upgrades: [
      { set: { damage: 1.8, cooldown: 7.2 } },
      { set: { trail: 1 }, text: 'Залишає вогняний слід на 2 с.' },
      { set: { range: 300, stun: 1 } },
      { set: { radius: 110, damage: 2.4 }, text: 'Ширша ударна хвиля в точці приземлення.' },
    ],
  }),
  battleCry: skill({
    id: 'battleCry',
    name: 'Бойовий клич',
    classId: 'warrior',
    targeting: 'any',
    icon: 'shout',
    description: 'На {duration} с: герой атакує на {attackSpeed%} швидше, вороги в радіусі {tauntRadius} px кидаються на героя (стрільці теж ідуть впритул).',
    base: { cooldown: 14, duration: 5, attackSpeed: 0.4, tauntRadius: 200, damageReduction: 0, healPerEnemy: 0 },
    upgrades: [
      { set: { attackSpeed: 0.5 } },
      { set: { damageReduction: 0.2 }, text: '−20% отриманої шкоди на час дії.' },
      { set: { duration: 7, cooldown: 12 } },
      { set: { healPerEnemy: 0.02 }, text: 'Лікує 2% HP за кожного спровокованого ворога.' },
    ],
  }),
  groundSlam: skill({
    id: 'groundSlam',
    name: 'Удар об землю',
    element: 'earth',
    classId: 'warrior',
    targeting: 'cone',
    aimable: true,
    icon: 'slam',
    description: 'Удар конусом {angle}° на {range} px у бік курсора: {damage%} атаки героя і відкидання ворогів.',
    base: { cooldown: 9, angle: 90, range: 220, damage: 2, knockback: 420, stun: 0, executeBelow: 0, executeMult: 1.6 },
    upgrades: [
      { set: { damage: 2.4 } },
      { set: { stun: 0.8 }, text: 'Оглушує на 0.8 с.' },
      { set: { angle: 120, cooldown: 8 } },
      { set: { executeBelow: 0.5 }, text: 'Страта: ×1.6 шкоди ворогам, у яких менше 50% HP.' },
    ],
  }),
  axeThrow: skill({
    id: 'axeThrow',
    name: 'Кидок сокири',
    classId: 'warrior',
    targeting: 'any',
    aimable: true,
    icon: 'axe',
    description: 'Сокира летить до курсора на {range} px: {damage%} атаки героя кожному, кого зачепить; пролітає крізь {pierce} ворогів.',
    base: { cooldown: 6, damage: 1.8, range: 420, speed: 520, radius: 10, pierce: 2, count: 1, spreadDeg: 18 },
    forks: [
      {
        rank: 3,
        options: [
          { name: 'Крижана сокира', text: 'Сокира з льоду: Вода, пробиває всіх на шляху.', set: { pierce: 99 }, element: 'water' },
          { name: 'Дві сокири', text: 'Дві сокири віялом.', set: { count: 2 } },
        ],
      },
    ],
    upgrades: [
      { set: { damage: 2.2 } },
      { set: { pierce: 99 }, text: 'Пробиває всіх ворогів на шляху.' },
      { set: { cooldown: 5, speed: 620 } },
      { set: { count: 3 }, text: 'Три сокири віялом.' },
    ],
  }),
  ironSkin: skill({
    id: 'ironSkin',
    name: 'Залізна шкіра',
    classId: 'warrior',
    targeting: 'any',
    icon: 'shield',
    description: 'На {duration} с шкода, яку отримує герой, менша на {damageReduction%}, а сам він за цей час відновлює {heal%} макс. HP.',
    base: { cooldown: 16, duration: 6, damageReduction: 0.35, heal: 0.2, damageBonus: 0, ccImmune: 0 },
    upgrades: [
      { set: { damageReduction: 0.45, heal: 0.3 } },
      { set: { damageBonus: 0.25 }, text: 'Поки діє, атаки й скіли героя б’ють на 25% сильніше.' },
      { set: { duration: 8, cooldown: 14 } },
      { set: { ccImmune: 1 }, text: 'Поки діє — несприйнятливість до сповільнень, пасток і оглушень.' },
    ],
  }),
  earthquake: skill({
    id: 'earthquake',
    name: 'Землетрус',
    element: 'earth',
    classId: 'warrior',
    targeting: 'self',
    icon: 'quake',
    description: '{pulses} поштовхи раз на 1 с навколо героя (радіус {radius} px): {damage%} атаки героя й сповільнення ворогів на {slow%}.',
    base: { cooldown: 12, radius: 110, castRange: 130, pulses: 3, interval: 1, damage: 0.6, slow: 0.25, slowTime: 0.8, stun: 0 },
    forks: [
      {
        rank: 5,
        options: [
          { name: 'Вогняний розлам', text: 'Земля розколюється вогнем: Вогонь, поштовхи оглушують на 0.3 с.', set: { stun: 0.3 }, element: 'fire' },
          { name: 'Глибокий розлам', text: 'Земля, поштовхи оглушують на 0.6 с.', set: { stun: 0.6 } },
        ],
      },
    ],
    upgrades: [
      { set: { damage: 0.75 } },
      { set: { pulses: 4 } },
      { set: { radius: 130, cooldown: 11 } },
      { set: { stun: 0.3 }, text: 'Кожен поштовх оглушує на 0.3 с.' },
    ],
  }),
  hook: skill({
    id: 'hook',
    name: 'Гак',
    classId: 'warrior',
    targeting: 'cone',
    aimable: true,
    icon: 'hook',
    description: 'Висмикує всіх ворогів у конусі {angle}° (до {range} px) впритул до героя: {damage%} атаки героя й оглушення на {stun} с.',
    // `pullSpeed`: how fast pulled enemies fly to the hero, px/s (mass does not matter).
    base: { cooldown: 8, angle: 50, range: 320, damage: 1, pullSpeed: 1800, stun: 0.8, vuln: 0, vulnTime: 3 },
    upgrades: [
      { set: { damage: 1.3 } },
      { set: { angle: 70 } },
      { set: { stun: 1.2, cooldown: 7 } },
      { set: { vuln: 0.25 }, text: 'Підтягнуті вороги 3 с отримують +25% шкоди.' },
    ],
  }),

  // ---- Mage ----
  fireball: skill({
    id: 'fireball',
    name: 'Вогняна куля',
    element: 'fire',
    classId: 'mage',
    targeting: 'densest',
    aimable: true,
    icon: 'fireball',
    description: 'Куля летить до курсора (до {range} px) і вибухає на першому ворогові або в точці: {damage%} атаки героя всім у радіусі {radius} px.',
    base: { cooldown: 5, range: 380, speed: 520, damage: 2.2, radius: 80, ground: 0, groundDamage: 0.3, groundTime: 3, groundTick: 0.5, stun: 0, knockback: 0 },
    upgrades: [
      { set: { damage: 2.6 } },
      { set: { ground: 1 }, text: 'Залишає палаюче коло на 3 с (30% атаки героя кожні 0.5 с).' },
      { set: { radius: 100, cooldown: 4.5 } },
      { set: { stun: 0.6, knockback: 300 }, text: 'Вибух відкидає ворогів і оглушує на 0.6 с.' },
    ],
  }),
  frostRing: skill({
    id: 'frostRing',
    name: 'Крижане кільце',
    element: 'water',
    classId: 'mage',
    targeting: 'self',
    icon: 'frost',
    description: 'Холод навколо героя (радіус {radius} px): {damage%} атаки героя й заморожування ворогів на {freeze} с.',
    base: { cooldown: 10, radius: 150, castRange: 170, damage: 0.8, freeze: 1.5, field: 0, fieldSlow: 0.4, fieldTime: 3 },
    upgrades: [
      { set: { damage: 1 } },
      { set: { radius: 225, castRange: 240 }, text: 'Радіус кільця +50%.' },
      { set: { freeze: 2, cooldown: 9 } },
      { set: { field: 1 }, text: 'Залишає крижане поле на 3 с: вороги в ньому сповільнені на 40%.' },
    ],
  }),
  chainLightning: skill({
    id: 'chainLightning',
    name: 'Ланцюгова блискавка',
    element: 'wind',
    classId: 'mage',
    targeting: 'any',
    aimable: true,
    icon: 'chain',
    description: 'Блискавка б’є ворога біля курсора (до {range} px від героя) і перескакує між {jumps} ворогами: {damage%} атаки героя, −15% за кожен стрибок.',
    base: { cooldown: 6, range: 340, jumps: 4, jumpRange: 160, damage: 1.2, falloff: 0.15, stun: 0 },
    forks: [
      {
        rank: 5,
        options: [
          { name: 'Розряд', text: 'Кожне влучання оглушує на 0.4 с.', set: { stun: 0.4 } },
          { name: 'Буря', text: 'Ланцюг із 10 ворогів.', set: { jumps: 10 } },
        ],
      },
    ],
    upgrades: [
      { set: { damage: 1.45 } },
      { set: { jumps: 7 }, text: 'Ланцюг із 7 ворогів.' },
      { set: { cooldown: 5, jumpRange: 200 } },
      { set: { stun: 0.4 }, text: 'Кожне влучання оглушує на 0.4 с.' },
    ],
  }),
  teleport: skill({
    id: 'teleport',
    name: 'Телепорт',
    classId: 'mage',
    targeting: 'any',
    aimable: true,
    moves: true,
    icon: 'blink',
    description: 'Миттєво переносить героя до курсора (до {range} px) і дає {invuln} с невразливості.',
    base: { cooldown: 8, range: 200, invuln: 0.5, blastDamage: 0, blastRadius: 90, empower: 0, empowerTime: 3 },
    upgrades: [
      { set: { range: 260, cooldown: 7 } },
      { set: { blastDamage: 1.5 }, text: 'У точці старту — вибух на 150% атаки героя (радіус 90 px).' },
      { set: { invuln: 1, cooldown: 6 } },
      { set: { empower: 0.3 }, text: 'Після телепорту 3 с атаки й скіли героя на 30% сильніші.' },
    ],
  }),
  magicMissiles: skill({
    id: 'magicMissiles',
    name: 'Магічні стріли',
    classId: 'mage',
    targeting: 'any',
    aimable: true,
    icon: 'missiles',
    description: '{count} магічні стріли летять у ворогів, найближчих до курсора: по {damage%} атаки героя.',
    base: { cooldown: 4, count: 3, damage: 0.8, speed: 620, range: 420, ricochet: 0 },
    forks: [
      {
        rank: 3,
        options: [
          { name: 'Вогняні стріли', text: 'П’ять стріл Вогню.', set: { count: 5 }, element: 'fire' },
          { name: 'Крижані стріли', text: 'П’ять стріл Води.', set: { count: 5 }, element: 'water' },
        ],
      },
    ],
    upgrades: [
      { set: { damage: 1 } },
      { set: { count: 5 }, text: 'П’ять стріл.' },
      { set: { cooldown: 3.5, speed: 720 } },
      { set: { ricochet: 1 }, text: 'Кожна стріла відскакує ще в одного ворога.' },
    ],
  }),
  iceBarrier: skill({
    id: 'iceBarrier',
    name: 'Крижаний бар’єр',
    element: 'water',
    classId: 'mage',
    targeting: 'any',
    icon: 'barrier',
    description: 'Бар’єр на {duration} с поглинає шкоду — до {shield%} макс. HP героя.',
    base: { cooldown: 15, duration: 6, shield: 0.25, nova: 0, novaRadius: 120, novaSlow: 0.5, novaTime: 2, freezeAttackers: 0 },
    upgrades: [
      { set: { shield: 0.3 } },
      { set: { nova: 1 }, text: 'Коли бар’єр розбивається — холодна хвиля: вороги поруч сповільнені на 50% на 2 с.' },
      { set: { shield: 0.35, cooldown: 13 } },
      { set: { freezeAttackers: 1 }, text: 'Поки бар’єр тримається, ворог, що б’є впритул, замерзає на 1 с.' },
    ],
  }),
  flameWall: skill({
    id: 'flameWall',
    name: 'Стіна вогню',
    element: 'fire',
    classId: 'mage',
    targeting: 'densest',
    aimable: true,
    icon: 'wall',
    description: 'Стіна вогню довжиною {length} px упоперек напрямку до курсора (до {range} px від героя): {duration} с, кожні 0.5 с — {damage%} атаки героя.',
    base: { cooldown: 10, range: 300, length: 160, duration: 4, tick: 0.5, damage: 0.35, segment: 28, burn: 0, burnDps: 0.3, burnTime: 3, slow: 0 },
    upgrades: [
      { set: { damage: 0.45 } },
      { set: { burn: 1 }, text: 'Вороги в стіні горять 3 с (30% атаки героя за секунду).' },
      { set: { length: 220, duration: 5 } },
      { set: { slow: 0.4 }, text: 'Стіна сповільнює ворогів на 40%.' },
    ],
  }),
  vortex: skill({
    id: 'vortex',
    name: 'Вирва',
    element: 'wind',
    classId: 'mage',
    targeting: 'densest',
    aimable: true,
    icon: 'vortex',
    description: 'Вирва біля курсора (до {range} px) {duration} с затягує ворогів у радіусі {radius} px і б’є їх на {damage%} атаки героя кожні 0.5 с.',
    base: { cooldown: 12, range: 320, radius: 110, duration: 3, tick: 0.5, damage: 0.3, pull: 160, finale: 0, finaleDamage: 2 },
    upgrades: [
      { set: { damage: 0.4 } },
      { set: { radius: 140, pull: 220 }, text: 'Ширша й сильніша вирва.' },
      { set: { duration: 4, cooldown: 11 } },
      { set: { finale: 1 }, text: 'Наприкінці вибухає: 200% атаки героя всім у вирві.' },
    ],
  }),

  // ---- Archer ----
  multishot: skill({
    id: 'multishot',
    name: 'Мультипостріл',
    element: 'arrows',
    classId: 'archer',
    targeting: 'cone',
    aimable: true,
    icon: 'multishot',
    description: '{count} стріл віялом {angle}° у бік курсора: по {damage%} атаки героя.',
    base: { cooldown: 5, count: 5, angle: 60, damage: 0.9, speed: 640, range: 360, pierce: 0 },
    upgrades: [
      { set: { damage: 1.05 } },
      { set: { count: 9 }, text: 'Дев’ять стріл.' },
      { set: { cooldown: 4, angle: 70 } },
      { set: { pierce: 1 }, text: 'Стріли пробивають одного ворога.' },
    ],
  }),
  hunterTrap: skill({
    id: 'hunterTrap',
    name: 'Пастка',
    classId: 'archer',
    targeting: 'any',
    aimable: true,
    icon: 'trap',
    description: 'Пастка біля курсора (до {range} px): коли ворог наступає — вибух у радіусі {radius} px на {damage%} атаки героя. До {max} пасток одночасно.',
    base: { cooldown: 6, range: 160, radius: 100, damage: 2.5, max: 3, life: 20, trigger: 22, slow: 0, slowTime: 2, stun: 0 },
    upgrades: [
      { set: { damage: 2.9 } },
      { set: { slow: 0.5 }, text: 'Вибух сповільнює на 50% на 2 с.' },
      { set: { cooldown: 5, max: 4 } },
      { set: { stun: 0.8 }, text: 'Вибух оглушує на 0.8 с.' },
    ],
  }),
  arrowRain: skill({
    id: 'arrowRain',
    name: 'Дощ стріл',
    element: 'arrows',
    classId: 'archer',
    targeting: 'densest',
    aimable: true,
    icon: 'rain',
    description: 'Дощ стріл біля курсора (до {range} px): {duration} с, кожні 0.25 с — {damage%} атаки героя всім у радіусі {radius} px.',
    base: { cooldown: 11, range: 360, radius: 110, duration: 3, tick: 0.25, damage: 0.4, slow: 0 },
    upgrades: [
      { set: { damage: 0.5 } },
      { set: { duration: 5 }, text: 'Дощ іде 5 с.' },
      { set: { radius: 130, cooldown: 10 } },
      { set: { slow: 0.3 }, text: 'Вороги під дощем сповільнені на 30%.' },
    ],
  }),
  vault: skill({
    id: 'vault',
    name: 'Відскок',
    classId: 'archer',
    targeting: 'any',
    aimable: true,
    moves: true,
    icon: 'vault',
    description: 'Стрибок на {range} px від курсора з невразливістю й постріл у бік курсора на {damage%} атаки героя.',
    base: { cooldown: 7, range: 180, damage: 2, speed: 900, arrowSpeed: 760, extraShots: 0, spreadDeg: 15, frenzy: 0, frenzyTime: 3 },
    upgrades: [
      { set: { damage: 2.4, cooldown: 6.5 } },
      { set: { extraShots: 2 }, text: 'Ще 2 постріли віялом.' },
      { set: { range: 220, cooldown: 6 } },
      { set: { frenzy: 0.4 }, text: 'Після відскоку 3 с — +40% швидкості атаки.' },
    ],
  }),
  piercingShot: skill({
    id: 'piercingShot',
    name: 'Пронизлива стріла',
    element: 'arrows',
    classId: 'archer',
    targeting: 'cone',
    aimable: true,
    icon: 'pierce',
    description: 'Важка стріла летить крізь усіх ворогів на {range} px у бік курсора: {damage%} атаки героя кожному.',
    base: { cooldown: 7, range: 520, speed: 900, damage: 2.5, vuln: 0, vulnTime: 4, growth: 1 },
    upgrades: [
      { set: { damage: 3 } },
      { set: { vuln: 0.2 }, text: 'Влучені вороги 4 с отримують +20% шкоди.' },
      { set: { cooldown: 6 } },
      { set: { growth: 1.25 }, text: 'Шкода росте на 25% за кожного пробитого ворога.' },
    ],
  }),
  hunterMark: skill({
    id: 'hunterMark',
    name: 'Мітка мисливця',
    classId: 'archer',
    targeting: 'any',
    aimable: true,
    icon: 'mark',
    description: 'Мітить ворога біля курсора (до {range} px від героя) на {duration} с: він отримує на {vuln%} більше шкоди.',
    base: { cooldown: 10, range: 420, duration: 6, vuln: 0.3, slow: 0, spread: 0, spreadRadius: 100 },
    upgrades: [
      { set: { vuln: 0.4 } },
      { set: { slow: 0.3 }, text: 'Позначений ворог сповільнений на 30%.' },
      { set: { duration: 8, cooldown: 9 } },
      { set: { spread: 1 }, text: 'Мітка лягає й на всіх ворогів у радіусі 100 px від цілі.' },
    ],
  }),
  net: skill({
    id: 'net',
    name: 'Сітка',
    classId: 'archer',
    targeting: 'densest',
    aimable: true,
    icon: 'net',
    description: 'Сітка летить до курсора (до {range} px) і розкривається на першому ворогові або в точці: вороги в радіусі {radius} px зв’язані на {stun} с.',
    base: { cooldown: 9, range: 320, radius: 70, stun: 2, speed: 700, vuln: 0, vulnTime: 3, damage: 0 },
    upgrades: [
      { set: { radius: 85 } },
      { set: { vuln: 0.25 }, text: 'Зв’язані вороги 3 с отримують +25% шкоди.' },
      { set: { stun: 2.5, cooldown: 8 } },
      { set: { damage: 1.5 }, text: 'Сітка б’є на 150% атаки героя.' },
    ],
  }),
  barrage: skill({
    id: 'barrage',
    name: 'Шквал',
    element: 'arrows',
    classId: 'archer',
    targeting: 'any',
    icon: 'barrage',
    description: 'На {duration} с герой стріляє на {attackSpeed%} швидше.',
    base: { cooldown: 12, duration: 3, attackSpeed: 1.5, pierce: 0, damageBonus: 0 },
    upgrades: [
      { set: { duration: 4 } },
      { set: { pierce: 1 }, text: 'Під час шквалу стріли пробивають ще одного ворога.' },
      { set: { attackSpeed: 2, cooldown: 11 } },
      { set: { damageBonus: 0.3 }, text: 'Під час шквалу атаки на 30% сильніші.' },
    ],
  }),

  // ---- Promotion signature skills (slot R) ----
  rage: skill({
    id: 'rage',
    name: 'Лють',
    classId: 'warrior',
    branch: 'berserker',
    targeting: 'any',
    icon: 'rage',
    description: 'На {duration} с: +{attackSpeed%} швидкості атаки і {lifesteal%} вампіризму.',
    base: { cooldown: 20, duration: 6, attackSpeed: 0.5, lifesteal: 0.15, guard: 0, ccImmune: 0 },
    upgrades: [
      { set: { duration: 7 } },
      { set: { guard: 0.3 }, text: 'Під час люті −30% отриманої шкоди.' },
      { set: { attackSpeed: 0.7, cooldown: 18 } },
      { set: { ccImmune: 1 }, text: 'Під час люті — несприйнятливість до оглушень, сповільнень і пасток.' },
    ],
  }),
  holyShield: skill({
    id: 'holyShield',
    name: 'Священний щит',
    element: 'holy',
    classId: 'warrior',
    branch: 'paladin',
    targeting: 'any',
    icon: 'holy',
    description: '{duration} с невразливості й лікування на {heal%} макс. HP героя.',
    base: { cooldown: 25, duration: 3, heal: 0.25, burst: 0, burstDamage: 1.5, burstRadius: 120, afterShield: 0, afterShieldTime: 5 },
    upgrades: [
      { set: { heal: 0.3 } },
      { set: { burst: 1 }, text: 'Спалах світла: 150% атаки героя ворогам у радіусі 120 px і відкидання.' },
      { set: { duration: 4, cooldown: 22 } },
      { set: { afterShield: 0.2 }, text: 'Після невразливості 5 с діє бар’єр на 20% макс. HP.' },
    ],
  }),
  meteor: skill({
    id: 'meteor',
    name: 'Метеор',
    element: 'fire',
    classId: 'mage',
    branch: 'pyromancer',
    targeting: 'densest',
    aimable: true,
    icon: 'meteor',
    description: 'Метеор падає в точку курсора (до {range} px) через {delay} с: {damage%} атаки героя всім у радіусі {radius} px.',
    base: { cooldown: 18, range: 420, delay: 1, radius: 140, damage: 6, ground: 0, groundTime: 4, groundDamage: 0.4, extra: 0 },
    upgrades: [
      { set: { damage: 7 } },
      { set: { ground: 1 }, text: 'Залишає палаюче коло на 4 с.' },
      { set: { radius: 170, cooldown: 16 } },
      { set: { extra: 2 }, text: 'Ще 2 менші метеори поруч.' },
    ],
  }),
  blizzard: skill({
    id: 'blizzard',
    name: 'Хуртовина',
    element: 'water',
    classId: 'mage',
    branch: 'cryomancer',
    targeting: 'self',
    icon: 'blizzard',
    description: 'Хуртовина навколо героя на {duration} с (радіус {radius} px): сповільнення ворогів на {slow%} і {damage%} атаки героя кожні 0.5 с.',
    base: { cooldown: 16, duration: 4, radius: 160, castRange: 200, slow: 0.5, damage: 0.3, tick: 0.5, freezeChance: 0 },
    upgrades: [
      { set: { damage: 0.4 } },
      { set: { radius: 200, castRange: 240 }, text: 'Ширша хуртовина.' },
      { set: { duration: 6, cooldown: 14 } },
      { set: { freezeChance: 0.2 }, text: 'Кожен порив з шансом 20% заморожує ворога на 1 с.' },
    ],
  }),
  aimedShot: skill({
    id: 'aimedShot',
    name: 'Прицільний постріл',
    element: 'arrows',
    classId: 'archer',
    branch: 'sniper',
    targeting: 'cone',
    aimable: true,
    icon: 'scope',
    description: 'Наведення {aim} с, потім постріл у бік курсора через усю арену: {damage%} атаки героя кожному на лінії.',
    base: { cooldown: 14, aim: 1, damage: 5, speed: 1600, range: 1000, vuln: 0, vulnTime: 4, extra: 0, spreadDeg: 8 },
    upgrades: [
      { set: { damage: 6 } },
      { set: { vuln: 0.25 }, text: 'Влучені вороги 4 с отримують +25% шкоди.' },
      { set: { aim: 0.6, cooldown: 12 } },
      { set: { extra: 2 }, text: 'Ще 2 постріли віялом.' },
    ],
  }),
  callOfPack: skill({
    id: 'callOfPack',
    name: 'Поклик зграї',
    classId: 'archer',
    branch: 'beastmaster',
    targeting: 'any',
    icon: 'pack',
    description: 'Кличе {count} вовків на {duration} с: кожен б’є на {wolfDamage%} атаки героя.',
    base: { cooldown: 20, count: 3, duration: 8, wolfDamage: 0.4, stun: 0 },
    upgrades: [
      { set: { duration: 10 } },
      { set: { count: 4 }, text: 'Четвертий вовк.' },
      { set: { cooldown: 17, wolfDamage: 0.5 } },
      { set: { stun: 0.5 }, text: 'Укус вовків зграї оглушує на 0.5 с.' },
    ],
  }),
};

/** How numeric parameter changes are shown in rank descriptions (others are hidden). */
export const PARAM_INFO: Record<string, { label: string; unit: 'pct' | 's' | 'px' | 'deg' | 'n' }> = {
  damage: { label: 'шкода (% атаки героя)', unit: 'pct' },
  cooldown: { label: 'перезарядка', unit: 's' },
  duration: { label: 'тривалість', unit: 's' },
  radius: { label: 'радіус', unit: 'px' },
  range: { label: 'дальність', unit: 'px' },
  angle: { label: 'кут конуса', unit: 'deg' },
  stun: { label: 'оглушення ворогів', unit: 's' },
  attackSpeed: { label: 'прискорення атак героя', unit: 'pct' },
  damageReduction: { label: 'менше шкоди герою', unit: 'pct' },
  heal: { label: 'лікування героя (% макс. HP)', unit: 'pct' },
  pulses: { label: 'поштовхів', unit: 'n' },
  speed: { label: 'швидкість польоту', unit: 'n' },
  freeze: { label: 'заморожування', unit: 's' },
  jumps: { label: 'ворогів у ланцюгу', unit: 'n' },
  jumpRange: { label: 'дальність стрибка', unit: 'px' },
  invuln: { label: 'невразливість', unit: 's' },
  count: { label: 'снарядів', unit: 'n' },
  shield: { label: 'бар’єр (% макс. HP)', unit: 'pct' },
  length: { label: 'довжина', unit: 'px' },
  max: { label: 'пасток одночасно', unit: 'n' },
  vuln: { label: 'додаткова шкода по цілі', unit: 'pct' },
  lifesteal: { label: 'вампіризм', unit: 'pct' },
  delay: { label: 'затримка', unit: 's' },
  aim: { label: 'наведення', unit: 's' },
  wolfDamage: { label: 'шкода вовка (% атаки героя)', unit: 'pct' },
};

export interface PassiveDef {
  id: string;
  name: string;
  classId: string;
  branch?: string;
  maxStacks: number;
  /** {value} placeholder = per-stack value. */
  description: string;
  stat: 'armor' | 'lifesteal' | 'thorns' | 'critChance' | 'attackSpeedPct' | 'hpPct' | 'skillDamagePct' | 'cooldownPct' | 'killCdr' | 'pierce' | 'petDamagePct';
  /** Per stack. */
  value: number;
  /** How to print the value: plain number, percent or seconds. */
  format: 'flat' | 'percent' | 'seconds';
}

export const PASSIVES: Record<string, PassiveDef> = {
  armor: {
    id: 'armor',
    name: 'Броня',
    classId: 'warrior',
    maxStacks: 5,
    description: '+{value} броні: уся шкода, яку отримує герой, менша (50 броні — −20%, 100 — −33%).',
    stat: 'armor',
    value: 6,
    format: 'flat',
  },
  vampirism: {
    id: 'vampirism',
    name: 'Вампіризм',
    classId: 'warrior',
    maxStacks: 5,
    description: 'Лікує героя на {value} від усієї завданої шкоди (атаки й скіли).',
    stat: 'lifesteal',
    value: 0.05,
    format: 'percent',
  },
  fervor: {
    id: 'fervor',
    name: 'Бойовий азарт',
    classId: 'warrior',
    maxStacks: 5,
    description: 'Кожне вбивство скорочує перезарядку всіх скілів на {value}.',
    stat: 'killCdr',
    value: 0.15,
    format: 'seconds',
  },
  spellPower: {
    id: 'spellPower',
    name: 'Сила чар',
    classId: 'mage',
    maxStacks: 5,
    description: 'Скіли героя б’ють на {value} сильніше.',
    stat: 'skillDamagePct',
    value: 0.1,
    format: 'percent',
  },
  focus: {
    id: 'focus',
    name: 'Зосередження',
    classId: 'mage',
    maxStacks: 5,
    description: 'Перезарядка всіх скілів коротша на {value}.',
    stat: 'cooldownPct',
    value: 0.06,
    format: 'percent',
  },
  arcaneBarrier: {
    id: 'arcaneBarrier',
    name: 'Магічний бар’єр',
    classId: 'mage',
    maxStacks: 5,
    description: '+{value} макс. HP героя.',
    stat: 'hpPct',
    value: 0.1,
    format: 'percent',
  },
  precision: {
    id: 'precision',
    name: 'Влучність',
    classId: 'archer',
    maxStacks: 5,
    description: '+{value} шансу критичного удару.',
    stat: 'critChance',
    value: 0.04,
    format: 'percent',
  },
  agility: {
    id: 'agility',
    name: 'Спритність',
    classId: 'archer',
    maxStacks: 5,
    description: '+{value} швидкості атаки.',
    stat: 'attackSpeedPct',
    value: 0.08,
    format: 'percent',
  },
  // ---- Promotion passives ----
  bloodlust: { id: 'bloodlust', name: 'Кровожерливість', classId: 'warrior', branch: 'berserker', maxStacks: 5, description: '+{value} вампіризму.', stat: 'lifesteal', value: 0.03, format: 'percent' },
  unstoppable: { id: 'unstoppable', name: 'Нестримність', classId: 'warrior', branch: 'berserker', maxStacks: 5, description: '+{value} швидкості атаки.', stat: 'attackSpeedPct', value: 0.06, format: 'percent' },
  blessing: { id: 'blessing', name: 'Благословення', classId: 'warrior', branch: 'paladin', maxStacks: 5, description: '+{value} макс. HP героя.', stat: 'hpPct', value: 0.08, format: 'percent' },
  sacredArmor: { id: 'sacredArmor', name: 'Освячена броня', classId: 'warrior', branch: 'paladin', maxStacks: 5, description: '+{value} броні.', stat: 'armor', value: 5, format: 'flat' },
  embers: { id: 'embers', name: 'Жар', classId: 'mage', branch: 'pyromancer', maxStacks: 5, description: 'Скіли героя б’ють на {value} сильніше.', stat: 'skillDamagePct', value: 0.08, format: 'percent' },
  ashes: { id: 'ashes', name: 'Попіл', classId: 'mage', branch: 'pyromancer', maxStacks: 5, description: 'Перезарядка всіх скілів коротша на {value}.', stat: 'cooldownPct', value: 0.05, format: 'percent' },
  coldHeart: { id: 'coldHeart', name: 'Холодне серце', classId: 'mage', branch: 'cryomancer', maxStacks: 5, description: '+{value} макс. HP героя.', stat: 'hpPct', value: 0.08, format: 'percent' },
  rime: { id: 'rime', name: 'Іній', classId: 'mage', branch: 'cryomancer', maxStacks: 5, description: 'Перезарядка всіх скілів коротша на {value}.', stat: 'cooldownPct', value: 0.05, format: 'percent' },
  hawkEye: { id: 'hawkEye', name: 'Око яструба', classId: 'archer', branch: 'sniper', maxStacks: 5, description: '+{value} шансу критичного удару.', stat: 'critChance', value: 0.03, format: 'percent' },
  steadyHand: { id: 'steadyHand', name: 'Тверда рука', classId: 'archer', branch: 'sniper', maxStacks: 5, description: '+{value} швидкості атаки.', stat: 'attackSpeedPct', value: 0.06, format: 'percent' },
  packLeader: { id: 'packLeader', name: 'Вожак', classId: 'archer', branch: 'beastmaster', maxStacks: 5, description: 'Вовки б’ють на {value} сильніше.', stat: 'petDamagePct', value: 0.15, format: 'percent' },
  instinct: { id: 'instinct', name: 'Мисливський інстинкт', classId: 'archer', branch: 'beastmaster', maxStacks: 5, description: '+{value} швидкості атаки.', stat: 'attackSpeedPct', value: 0.06, format: 'percent' },
  piercing: {
    id: 'piercing',
    name: 'Пробиття',
    classId: 'archer',
    maxStacks: 3,
    description: 'Базові стріли пробивають ще {value} ворога.',
    stat: 'pierce',
    value: 1,
    format: 'flat',
  },
};

export function getSkill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}

export function getPassive(id: string): PassiveDef {
  const p = PASSIVES[id];
  if (!p) throw new Error(`Unknown passive: ${id}`);
  return p;
}

/** Params for a rank (1..RANKS.max). */
/** Params of a skill at a rank; `forks`: the variant chosen at each fork rank (default — the first). */
export function skillParams(id: string, rank: number, forks?: Record<number, number>): SkillParams {
  const def = getSkill(id);
  const top = Math.max(1, Math.min(RANKS.max, rank));
  if (!def.forks || !forks) return def.ranks[top - 1] as SkillParams;
  let p: SkillParams = { ...def.ranks[0] };
  for (let r = 2; r <= top; r++) {
    const fork = def.forks.find((f) => f.rank === r);
    p = { ...p, ...(fork ? fork.options[forks[r] ?? 0]!.set : def.upgrades[r - 2]!.set) };
  }
  return p;
}

/** The fork variant chosen at a rank, if the skill forks there and the hero has reached it. */
export function chosenFork(id: string, rank: number, forks: Record<number, number> | undefined, at: 3 | 5): SkillFork | null {
  const fork = getSkill(id).forks?.find((f) => f.rank === at);
  if (!fork || rank < at) return null;
  return fork.options[forks?.[at] ?? 0]!;
}

/** Fills {param} and {param%} placeholders. */
export function describeSkill(id: string, rank: number, forks?: Record<number, number>): string {
  const p = skillParams(id, rank, forks);
  return getSkill(id).description.replace(/\{(\w+)(%?)\}/g, (_m, key: string, pct: string) => {
    const v = p[key];
    if (v === undefined) return key;
    return pct ? `${Math.round(v * 100)}%` : String(Math.round(v * 100) / 100);
  });
}

/** Description plus the cooldown, for cards and lists. */
export function describeSkillFull(id: string, rank: number): string {
  return `${describeSkill(id, rank)} Перезарядка ${Math.round((skillParams(id, rank).cooldown ?? 0) * 10) / 10} с.`;
}

function formatParam(v: number, unit: 'pct' | 's' | 'px' | 'deg' | 'n'): string {
  const r = Math.round(v * 100) / 100;
  switch (unit) {
    case 'pct':
      return `${Math.round(v * 100)}%`;
    case 's':
      return `${r} с`;
    case 'deg':
      return `${r}°`;
    default:
      return String(r);
  }
}

/** What a rank (2..max) changes: numeric changes and the special modifier, if any. */
export function rankChanges(id: string, rank: number): string {
  const up = getSkill(id).upgrades[rank - 2];
  if (!up) return '';
  const prev = skillParams(id, rank - 1);
  const parts: string[] = [];
  for (const [key, v] of Object.entries(up.set)) {
    const info = PARAM_INFO[key];
    const before = prev[key];
    // Params that start at 0 are special modifiers: their text explains them.
    if (!info || before === undefined || before === v || before === 0) continue;
    parts.push(`${info.label} ${formatParam(before, info.unit)} → ${formatParam(v, info.unit)}`);
  }
  if (up.text) parts.push(up.text);
  return parts.join('; ');
}

/** Ranks that bring a special modifier (highlighted in the UI). */
export function isSpecialRank(id: string, rank: number): boolean {
  return !!getSkill(id).upgrades[rank - 2]?.text;
}

export function describePassive(id: string): string {
  const p = getPassive(id);
  const v = p.format === 'percent' ? `${Math.round(p.value * 100)}%` : p.format === 'seconds' ? `${p.value} с` : String(p.value);
  return p.description.replace('{value}', v);
}
