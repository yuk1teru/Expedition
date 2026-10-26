// All balance numbers and tunable constants live here.

/** Logical resolution. */
export const VIEW = {
  width: 960,
  height: 540,
} as const;

export const LOOP = {
  /** Fixed simulation step, s. */
  step: 1 / 60,
  /** Max real time processed per frame, s. */
  maxFrame: 0.25,
} as const;

/** Combat arena in logical pixels (HUD sits above and below). */
export const ARENA = {
  x: 0,
  y: 56,
  w: 960,
  h: 416,
} as const;

export const HERO = {
  hp: 100,
  attack: 10,
  /** Attacks per second. */
  attackSpeed: 1.0,
  moveSpeed: 120,
  armor: 0,
  critChance: 0.05,
  critMult: 1.5,
  radius: 14,
  mass: 3,
  /** Melee reach, px from the hero centre to the target's edge. */
  meleeRange: 40,
  /** Player control: ranged heroes shoot along the aim when an enemy is inside this cone, degrees. */
  rangedAimConeDeg: 50,
  /** Ranged hero AI (Mage, Archer): preferred distance band, retreat and shooting range. */
  ranged: {
    keepMin: 180,
    keepMax: 260,
    retreatBelow: 100,
    /** Speed fraction when drifting back into the band. */
    backpedalMult: 0.6,
    shootRange: 300,
    projectileSpeed: 520,
    projectileRadius: 5,
    /** Extra projectile lifetime beyond range / speed, s. */
    projectileLifePad: 0.2,
  },
  /** Knockback impulse of a basic melee hit, px/s. */
  meleeKnockback: 60,
  /** HP regenerated per second in battle. */
  hpRegen: 1,
  /** Lifesteal heals are summed and shown as one number every this many seconds. */
  healPopupInterval: 0.5,
  /** Growth on every level-up (levels 1–2 are auto-only). */
  perLevel: { hp: 15, attack: 2 },
} as const;

export const PROGRESSION = {
  /** Levels at which only automatic stat growth happens. */
  autoLevelsUpTo: 2,
  classChoiceLevel: 3,
  /** Slice cap; the full prototype goes to 20. */
  maxLevel: 10,
  /** xpToNext(level) = round(base × level^exponent). */
  xpCurve: { base: 20, exponent: 1.6 },
  /** XP drops to `mult` when heroLevel − recommendedLevel > `levelGap`. */
  xpPenalty: { levelGap: 3, mult: 0.25 },
  skillSlots: 4,
} as const;

export const SCALING = {
  /** Enemy HP/damage multiplier per tier above 1. */
  perTier: 0.45,
  /** Recommended level = round(tier × recommendedLevelPerTier). */
  recommendedLevelPerTier: 3,
  /** Day threat: +perStep every `everyDays`. Disabled in the slice. */
  dayThreat: { enabled: false, everyDays: 5, perStep: 0.1 },
  /** Armor formula: damage × k / (k + armor). 200: 50 armor → −20%, 100 armor → −33%. */
  armorK: 200,
  /** Enemy XP grows with tier like HP. */
  xpPerTier: 0.45,
} as const;

export const WAVES = {
  /** Mandatory waves; the portal opens after them. */
  count: 3,
  /** Wave size = min(baseSize + perTier × floor(tier), maxSize) (+ bonus extra). */
  baseSize: 10,
  perTier: 3,
  maxSize: 24,
  groupSize: 4,
  /** Seconds between spawn groups. */
  groupInterval: 0.5,
  /** Seconds between waves. */
  pauseBetween: 1.5,
  /** 1-based wave index that contains the elite. */
  eliteWave: 3,
  /** 1-based wave index where the location miniboss appears. */
  minibossWave: 3,
  /** Bonus waves after the portal opens, while the hero stays. */
  bonus: {
    /** Break before each bonus wave, s; the portal is usable only during it. */
    delay: 10,
    /** Extra enemies per bonus level. */
    extraPerWave: 3,
    /** HP, damage, XP and gold +8% per bonus level. */
    statPerWave: 0.08,
  },
  portal: {
    radius: 26,
    /** Portal spawns at least this far from the hero if possible, px. */
    minDistFromHero: 260,
    candidates: 24,
    /** Distance from the arena edge, px. */
    edgeInset: 34,
    /** The "Увійти" button appears within this gap between hero and portal, px. */
    useRange: 40,
  },
  /** Spawn margin outside/inside arena edge, px. */
  spawnInset: 24,
  /** Spread of a group around its spawn point, px. */
  groupSpread: 40,
} as const;

export const GOLD = {
  perEnemyPerTier: 2,
  clearBonusPerTier: 10,
} as const;

export const ENEMY_COMMON = {
  /** Extra reach beyond touching for melee enemies, px. */
  meleeReach: 6,
  projectileRadius: 6,
  /** Shooters drift only when outside keepDistance ± band, px. */
  shooterBand: 20,
  projectileLife: 3,
  /** Knockback decay per second (fraction kept is exp(-decay × dt)). */
  knockbackDecay: 7,
  /** Fresh enemies wait this fraction of their attack interval before the first attack. */
  firstAttackDelay: 0.5,
} as const;

export const ELITE = {
  hpMult: 2.5,
  damageMult: 1.5,
  radiusMult: 1.4,
  xpMult: 4,
  goldMult: 4,
} as const;

/** Slice-only world rules. */
export const SLICE = {
  grove: { baseTier: 1, tierPerClear: 0.5, maxTier: 3 },
  bossTier: 2.5,
  /** Map layout, logical px. */
  layout: {
    town: { x: 480, y: 360 },
    grove: { x: 300, y: 220 },
    lair: { x: 660, y: 150 },
  },
} as const;

/** Battle flow timings. */
export const FLOW = {
  /** Delay after stepping into the portal before the reward screen. */
  portalDelay: 0.6,
  /** Delay after hero death before the death screen. */
  loseDelay: 1.2,
  /** Longer pause to enjoy the boss falling. */
  bossWinDelay: 2.2,
} as const;

/** General skill rank rule. */
export const RANKS = {
  max: 3,
  rank2DamageMult: 1.3,
  rank2CooldownMult: 0.9,
} as const;

/** Level-up card offers. */
export const CARDS = {
  offerSize: 3,
  weights: { newSkill: 40, upgrade: 40, passive: 20 },
} as const;

export const PROJECTILES = {
  /** Max distance to the next target for ricocheting projectiles, px. */
  ricochetRange: 220,
} as const;

/** Balance simulation defaults (scripts/sim.ts). */
export const SIM = {
  runs: 200,
  grovePasses: 6,
  baseSeed: 1,
  /** A battle longer than this counts as lost, s. */
  maxBattleTime: 400,
} as const;
