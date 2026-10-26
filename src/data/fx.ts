// "Juice" tuning: flashes, floating numbers, particles, screen shake, hit-stop.

export interface ShakeSpec {
  /** Amplitude, logical px. */
  strength: number;
  /** Seconds. */
  duration: number;
}

export const FX = {
  hitFlash: 0.08,
  spawnGrow: 0.2,
  damageText: {
    life: 0.8,
    rise: 46,
    size: 15,
    critSize: 22,
    color: '#ffffff',
    critColor: '#ffd23f',
    heroColor: '#ff6b5e',
    healColor: '#6fd16f',
    goldColor: '#f2c14e',
    goldSize: 12,
    /** Gold pop-ups start this far above the kill, px. */
    goldOffset: 22,
    /** Hero damage numbers drift sideways so they don't cover the hero, px. */
    heroSideOffset: 26,
    /** Other numbers are pushed out of this radius around the hero, px. */
    heroClearance: 34,
    jitter: 10,
  },
  particles: {
    hit: { count: 4, speed: 110, life: 0.3, size: 2.5 },
    crit: { count: 9, speed: 170, life: 0.4, size: 3 },
    death: { count: 14, speed: 160, life: 0.55, size: 4 },
    eliteDeath: { count: 30, speed: 220, life: 0.7, size: 5 },
    spawn: { count: 8, speed: 60, life: 0.4, size: 3 },
    heroHurt: { count: 5, speed: 120, life: 0.3, size: 2.5 },
    whirl: { count: 6, speed: 220, life: 0.35, size: 3 },
    slam: { count: 26, speed: 260, life: 0.5, size: 4 },
    charge: { count: 18, speed: 200, life: 0.45, size: 3.5 },
    telegraph: { count: 16, speed: 180, life: 0.5, size: 4 },
    levelUp: { count: 24, speed: 140, life: 0.8, size: 3 },
    battleCry: { count: 20, speed: 160, life: 0.5, size: 3 },
    trail: { count: 2, speed: 40, life: 0.4, size: 3 },
  },
  shake: {
    whirlwind: { strength: 2.5, duration: 0.12 },
    charge: { strength: 6, duration: 0.2 },
    groundSlam: { strength: 8, duration: 0.25 },
    heroHurtBig: { strength: 3, duration: 0.12 },
    telegraph: { strength: 5, duration: 0.2 },
    bossPhase: { strength: 9, duration: 0.4 },
    bossDeath: { strength: 12, duration: 0.6 },
  } satisfies Record<string, ShakeSpec>,
  /** Hero damage ≥ this fraction of max HP shakes the screen. */
  heroHurtBigFraction: 0.08,
  /** Hit-stop in fixed frames. */
  hitStop: { crit: 2, heavy: 3, skill: 3 },
  /** Damage ≥ this fraction of target max HP counts as heavy for hit-stop. */
  heavyHitFraction: 0.5,
  levelUpRing: { life: 0.7, radius: 90 },
  slamCone: { life: 0.3, color: '#f2c14e' },
  battleCryRing: { life: 0.5, color: '#ff7a3c' },
  chargeRing: { life: 0.35, color: '#ffb347' },
  /** Fraction of fire-trail ticks that emit a spark. */
  trailSparkChance: 0.3,
  banner: { life: 1.6, fade: 0.35 },
  noTargetFlash: 0.5,
  /** Shared cap so fights with many effects stay smooth. */
  maxParticles: 600,
} as const;
