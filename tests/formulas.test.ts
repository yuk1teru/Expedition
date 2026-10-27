import { HERO, LEVELS } from '../src/data/balance';
import { INVASION } from '../src/data/invasion';
import { pointsUpTo } from '../src/systems/talents';
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { GOLD, PROGRESSION, SCALING } from '../src/data/balance';
import { rollCrit } from '../src/systems/combat';
import { gainXp } from '../src/systems/leveling';
import { createGameState } from '../src/systems/run';
import {
  applyArmor,
  invasionMultiplier,
  invasionPct,
  newInvasionThresholds,
  threatMultiplier,
  levelTier,
  xpPenalized,
  enemyStats,
  goldReward,
  clearBonusGold,
  xpReward,
  xpToNext,
} from '../src/systems/scaling';

describe('armor', () => {
  it('reduces damage by k / (k + armor)', () => {
    const k = SCALING.armorK;
    expect(applyArmor(100, 0)).toBe(100);
    expect(applyArmor(100, k)).toBeCloseTo(50);
    expect(applyArmor(30, 50)).toBeCloseTo((30 * k) / (k + 50));
    // Soft armor: 50 armor cuts no more than a quarter.
    expect(applyArmor(100, 50)).toBeGreaterThan(75);
  });
});

describe('crits', () => {
  it('are deterministic for a fixed seed and roughly match the chance', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    const ra = Array.from({ length: 200 }, () => rollCrit(a, 10, 0.25, 1.5));
    const rb = Array.from({ length: 200 }, () => rollCrit(b, 10, 0.25, 1.5));
    expect(ra).toEqual(rb);
    const crits = ra.filter((r) => r.crit);
    expect(crits.every((r) => r.amount === 15)).toBe(true);
    expect(ra.filter((r) => !r.crit).every((r) => r.amount === 10)).toBe(true);
    expect(crits.length / ra.length).toBeGreaterThan(0.15);
    expect(crits.length / ra.length).toBeLessThan(0.35);
  });

  it('never crits at 0% and always at 100%', () => {
    const r = new Rng(1);
    for (let i = 0; i < 100; i++) {
      expect(rollCrit(r, 10, 0, 2).crit).toBe(false);
      expect(rollCrit(r, 10, 1, 2).amount).toBe(20);
    }
  });
});

describe('enemy scaling', () => {
  it('base × (1 + 0.45 × (tier − 1)) × invasion multiplier', () => {
    expect(enemyStats({ hp: 100, damage: 10 }, 1)).toEqual({ hp: 100, damage: 10 });
    const t3 = enemyStats({ hp: 100, damage: 10 }, 3);
    expect(t3.hp).toBeCloseTo(100 * (1 + SCALING.perTier * 2));
    expect(t3.damage).toBeCloseTo(10 * (1 + SCALING.perTier * 2));
    const withInvasion = enemyStats({ hp: 100, damage: 10 }, 2, 1.2);
    expect(withInvasion.hp).toBeCloseTo(145 * 1.2);
  });

  it('the invasion grows with the days up to 100% and makes enemies stronger in proportion', () => {
    expect(invasionPct(1)).toBe(0);
    expect(invasionMultiplier(1)).toBe(1);
    for (let d = 1; d < 400; d++) expect(invasionPct(d + 1)).toBeGreaterThanOrEqual(invasionPct(d));
    expect(invasionPct(10_000)).toBe(100);
    expect(invasionMultiplier(10_000)).toBeCloseTo(1 + INVASION.strengthAt100);
  });

  it('gold rewards scale with tier', () => {
    expect(goldReward(1)).toBeCloseTo(GOLD.perEnemyPerTier);
    expect(goldReward(2.5, 10)).toBeCloseTo(GOLD.perEnemyPerTier * 2.5 * (1 + GOLD.perWave * 10));
    expect(clearBonusGold(2)).toBe(20);
  });
});

describe('xp', () => {
  it('curve is round(base × (level + offset)^exponent) and grows', () => {
    const c = PROGRESSION.xpCurve;
    expect(xpToNext(1)).toBe(Math.round(c.base * Math.pow(1 + c.offset, c.exponent)));
    expect(xpToNext(9)).toBe(Math.round(c.base * Math.pow(9 + c.offset, c.exponent)));
    for (let l = 1; l < PROGRESSION.maxLevel; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('penalty: only a share of XP when the hero is far above the location level', () => {
    const gap = PROGRESSION.xpPenalty.levelGap;
    expect(xpReward(8, 5, 5 + gap)).toBe(8);
    expect(xpReward(8, 5, 5 + gap + 1)).toBe(Math.max(1, Math.round(8 * PROGRESSION.xpPenalty.mult)));
  });

  it('a location level stands for strength: LEVELS.base is strength 1, +1 every perTier levels', () => {
    expect(levelTier(LEVELS.base)).toBe(1);
    expect(levelTier(LEVELS.base + LEVELS.perTier)).toBe(2);
  });

  it('gainXp levels up several times, queues choices and respects the cap', () => {
    const s = createGameState(3);
    const to = (lv: number): number => Array.from({ length: lv - 1 }, (_, i) => xpToNext(i + 1)).reduce((a, x) => a + x, 0);
    gainXp(s, to(10));
    expect(s.hero.level).toBe(10);
    // The class choice; the rest of the levels give talent points (no cards any more).
    expect(s.modalQueue).toEqual([{ kind: 'classChoice' }]);
    expect(s.talentPoints).toBe(pointsUpTo(10));
    gainXp(s, 1e9);
    expect(s.hero.level).toBe(PROGRESSION.maxLevel);
    expect(s.hero.xp).toBe(0);
  });

  it('every level adds the per-level HP (whole points) and attack', () => {
    const s = createGameState(3);
    const hp = s.hero.maxHp;
    const atk = s.hero.stats.attack;
    gainXp(s, xpToNext(1) + xpToNext(2));
    expect(s.hero.maxHp).toBe(Math.round(hp + 2 * HERO.perLevel.hp));
    expect(Number.isInteger(s.hero.maxHp)).toBe(true);
    expect(s.hero.stats.attack).toBeCloseTo(atk + 2 * HERO.perLevel.attack);
  });
});

describe('invasion', () => {
  it('enemies of a run follow the invasion; each threshold is announced once', () => {
    const s = createGameState(3);
    s.day = 1 + Math.ceil(26 / INVASION.perDay);
    expect(threatMultiplier(s)).toBeCloseTo(invasionMultiplier(s.day));
    expect(threatMultiplier({ day: s.day, noInvasion: true })).toBe(1);
    expect(newInvasionThresholds(s).map((t) => t.at)).toEqual([25]);
    expect(newInvasionThresholds(s)).toEqual([]);
    s.day = 10_000;
    expect(newInvasionThresholds(s).map((t) => t.at)).toEqual([50, 75, 100]);
    expect(xpPenalized(5, 5 + PROGRESSION.xpPenalty.levelGap + 1)).toBe(true);
    expect(xpPenalized(5, 5 + PROGRESSION.xpPenalty.levelGap)).toBe(false);
  });
});
