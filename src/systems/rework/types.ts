// State of the rework's location run (ROADMAP 20.1–20.5): the hero, the beasts, what flies,
// what lies on the ground, the level-up choice. Plain data — the steps live in the other files.

import type { Rng } from '../../core/rng';
import type { ReworkCardId, ReworkClassId, ReworkEnemyId } from '../../data/rework';
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
}

export type EnemyAct =
  | { kind: 'walk' }
  | { kind: 'crouch'; time: number; dir: Vec }
  | { kind: 'leap'; time: number; dir: Vec }
  | { kind: 'aim'; time: number; dir: Vec; fan: boolean }
  | { kind: 'stomp'; time: number };

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
  kind: 'bolt' | 'arrow' | 'spore';
  /** Beasts it may still pass through (arrows) and the ones already hit. */
  pierce: number;
  hit: number[];
}

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
  | { type: 'dodge'; from: Vec; to: Vec };

export interface CardOffer {
  id: ReworkCardId;
  /** The rank the card gives (1…ranks). */
  rank: number;
}

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
  /** Level-ups not chosen yet and the cards on the table. */
  pendingLevels: number;
  offer: CardOffer[] | null;
  rerolls: number;
  events: RunEvent[];
}
