// Skills and passives. Each skill has explicit parameters for ranks 1–3.
// General rule: rank 2 = +30% damage and −10% cooldown; rank 3 = rank 2 + a unique modifier.

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

export type SkillIcon = 'whirl' | 'dash' | 'shout' | 'slam';

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  branch?: string;
  targeting: Targeting;
  /** Direction follows the mouse when the cursor is inside the arena. */
  aimable?: boolean;
  icon: SkillIcon;
  /** Short description; {param} placeholders are filled from rank params. */
  description: string;
  /** Index 0..2 → rank 1..3. Every rank has `cooldown` and usually `damage` (× attack). */
  ranks: [SkillParams, SkillParams, SkillParams];
  rank3Modifier: { text: string; param: string; value: number };
}

/** Builds 3 ranks from base params using the general rule plus the rank-3 modifier. */
function ranks(base: SkillParams, rank3: { param: string; value: number }): [SkillParams, SkillParams, SkillParams] {
  const r2: SkillParams = { ...base };
  if (r2.damage !== undefined) r2.damage = base.damage! * RANKS.rank2DamageMult;
  r2.cooldown = base.cooldown! * RANKS.rank2CooldownMult;
  const r3: SkillParams = { ...r2, [rank3.param]: rank3.value };
  return [{ ...base }, r2, r3];
}

function skill(
  def: Omit<SkillDef, 'ranks'> & { base: SkillParams },
): SkillDef {
  const { base, ...rest } = def;
  return { ...rest, ranks: ranks(base, def.rank3Modifier) };
}

export const SKILLS: Record<string, SkillDef> = {
  whirlwind: skill({
    id: 'whirlwind',
    name: 'Вихор',
    classId: 'warrior',
    targeting: 'self',
    icon: 'whirl',
    description: 'Обертання {duration} с: удар кожні {tick} с по всіх у радіусі {radius} на {damage%} атаки.',
    base: { cooldown: 8, duration: 1.5, tick: 0.25, damage: 0.6, radius: 90, castRange: 150, pull: 0 },
    rank3Modifier: { text: 'Притягує ворогів до центру.', param: 'pull', value: 240 },
  }),
  charge: skill({
    id: 'charge',
    name: 'Ривок',
    classId: 'warrior',
    targeting: 'densest',
    aimable: true,
    icon: 'dash',
    description: 'Стрибок до курсора (до {range} px): {damage%} атаки й оглушення {stun} с усім на шляху і в точці приземлення. Невразливість під час стрибка.',
    base: {
      cooldown: 7,
      range: 300,
      damage: 1.5,
      radius: 70,
      /** Width of the damaging path, px. */
      pathWidth: 56,
      stun: 1,
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
    rank3Modifier: { text: 'Залишає вогняний слід на 2 с.', param: 'trail', value: 1 },
  }),
  battleCry: skill({
    id: 'battleCry',
    name: 'Бойовий клич',
    classId: 'warrior',
    targeting: 'any',
    icon: 'shout',
    description: '+{attackSpeed%} швидкості атаки на {duration} с; вороги в радіусі {tauntRadius} атакують героя.',
    base: { cooldown: 14, duration: 5, attackSpeed: 0.4, tauntRadius: 200, damageReduction: 0 },
    rank3Modifier: { text: '−20% отриманої шкоди на час дії.', param: 'damageReduction', value: 0.2 },
  }),
  groundSlam: skill({
    id: 'groundSlam',
    name: 'Удар об землю',
    classId: 'warrior',
    targeting: 'cone',
    aimable: true,
    icon: 'slam',
    description: 'Конус {angle}° на {range} px: {damage%} атаки і відкидання.',
    base: { cooldown: 9, angle: 90, range: 220, damage: 2, knockback: 420, stun: 0 },
    rank3Modifier: { text: 'Оглушує на 0.8 с.', param: 'stun', value: 0.8 },
  }),
};

export interface PassiveDef {
  id: string;
  name: string;
  classId: string;
  branch?: string;
  maxStacks: number;
  /** {value} placeholder = per-stack value. */
  description: string;
  stat: 'armor' | 'lifesteal' | 'thorns' | 'critChance' | 'attackSpeedPct' | 'hpPct' | 'skillDamagePct' | 'cooldownPct';
  /** Per stack. */
  value: number;
  /** How to print the value: plain number or percent. */
  format: 'flat' | 'percent';
}

export const PASSIVES: Record<string, PassiveDef> = {
  armor: {
    id: 'armor',
    name: 'Броня',
    classId: 'warrior',
    maxStacks: 5,
    description: '+{value} броні.',
    stat: 'armor',
    value: 6,
    format: 'flat',
  },
  vampirism: {
    id: 'vampirism',
    name: 'Вампіризм',
    classId: 'warrior',
    maxStacks: 5,
    description: 'Лікує {value} від завданої шкоди.',
    stat: 'lifesteal',
    value: 0.03,
    format: 'percent',
  },
  thorns: {
    id: 'thorns',
    name: 'Шипи',
    classId: 'warrior',
    maxStacks: 5,
    description: 'Повертає {value} отриманої шкоди ближньої атаки.',
    stat: 'thorns',
    value: 0.2,
    format: 'percent',
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

/** Params for a rank (1..3). */
export function skillParams(id: string, rank: number): SkillParams {
  const def = getSkill(id);
  const idx = Math.max(1, Math.min(3, rank)) - 1;
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

export function describePassive(id: string): string {
  const p = getPassive(id);
  const v = p.format === 'percent' ? `${Math.round(p.value * 100)}%` : String(p.value);
  return p.description.replace('{value}', v);
}
