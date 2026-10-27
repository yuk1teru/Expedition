// Scaling formulas: enemy stats by level and the invasion, XP and gold rewards, XP curve.

import { GOLD, LEVELS, PROGRESSION, SCALING } from '../data/balance';
import { INVASION } from '../data/invasion';

/** Strength of a monster level (the formulas' tier): 1 at LEVELS.base, +1 every LEVELS.perTier levels. */
export function levelTier(level: number): number {
  return 1 + (level - LEVELS.base) / LEVELS.perTier;
}

export function tierMultiplier(tier: number): number {
  return 1 + SCALING.perTier * (tier - 1);
}

/** The invasion scale on this day, 0–100% (ROADMAP 10.3). */
export function invasionPct(day: number): number {
  return Math.min(100, Math.max(0, (day - 1) * INVASION.perDay));
}

/** Enemy HP and damage from the invasion: ×1 at 0%, × (1 + strengthAt100) at 100%. */
export function invasionMultiplier(day: number): number {
  return 1 + (invasionPct(day) / 100) * INVASION.strengthAt100;
}

/** The invasion's strength of a run's enemies (none with the debug switch). */
export function threatMultiplier(state: { day: number; noInvasion?: boolean }): number {
  return state.noInvasion ? 1 : invasionMultiplier(state.day);
}

/** Whether the hero gets only part of the XP at a location of this monster level. */
export function xpPenalized(level: number, heroLevel: number): boolean {
  return heroLevel - level > PROGRESSION.xpPenalty.levelGap;
}

export interface ScaledStats {
  hp: number;
  damage: number;
}

/** HP and damage = base × (1 + 0.45 × (tier − 1)) × the invasion multiplier. */
export function enemyStats(base: ScaledStats, tier: number, invasionMult: number = 1): ScaledStats {
  const m = tierMultiplier(tier) * invasionMult;
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

/** Invasion thresholds reached but not announced yet (marks them announced). */
export function newInvasionThresholds(state: { day: number; invasionSeen: number }): (typeof INVASION.thresholds)[number][] {
  const pct = invasionPct(state.day);
  const fresh = INVASION.thresholds.filter((t) => t.at <= pct && t.at > state.invasionSeen);
  if (fresh.length > 0) state.invasionSeen = Math.max(...fresh.map((t) => t.at));
  return fresh;
}
