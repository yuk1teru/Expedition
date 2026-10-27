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
  /** Melee reach, px from the hero's edge to the target's edge (the drawn attack wedge). */
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
    /** Within this distance of the arena edge the bot slides along the wall instead of backing into it, px. */
    wallSlide: 50,
    shootRange: 300,
    projectileSpeed: 520,
    projectileRadius: 5,
    /** Extra projectile lifetime beyond range / speed, s. */
    projectileLifePad: 0.2,
  },
  /** Knockback impulse of a basic melee hit, px/s. */
  meleeKnockback: 60,
  /** HP regenerated per second in battle… */
  hpRegen: 2,
  /** …but only after this many seconds without taking damage: regen heals between fights, never out-tanks a fight. */
  regenDelay: 1.5,
  /** Lifesteal heals are summed and shown as one number every this many seconds. */
  healPopupInterval: 0.5,
  /** Growth on every level-up (levels 1–2 are auto-only). */
  perLevel: { hp: 15, attack: 2 },
} as const;

export const PROGRESSION = {
  /** Levels at which only automatic stat growth happens. */
  autoLevelsUpTo: 2,
  classChoiceLevel: 3,
  /** Skills chosen from the class pool at the class choice (the rest come from cards). */
  startingSkillPicks: 3,
  /** Level of the class promotion (two branches; a signature skill on its own slot). */
  promotionLevel: 13,
  maxLevel: 20,
  /** xpToNext(level) = round(base × level^exponent). */
  xpCurve: { base: 20, exponent: 1.6 },
  /** XP drops to `mult` when heroLevel − recommendedLevel > `levelGap`. */
  xpPenalty: { levelGap: 3, mult: 0.25 },
  skillSlots: 4,
  /** Skill-bar index of the promotion signature skill (key R), after the class slots. */
  signatureSlot: 4,
  /** Branch cards (signature upgrades, branch passives) are this many times likelier after the promotion. */
  branchCardWeight: 2,
} as const;

export const SCALING = {
  /** Enemy HP/damage multiplier per tier above 1. */
  perTier: 0.45,
  /** Recommended level = round(tier × recommendedLevelPerTier). */
  recommendedLevelPerTier: 3,
  /** Day threat: enemies and bosses +perStep HP and damage every `everyDays`. */
  dayThreat: { enabled: true, everyDays: 5, perStep: 0.1 },
  /** Armor formula: damage × k / (k + armor). 200: 50 armor → −20%, 100 armor → −33%. */
  armorK: 200,
  /** Enemy XP grows with tier like HP. */
  xpPerTier: 0.45,
} as const;

export const WAVES = {
  /** Waves before the first portal (and before short breaks end). */
  count: 3,
  /**
   * Wave size = min(baseSize + perTier × floor(tier), maxSize) + extraPerWave × (waves past the
   * first portal), never more than `cap` (a bigger crowd is just mush; waves grow in strength instead).
   */
  baseSize: 10,
  perTier: 3,
  maxSize: 24,
  extraPerWave: 1,
  cap: 28,
  /**
   * Growth of wave i (0-based): 1 + a·i + b·i², separately for HP, damage and rewards (XP, gold).
   * HP grows steeply (late waves are long fights), damage almost linearly (no sudden one-shots):
   * damage — wave 5 ×1.8, wave 10 ×3.6, wave 13 ×5.2, wave 20 ×9.9.
   * Tuned above what the bot survives: a live player dodges and kites far better.
   */
  growth: {
    hp: { a: 0.07, b: 0.03 },
    damage: { a: 0.13, b: 0.018 },
    reward: { a: 0.05, b: 0.025 },
    /** Enemy speed: +speedPerWave per wave, at most ×speedMax. */
    speedPerWave: 0.025,
    speedMax: 1.5,
  },
  /** Share of the HP growth per archetype: fast and ranged enemies stay fragile, tanks get tankier. */
  hpGrowthShare: { chaser: 0.85, fast: 0.6, shooter: 0.6, tank: 1.15 },
  groupSize: 4,
  /** Seconds between spawn groups. */
  groupInterval: 0.5,
  /**
   * Waves overlap: the next wave comes to help once at most this share of the current
   * wave is still alive — unless a miniboss lives, and never across a portal break
   * (after every 3rd wave the field is cleared completely).
   */
  overlapAt: 0.4,
  /** The break after every 3rd wave, with the portal open, s (other waves overlap: no break). */
  breaks: { portal: 15 },
  /** The portal opens after every N-th wave. */
  portalEvery: 3,
  /** A (scaled) miniboss comes with every N-th wave. */
  minibossEvery: 3,
  /** 1-based wave index from which every wave has an elite. */
  eliteWave: 3,
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

/**
 * Every N-th wave brings an event: bad weather or an elemental, in turn
 * (wave 5 — weather, 10 — elemental, 15 — weather…). Weather lives in src/data/weather.ts.
 */
export const WAVE_EVENTS = {
  every: 5,
  order: ['weather', 'elemental'] as const,
  /** Boss-system id of the elemental (src/data/bosses.ts). */
  elemental: 'galeSpirit',
} as const;

/**
 * Traps against kiting: from `fromWave` on, every wave adds snares to the arena.
 * Stepping into one roots the hero (no movement, no Charge) and hurts.
 */
export const TRAPS = {
  /** 1-based wave from which traps appear. */
  fromWave: 4,
  /** New traps per wave: base + perWave × (wave − fromWave), rounded down. */
  base: 2,
  perWave: 0.5,
  /** Never more than this many on the arena. */
  max: 7,
  radius: 13,
  /** Seconds after appearing before a trap is armed (it fades in). */
  armTime: 1.2,
  root: 1.1,
  /** Damage × the wave damage multiplier × tier multiplier. */
  damage: 4,
  /** Not closer than this to the hero when placed, px; distance from the arena edge, px. */
  minDistFromHero: 110,
  inset: 50,
  placementTries: 16,
} as const;

/** Debuffs enemies put on the hero. */
export const HERO_DEBUFFS = {
  /** Slows never stack beyond this. */
  maxSlow: 0.6,
} as const;

/**
 * Gold is scarce on purpose: herbs and magnifiers must stay a choice, and farming
 * the first location must not pay. Per kill: perEnemyPerTier × tier × (1 + perWave × wave index),
 * fractions are carried over between kills. Grows linearly, unlike XP.
 */
export const GOLD = {
  perEnemyPerTier: 0.4,
  perWave: 0.06,
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
  goldMult: 3,
} as const;

/** The world (towns, locations, roads, terrain) lives in src/data/world.ts; here — its global rules. */
export const WORLD = {
  /**
   * Boss threat: every defeated boss adds this much tier to the locations and bosses left,
   * so the locations of the next biome are not a walk (HP, damage, XP, gold and item
   * level follow the tier).
   */
  bossThreat: { locationTier: 1, bossTier: 0.9 },
} as const;

/** Lives of a hero (ROADMAP 9.4): a death takes one; with none left the hero's story ends at the cemetery. */
export const LIVES = {
  start: 3,
  /** More only from quests and rare finds (Elixir of return, Amulet of life). */
  max: 5,
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

/** Skill ranks: every skill lists its upgrades in src/data/skills.ts. */
export const RANKS = {
  max: 5,
} as const;

/** Level-up card offers. */
export const CARDS = {
  offerSize: 3,
  /** Cards (and the class choice) ignore input for this long after appearing, s: no accidental picks while pressing skill keys. */
  inputDelay: 1.5,
  weights: { newSkill: 40, upgrade: 40, passive: 20 },
  /** Reroll price: base + step × rerolls already made for this level-up. */
  reroll: { base: 20, step: 15 },
  /** Skipping the choice: gold (base + perLevel × level) and a short buff. */
  skip: {
    goldBase: 5,
    goldPerLevel: 1,
    buff: { duration: 12, regen: 5, damageMult: 1.2, moveSpeedMult: 1.2 },
  },
} as const;

export const PROJECTILES = {
  /** Max distance to the next target for ricocheting projectiles, px. */
  ricochetRange: 220,
} as const;

/** Balance simulation defaults (scripts/sim.ts). */
export const SIM = {
  runs: 200,
  baseSeed: 1,
  /** A battle longer than this counts as lost, s. */
  maxBattleTime: 400,
  /** The bot uses its strongest healing item below this HP fraction. */
  botHerbBelow: 0.4,
  /** Full-run bot: takes on a boss once its level ≥ the boss's recommended level − this. */
  botBossLevelSlack: 1,
  /** Full-run bot: goes back to town (rest, shop) below this HP fraction after a battle. */
  botTownBelow: 0.4,
  /** Full runs: deaths return to the checkpoint like for the player; one more than this ends the run. */
  maxDeaths: 2,
  /** Full-run safety caps: a run past them counts as stuck. */
  maxBattles: 160,
  maxDays: 200,
} as const;

/** Town scenes (PLAN.md 8.4): walking around and talking to NPCs. */
export const TOWN_SCENE = {
  heroSpeed: 180,
  heroRadius: 13,
  npcRadius: 14,
  /** Distance (between edges) at which E / a click starts a conversation. */
  talkRange: 36,
  /** The town view starts below the top bar (screen y, px); the town map scrolls under it. */
  viewTop: 44,
} as const;
