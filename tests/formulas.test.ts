import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { GOLD, PROGRESSION, SCALING } from '../src/data/balance';
import { rollCrit } from '../src/systems/combat';
import { gainXp } from '../src/systems/leveling';
import { createGameState } from '../src/systems/run';
import {
  applyArmor,
  dayMultiplier,
  daysToNextThreat,
  threatMultiplier,
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
  it('base × (1 + 0.45 × (tier − 1)) × day multiplier', () => {
    expect(enemyStats({ hp: 100, damage: 10 }, 1)).toEqual({ hp: 100, damage: 10 });
    const t3 = enemyStats({ hp: 100, damage: 10 }, 3);
    expect(t3.hp).toBeCloseTo(100 * (1 + SCALING.perTier * 2));
    expect(t3.damage).toBeCloseTo(10 * (1 + SCALING.perTier * 2));
    const withDays = enemyStats({ hp: 100, damage: 10 }, 2, 1.2);
    expect(withDays.hp).toBeCloseTo(145 * 1.2);
  });

  it('day multiplier grows by 10% every 5 days when enabled', () => {
    expect(dayMultiplier(4, true)).toBe(1);
    expect(dayMultiplier(5, true)).toBeCloseTo(1.1);
    expect(dayMultiplier(12, true)).toBeCloseTo(1.2);
    expect(dayMultiplier(50, false)).toBe(1);
  });

  it('gold rewards scale with tier', () => {
    expect(goldReward(1)).toBeCloseTo(GOLD.perEnemyPerTier);
    expect(goldReward(2.5, 10)).toBeCloseTo(GOLD.perEnemyPerTier * 2.5 * (1 + GOLD.perWave * 10));
    expect(clearBonusGold(2)).toBe(20);
  });
});

describe('xp', () => {
  it('curve is round(20 × level^1.6)', () => {
    expect(xpToNext(1)).toBe(20);
    expect(xpToNext(2)).toBe(Math.round(20 * Math.pow(2, 1.6)));
    expect(xpToNext(9)).toBe(Math.round(20 * Math.pow(9, 1.6)));
    for (let l = 1; l < 20; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('penalty: only 25% when the hero is more than 3 levels above the recommended level', () => {
    // tier 1 → recommended level 3.
    expect(xpReward(8, 1, 6)).toBe(8);
    expect(xpReward(8, 1, 7)).toBe(2);
  });

  it('gainXp levels up several times, queues choices and respects the cap', () => {
    const s = createGameState(3, 'slice');
    gainXp(s, xpToNext(1) + xpToNext(2) + xpToNext(3));
    expect(s.hero.level).toBe(4);
    expect(s.modalQueue).toEqual([{ kind: 'classChoice' }, { kind: 'cardChoice', level: 4 }]);
    gainXp(s, 1e9);
    expect(s.hero.level).toBe(PROGRESSION.maxLevel);
    expect(s.hero.xp).toBe(0);
  });

  it('every level adds +15 HP and +2 attack', () => {
    const s = createGameState(3, 'slice');
    const hp = s.hero.maxHp;
    const atk = s.hero.stats.attack;
    gainXp(s, xpToNext(1));
    expect(s.hero.maxHp).toBe(hp + 15);
    expect(s.hero.stats.attack).toBe(atk + 2);
  });
});

describe('day threat (full world)', () => {
  it('enemies grow +10% every 5 days in the full world only; the map counts the days left', () => {
    const full = createGameState(3);
    const slice = createGameState(3, 'slice');
    full.day = slice.day = 12;
    expect(threatMultiplier(full)).toBeCloseTo(1.2);
    expect(threatMultiplier(slice)).toBe(1);
    expect(daysToNextThreat(12)).toBe(3);
    expect(daysToNextThreat(14)).toBe(1);
    expect(xpPenalized(1, 8)).toBe(true);
    expect(xpPenalized(1, 6)).toBe(false);
  });
});
