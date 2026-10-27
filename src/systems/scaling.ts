// Scaling formulas: enemy stats by tier/day, XP and gold rewards, XP curve.

import { GOLD, LEVELS, PROGRESSION, SCALING } from '../data/balance';

/** Strength of a monster level (the formulas' tier): 1 at LEVELS.base, +1 every LEVELS.perTier levels. */
export function levelTier(level: number): number {
  return 1 + (level - LEVELS.base) / LEVELS.perTier;
}

export function tierMultiplier(tier: number): number {
  return 1 + SCALING.perTier * (tier - 1);
}

export function dayMultiplier(day: number, enabled: boolean = SCALING.dayThreat.enabled): number {
  if (!enabled) return 1;
  const t = SCALING.dayThreat;
  return 1 + t.perStep * Math.floor(day / t.everyDays);
}

/** Day threat of a run: only in the full world. */
export function threatMultiplier(state: { day: number }): number {
  return dayMultiplier(state.day, SCALING.dayThreat.enabled);
}

/** Days left until enemies grow stronger again (1..everyDays). */
export function daysToNextThreat(day: number): number {
  const n = SCALING.dayThreat.everyDays;
  return n - (day % n);
}

/** Whether the hero gets only part of the XP at a location of this monster level. */
export function xpPenalized(level: number, heroLevel: number): boolean {
  return heroLevel - level > PROGRESSION.xpPenalty.levelGap;
}

export interface ScaledStats {
  hp: number;
  damage: number;
}

/** HP and damage = base × (1 + 0.45 × (tier − 1)) × day multiplier. */
export function enemyStats(base: ScaledStats, tier: number, dayMult: number = 1): ScaledStats {
  const m = tierMultiplier(tier) * dayMult;
  return { hp: base.hp * m, damage: base.damage * m };
}

/** XP for a kill at a location of this monster level; reduced when the hero outlevels it. */
export function xpReward(baseXp: number, level: number, heroLevel: number): number {
  const scaled = baseXp * (1 + SCALING.xpPerTier * (levelTier(level) - 1));
  const mult = xpPenalized(level, heroLevel) ? PROGRESSION.xpPenalty.mult : 1;
  return Math.max(1, Math.round(scaled * mult));
}

/** Gold for a regular kill (fractional; the battle carries fractions over). */
export function goldReward(tier: number, waveIndex = 0): number {
  return GOLD.perEnemyPerTier * tier * waveGoldMult(waveIndex);
}

/** Gold grows linearly with the wave (XP grows faster). */
export function waveGoldMult(waveIndex: number): number {
  return 1 + GOLD.perWave * Math.max(0, waveIndex);
}

export function clearBonusGold(tier: number): number {
  return Math.round(GOLD.clearBonusPerTier * tier);
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const c = PROGRESSION.xpCurve;
  return Math.round(c.base * Math.pow(level + c.offset, c.exponent));
}

/** Damage after armor: dmg × k / (k + armor). */
export function applyArmor(damage: number, armor: number): number {
  return (damage * SCALING.armorK) / (SCALING.armorK + Math.max(0, armor));
}
