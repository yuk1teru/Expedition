// Entity types shared by combat, AI, skills, bosses and render.

import type { ConsumableId } from '../data/consumables';
import type { ItemSlot } from '../data/items';
import type { Item } from './items';

export interface Vec {
  x: number;
  y: number;
}

export type Team = 'hero' | 'enemy';

/** `root`: no movement (hero only); `vuln`: takes +value damage (enemies). */
export type StatusId = 'stun' | 'slow' | 'freeze' | 'burn' | 'taunt' | 'root' | 'vuln';

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
  /** Carried consumables (magnifiers, healing herbs). */
  consumables: Record<ConsumableId, number>;
  /** Seconds until the herb (G) can be used again. */
  herbCooldown: number;
  /** Buffs earned outside battle (e.g. a skipped card), applied when the next battle starts. */
  pendingBuffs: HeroBuff[];
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
  /** Straight dash in progress. */
  dash: { to: Vec; speed: number } | null;
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
