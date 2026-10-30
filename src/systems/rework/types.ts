// State of the rework's location run (ROADMAP 20.1–20.13): the hero, the beasts, what flies,
// what lies on the ground, the level-up choice, the spirit's fog, the task, the boss and its
// living ring. Plain data — the steps live in the other files.

import type { Rng } from '../../core/rng';
import type { EliteTrait, ReworkCardId, ReworkClassId, ReworkEnemyId, ShrineKind, TaskKind } from '../../data/rework';
import type { ReworkSkillId } from '../../data/reworkSkills';
import type { Vec } from '../entities';

export type ObstacleKind = 'tree' | 'bush' | 'stone' | 'oak' | 'stoneRing' | 'log';

export interface Obstacle {
  kind: ObstacleKind;
  /** The foot of it on the ground; the blocking circle. */
  pos: Vec;
  radius: number;
  /** How tall it is drawn (trees). */
  height: number;
  /** A small per-obstacle variation for drawing. */
  seed: number;
}

export interface Dodge {
  from: Vec;
  to: Vec;
  time: number;
  duration: number;
  /** A blink: flies through obstacles and lands on a free point. */
  through?: boolean;
}

export interface RunHero {
  classId: ReworkClassId;
  pos: Vec;
  vel: Vec;
  /** Where the hero looks (radians): the last strike, else the walk. */
  facing: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** Seconds until the next basic attack / the dodge is ready. */
  attackTimer: number;
  dodgeTimer: number;
  /** Seconds of invulnerability left. */
  invuln: number;
  /** The dodge in progress (the animation reads it as `dash`). */
  dash: Dodge | null;
  dead: boolean;
  /** Run time of the last hit taken (for the flash). */
  hitAt: number;
  /** Debug: takes no damage. */
  immortal: boolean;
  /** A herb healing over time: HP per second and seconds left. */
  regen: { perSec: number; time: number } | null;
  /** A shrine's buff and the shield it gives. */
  shrine: { kind: ShrineKind; time: number } | null;
  shield: number;
}

export type EnemyAct =
  | { kind: 'walk' }
  | { kind: 'crouch'; time: number; dir: Vec }
  | { kind: 'leap'; time: number; dir: Vec }
  | { kind: 'aim'; time: number; dir: Vec; fan: boolean }
  | { kind: 'stomp'; time: number }
  /** The boss's moves (20.13). */
  | { kind: 'dashWind'; time: number; dir: Vec }
  | { kind: 'dash'; time: number; dir: Vec }
  | { kind: 'leapWind'; time: number; to: Vec; from: Vec }
  | { kind: 'leapAir'; time: number; to: Vec; from: Vec }
  | { kind: 'rest'; time: number }
  /** A beast standing in the living ring (20.12) at its place. */
  | { kind: 'ring'; slot: Vec }
  /** The spirit gathers its fog (20.10). */
  | { kind: 'cast'; time: number };

export interface RunEnemy {
  id: number;
  def: ReworkEnemyId;
  pos: Vec;
  vel: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  /** Damage multiplier from the time it came (later — stronger). */
  power: number;
  act: EnemyAct;
  /** Seconds until its trait can fire again / it may bite again. */
  traitTimer: number;
  touchTimer: number;
  shots: number;
  hitAt: number;
  dead: boolean;
  /** Skill effects (20.6): stunned or frozen — stands still; slowed; running away. */
  stun: number;
  freeze: number;
  slowMult: number;
  slowTime: number;
  fear: number;
  /** 20.9: an elite's trait; 20.12: the boss. */
  elite?: EliteTrait;
  boss?: boolean;
  /** Seconds to the boss's next dash / howl, the elite's next call, the den's next wolf. */
  moveTimer?: number;
  howlTimer?: number;
}

export interface Shot {
  pos: Vec;
  vel: Vec;
  radius: number;
  damage: number;
  /** Seconds left to fly. */
  life: number;
  /** Hero shots hit beasts; beast shots hit the hero. */
  byHero: boolean;
  kind: 'bolt' | 'arrow' | 'spore' | 'axe' | 'fireball' | 'missile' | 'pierceArrow';
  /** Beasts it may still pass through (arrows) and the ones already hit. */
  pierce: number;
  hit: number[];
  /** Skill shots (20.6). Bursts at its target point or on the first beast. */
  blast?: { radius: number; burn: number };
  target?: Vec;
  /** Flies after the nearest beast; may jump on to another after a hit. */
  homing?: boolean;
  bounce?: number;
  /** Comes back to the hero once (the axe). */
  returns?: boolean;
  stun?: number;
  /** Damage grows with each beast pierced. */
  grow?: number;
  /** Evolutions (20.8): circling the hero (an angle and radius, turning this fast), launched on a beast that comes near; split into small bursts. */
  orbit?: { angle: number; radius: number; spin: number; launch: number };
  /** Hits the same beast again after this long (circling axes). */
  rehit?: number;
  split?: boolean;
}

/** A patch of ground that hurts (burning ground, a rain of arrows). */
export interface Zone {
  kind: 'fire' | 'rain';
  pos: Vec;
  /** The evolved rain follows the hero. */
  follow?: boolean;
  radius: number;
  time: number;
  damage: number;
  /** Seconds to the next hurt. */
  tick: number;
  slow: number;
}

export interface Trap {
  pos: Vec;
  radius: number;
  damage: number;
  stun: number;
}

export interface HeroSkill {
  id: ReworkSkillId;
  rank: number;
  /** Seconds until it can be pressed again. */
  cooldown: number;
  /** Turned into its evolution (20.8). */
  evolved?: boolean;
}

/** 20.9: things on the map. */
export interface Chest {
  pos: Vec;
}

export interface Herb {
  pos: Vec;
}

export interface Shrine {
  kind: ShrineKind;
  pos: Vec;
  /** Seconds stood by it (charging) and seconds until it can be used again. */
  charge: number;
  rest: number;
}

export interface Altar {
  pos: Vec;
}

/** 20.11: the task of the location. */
export interface Task {
  kind: TaskKind;
  /** Seconds left; done or failed — over. */
  time: number;
  state: 'active' | 'done' | 'failed';
  /** Dens: ids of the dens still standing. Rescue: the man, whether he follows, the way out. */
  dens: number[];
  denCount: number;
  man: Vec;
  following: boolean;
  exit: Vec;
}

/** 20.12: what part of the location is on. */
export type RunPhase = 'flood' | 'warning' | 'ring' | 'won';

export interface Gem {
  pos: Vec;
  xp: number;
  /** Flying to the hero. */
  pulled: boolean;
}

export interface Coin {
  pos: Vec;
  pulled: boolean;
}

/** Something the screen shows once: numbers, swings, deaths. */
export type RunEvent =
  | { type: 'hit'; pos: Vec; amount: number; byHero: boolean }
  | { type: 'swing'; pos: Vec; angle: number; reach: number; arc: number }
  | { type: 'kill'; pos: Vec; def: ReworkEnemyId }
  | { type: 'levelUp'; level: number }
  | { type: 'dodge'; from: Vec; to: Vec }
  | { type: 'attack'; angle: number }
  | { type: 'cast'; skill: ReworkSkillId }
  | { type: 'blast'; pos: Vec; radius: number; color: string }
  | { type: 'chain'; points: Vec[] }
  /** A line on the screen for a moment (a chest opened, a task done, a shrine lit). */
  | { type: 'note'; pos: Vec; text: string; color: string }
  | { type: 'evolve'; skill: ReworkSkillId };

/** A card: a passive's next rank, a new skill or a skill's next rank. */
export type CardOffer =
  | { kind: 'passive'; id: ReworkCardId; rank: number }
  | { kind: 'skill'; id: ReworkSkillId; rank: number }
  | { kind: 'evolve'; id: ReworkSkillId; rank: number };

export interface Run {
  width: number;
  height: number;
  rng: Rng;
  /** Seconds since the run started (stops while choosing a card or dead). */
  time: number;
  hero: RunHero;
  obstacles: Obstacle[];
  /** Static lookup: cell key → obstacles touching that cell. */
  grid: Map<number, Obstacle[]>;
  enemies: RunEnemy[];
  shots: Shot[];
  gems: Gem[];
  coins: Coin[];
  nextId: number;
  spawnTimer: number;
  level: number;
  xp: number;
  gold: number;
  kills: number;
  /** Card id → rank taken. */
  cards: Partial<Record<ReworkCardId, number>>;
  /** Skills in their slots (keys 1–4), in the order they came. */
  skills: HeroSkill[];
  /** Battle cry and the like: faster attacks, less damage taken. */
  buff: { attackSpeed: number; guard: number; time: number } | null;
  /** The whirlwind turning around the hero. */
  spin: { time: number; tick: number; radius: number; damage: number; pull: boolean } | null;
  zones: Zone[];
  traps: Trap[];
  /** A skill effect that comes a little later (the second frost wave, the crack's bursts). */
  delayed: { time: number; pos: Vec; radius: number; damage: number; freeze: number; stun?: number; color?: string }[];
  /** Fans of arrows still to fly (the volley). */
  volleys: { time: number; angle: number; count: number; spread: number; range: number; damage: number; pierce: number }[];
  /** 20.9 */
  chests: Chest[];
  herbs: Herb[];
  herbTimer: number;
  shrines: Shrine[];
  altars: Altar[];
  altarUses: number;
  /** Elites already sent and the explosions they leave. */
  elitesSent: number;
  blasts: { time: number; pos: Vec; radius: number; damage: number }[];
  /** 20.10: the fog now and where it goes; the spirit came. */
  fog: number;
  fogTarget: number;
  spiritCame: boolean;
  /** 20.11 */
  task: Task | null;
  /** 20.12–20.13: the phase, the ring's centre, the boss weakened by the task. */
  phase: RunPhase;
  ringCenter: Vec;
  noHowl: boolean;
  /** Seconds the ring wall has hurt from (touch damage is per second). */
  wallTimer: number;
  /** Level-ups not chosen yet and the cards on the table. */
  pendingLevels: number;
  offer: CardOffer[] | null;
  rerolls: number;
  events: RunEvent[];
}
