// Skills and passives. Each skill has rank-1 parameters and 4 upgrades (ranks 2–5):
// every upgrade sets new absolute values; ranks 3 and 5 add a special modifier.

import { RANKS } from './balance';

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

export type SkillIcon = 'whirl' | 'dash' | 'shout' | 'slam' | 'axe' | 'shield' | 'quake' | 'hook';

export interface SkillUpgrade {
  /** New absolute parameter values from this rank on. */
  set: SkillParams;
  /** Qualitative change (special modifier); numeric changes are listed automatically. */
  text?: string;
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
  icon: SkillIcon;
  /** Short description; {param} placeholders are filled from rank params. */
  description: string;
  /** Upgrades for ranks 2..RANKS.max. */
  upgrades: SkillUpgrade[];
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
    classId: 'warrior',
    targeting: 'self',
    icon: 'quake',
    description: '{pulses} поштовхи раз на 1 с навколо героя (радіус {radius} px): {damage%} атаки героя й сповільнення ворогів на {slow%}.',
    base: { cooldown: 12, radius: 110, castRange: 130, pulses: 3, interval: 1, damage: 0.6, slow: 0.25, slowTime: 0.8, stun: 0 },
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
};

/** How numeric parameter changes are shown in rank descriptions (others are hidden). */
const PARAM_INFO: Record<string, { label: string; unit: 'pct' | 's' | 'px' | 'deg' | 'n' }> = {
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
};

export interface PassiveDef {
  id: string;
  name: string;
  classId: string;
  branch?: string;
  maxStacks: number;
  /** {value} placeholder = per-stack value. */
  description: string;
  stat: 'armor' | 'lifesteal' | 'thorns' | 'critChance' | 'attackSpeedPct' | 'hpPct' | 'skillDamagePct' | 'cooldownPct' | 'killCdr';
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
export function skillParams(id: string, rank: number): SkillParams {
  const def = getSkill(id);
  const idx = Math.max(1, Math.min(RANKS.max, rank)) - 1;
  return def.ranks[idx] as SkillParams;
}

/** Fills {param} and {param%} placeholders. */
export function describeSkill(id: string, rank: number): string {
  const p = skillParams(id, rank);
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
