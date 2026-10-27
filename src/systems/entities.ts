// Entity types shared by combat, AI, skills, bosses and render.

import type { ConsumableId, HealId } from '../data/consumables';
import type { ItemSlot } from '../data/items';
import type { HitSource } from './gameEvents';
import type { Item } from './items';

export interface Vec {
  x: number;
  y: number;
}

export type Team = 'hero' | 'enemy';

/** `root`: no movement (hero only); `vuln`: takes +value damage (enemies); `poison`: value HP/s (hero). */
export type StatusId = 'stun' | 'slow' | 'freeze' | 'burn' | 'taunt' | 'root' | 'vuln' | 'poison';

export interface StatusEffect {
  /** Seconds remaining. */
  time: number;
  /** Status strength: slow fraction, burn damage per second, etc. */
  value: number;
}

export type Statuses = Partial<Record<StatusId, StatusEffect>>;

export interface Body {
  id: number;
  pos: Vec;
  vel: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  team: Team;
  statuses: Statuses;
  /** Decaying impulse velocity from knockback / pulls. */
  knockback: Vec;
  /** Direction the body faces, radians. */
  facing: number;
  /** Relative weight when bodies push each other apart. */
  mass: number;
  /** Battle time of the last hit received (render uses it for the white flash). */
  hitAt: number;
  /** Battle time of spawn (render uses it for the grow-in animation). */
  spawnedAt: number;
  dead: boolean;
}

export type Archetype = 'chaser' | 'shooter' | 'tank' | 'fast';

export interface HeroSkill {
  id: string;
  rank: number;
  /** Skill bar slot, 0-based (slots may have gaps). */
  slot: number;
  /** Seconds until ready. */
  cooldown: number;
}

export interface HeroBuff {
  id: string;
  time: number;
  attackSpeedMult: number;
  damageTakenMult: number;
  /** Optional: outgoing damage, move speed multipliers and extra HP/s. */
  damageMult?: number;
  moveSpeedMult?: number;
  regen?: number;
  /** Immune to slows, roots and stuns while active. */
  ccImmune?: boolean;
  /** Damage this buff still absorbs (a barrier); the buff ends when it is used up. */
  shield?: number;
  /** Burst around the hero when the shield breaks. */
  breakBlast?: Blast;
  /** While the shield holds, melee attackers freeze for this long. */
  freezeAttackers?: number;
  /** Extra enemies the hero's basic projectiles pass through. */
  pierceBonus?: number;
  /** Extra lifesteal while active (Rage). */
  lifesteal?: number;
}

/**
 * A burst of damage and effects around a point (exploding projectiles, traps, the end
 * of a zone, a broken barrier). Damage is absolute (attack and multipliers included).
 */
export interface Blast {
  /** Render key (skill id or effect name). */
  kind: string;
  radius: number;
  damage: number;
  stun?: number;
  knockback?: number;
  slow?: number;
  slowTime?: number;
  /** Burn: damage per second, seconds. */
  burn?: number;
  burnTime?: number;
  /** Takes +vuln damage for vulnTime seconds. */
  vuln?: number;
  vulnTime?: number;
  freeze?: number;
  /** A zone left behind (burning ground, frost field). */
  zone?: { kind: string; radius: number; duration: number; tickInterval: number; damage: number; slow?: number; slowTime?: number; burn?: number; burnTime?: number };
}

export interface HeroStats {
  maxHp: number;
  attack: number;
  /** Attacks per second. */
  attackSpeed: number;
  moveSpeed: number;
  armor: number;
  critChance: number;
  critMult: number;
  /** Fraction of dealt damage healed (basic attacks and skills). */
  lifesteal: number;
  /** HP per second in battle. */
  hpRegen: number;
  /** Fraction of received melee damage reflected. */
  thorns: number;
  /** Basic attack reach (melee) or shooting range (ranged), px. */
  range: number;
  ranged: boolean;
  skillDamageMult: number;
  /** Multiplier applied to skill cooldowns. */
  cooldownMult: number;
  /** Seconds taken off every skill cooldown per kill. */
  killCdr: number;
  /** Extra enemies the basic projectiles pass through (Archer: Piercing). */
  pierce: number;
  /** Damage multiplier of the hero's wolves (Beastmaster). */
  petDamageMult: number;
  /** Class traits: HP/s as a share of max HP that works in a fight too (Warrior)… */
  combatRegenPct: number;
  /** …chance to dodge a melee hit (Archer)… */
  dodgeMelee: number;
  /** …mana pool and HP absorbed per mana point (Mage). */
  manaMax: number;
  manaAbsorb: number;
}

export interface Dash {
  from: Vec;
  to: Vec;
  time: number;
  duration: number;
  /** Called by effects when the dash lands. */
  onArrive: (() => void) | null;
}

export interface Hero extends Body {
  level: number;
  xp: number;
  classId: string | null;
  skills: HeroSkill[];
  /** Passive id → stacks. */
  passives: Record<string, number>;
  stats: HeroStats;
  /** Seconds until next basic attack. */
  attackTimer: number;
  buffs: HeroBuff[];
  dash: Dash | null;
  /** Seconds of invulnerability left. */
  invulnerable: number;
  /** Debug god mode. */
  immortal: boolean;
  /** Worn items by slot. */
  equipment: Partial<Record<ItemSlot, Item>>;
  /** Items found but not worn. */
  bag: Item[];
  /** Carried consumables (magnifiers, herbs, potions). */
  consumables: Record<ConsumableId, number>;
  /** Healing items on the quick slots Z / X / C (null: empty). */
  quickSlots: (HealId | null)[];
  /** Seconds until the next healing item can be used (shared by all). */
  healCooldown: number;
  /** Seconds until the boot dash (Shift) is ready. */
  dodgeCooldown: number;
  /** Buffs earned outside battle (e.g. a skipped card), applied when the next battle starts. */
  pendingBuffs: HeroBuff[];
  /** Branch chosen at the promotion (level 13), null before it. */
  promotion: string | null;
  /** Seconds until the next periodic branch effect (Paladin barrier). */
  promoTimer: number;
  /** Seconds until the Beastmaster's wolf comes back. */
  companionTimer: number;
  /** Mage mana (the mana shield); 0 for other classes. */
  mana: number;
}

/** A body on the hero's side (wolves of the Beastmaster): chases and bites enemies. */
export interface Ally extends Body {
  kind: 'wolf';
  /** Bite damage = hero attack × this (× pet bonus). */
  damageMult: number;
  attackTimer: number;
  /** Seconds left; Infinity for the permanent companion. */
  life: number;
  /** Stun on bite, s. */
  stunOnHit: number;
  /** The permanent companion (respawns), not a summoned pack wolf. */
  companion: boolean;
}

/** A hero skill being channelled (Aimed Shot): fires `onFire` after `delay`. */
export interface HeroCharge {
  kind: string;
  time: number;
  delay: number;
  onFire: () => void;
}

export interface BossRuntime {
  defId: string;
  phase: 1 | 2;
  /** Attack id → seconds until available. */
  attackCooldowns: Record<string, number>;
  /** Seconds until the next attack may start. */
  pause: number;
  /** Timers for periodic abilities (summons etc.). */
  timers: Record<string, number>;
  /** Wind-up: the boss stands still while > 0. */
  busy: number;
  /** Straight dash in progress; ends on arrival or when `timeLeft` runs out (blocked by bodies or walls). */
  dash: { to: Vec; speed: number; timeLeft: number } | null;
  /** Combo attack to run as soon as the current one is over. */
  queued: string | null;
}

export interface Enemy extends Body {
  defId: string;
  name: string;
  archetype: Archetype;
  elite: boolean;
  damage: number;
  speed: number;
  armor: number;
  xp: number;
  /** Gold for the kill (may be fractional; the battle carries fractions over). */
  gold: number;
  attackTimer: number;
  /** Timer for archetype ability (shooter shot, fast dash). */
  abilityTimer: number;
  /** Remaining dash time for `fast` enemies. */
  dashTime: number;
  dashDir: Vec;
  /** Wind-up before a trait move (wolf crouch, stump stomp), s; the enemy stands still. */
  windup: number;
  /** Shots fired (every N-th is a volley). */
  shots: number;
  /** Being yanked (Hook): flies to `to` at `speed`, ignoring its own movement and mass. */
  yank: { to: Vec; speed: number } | null;
  boss: BossRuntime | null;
  summoned: boolean;
  /** 0-based wave index that brought this enemy (summons and splits: none). */
  wave?: number;
}

export interface Projectile {
  id: number;
  pos: Vec;
  vel: Vec;
  radius: number;
  damage: number;
  team: Team;
  /** Seconds remaining. */
  life: number;
  /** How many more targets it can pass through. */
  pierce: number;
  /** How many times it bounces to a new target after its last hit. */
  ricochet: number;
  hit: number[];
  kind: string;
  /** Whether a hit counts as melee for thorns. */
  melee: boolean;
  /** Slows the hero on hit. */
  slow?: { value: number; time: number };
  /** Hero projectiles: damage × this after each enemy passed (falloff < 1, growth > 1). */
  pierceMult?: number;
  /** Explodes on its first hit, or where its flight ends. `excludeHit`: the blast spares the enemy hit directly. */
  explode?: Blast & { excludeHit?: boolean };
  /** Status put on every enemy it hits. */
  onHit?: { id: StatusId; time: number; value: number };
  /** Damage source for events and multipliers (default 'basic'). */
  source?: HitSource;
  /** Steers towards this enemy while it lives (Magic Missiles). */
  homingId?: number;
  /** Enemy globs: leave a puddle where they land or hit (acid, poison). */
  puddle?: { kind: string; radius: number; duration: number; dps: number };
  dead: boolean;
}

/** Area effect that lives for some time and ticks on bodies inside. */
export interface Zone {
  id: number;
  kind: string;
  pos: Vec;
  radius: number;
  team: Team;
  /** If set, zone follows the hero. */
  followHero: boolean;
  time: number;
  duration: number;
  tickInterval: number;
  tickTimer: number;
  /** Damage per tick. */
  damage: number;
  /** Pull strength towards the centre per tick, px/s impulse. */
  pull: number;
  stun: number;
  /** Slow applied per tick (fraction) and its duration. */
  slow: number;
  slowTime: number;
  /** Burn applied per tick: damage per second and seconds. */
  burn: number;
  burnTime: number;
  /** Hero trap: no ticks; fires its finale when an enemy comes within this radius (0: not a trap). */
  trigger: number;
  /** Burst when the zone ends (or its trap fires). */
  finale: Blast | null;
  /** A wall: the zone covers the segment a–b (`radius` = half its thickness) instead of a circle. */
  line: { a: Vec; b: Vec } | null;
  /** Each tick freezes an enemy inside with this chance for `freezeTime` s (Blizzard). */
  freezeChance: number;
  freezeTime: number;
  dead: boolean;
}

export type TelegraphShape = { kind: 'circle'; radius: number } | { kind: 'line'; to: Vec; width: number };

/** Boss attack warning: red area that fills up, then strikes. */
export interface Telegraph {
  id: number;
  kind: string;
  pos: Vec;
  shape: TelegraphShape;
  time: number;
  delay: number;
  damage: number;
  dead: boolean;
  /** Called when the telegraph strikes (e.g. start the boss dash). */
  onFire: (() => void) | null;
  /** The telegraph fizzles if this enemy dies first (null: always strikes). */
  ownerId: number | null;
}

export function vec(x = 0, y = 0): Vec {
  return { x, y };
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Distance from point `p` to segment `a`–`b`. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const k = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
  return Math.hypot(p.x - (a.x + abx * k), p.y - (a.y + aby * k));
}

export function normalize(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-9 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}

export function angleOf(v: Vec): number {
  return Math.atan2(v.y, v.x);
}

export function fromAngle(a: number, len = 1): Vec {
  return { x: Math.cos(a) * len, y: Math.sin(a) * len };
}
