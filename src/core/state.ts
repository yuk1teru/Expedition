// Run state: everything that describes one expedition.

import type { EventBus } from './events';
import type { Rng } from './rng';
import type { GameEvent } from '../systems/gameEvents';
import type { ScreenId } from './screens';
import type { Hero } from '../systems/entities';
import type { World } from '../systems/mapgen';
import type { DeathCause } from '../systems/combat';

export interface RunStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  /** Seconds of play. */
  playTime: number;
  locationsCleared: number;
  /** Times the hero died and returned to the checkpoint. */
  deaths: number;
}

/** `bossReward`: the extra card for a boss victory (not a level-up). */
export type ModalRequest = { kind: 'classChoice' } | { kind: 'cardChoice'; level: number; bossReward?: boolean } | { kind: 'promotion' };

export interface GameState {
  seed: number;
  /** The player's name for the hero (the new-game screen). */
  heroName: string;
  /** Root RNG; subsystems use forks of it. */
  rng: Rng;
  /** Card offers stream (`rng.fork("cards")`). */
  cardRng: Rng;
  /** Loot stream (`rng.fork("loot")`). */
  lootRng: Rng;
  /** Next item uid. */
  nextItemUid: number;
  /** Number of battles started, used to fork per-battle RNG streams. */
  battleCount: number;
  day: number;
  gold: number;
  /** Lives left: a death takes one, none left — the hero's story is over (LIVES in balance.ts). */
  lives: number;
  hero: Hero;
  world: World;
  currentNodeId: string;
  /** The town where the hero rested last: death brings it back here; it is always reachable from the map. */
  homeTown: string;
  bossesDefeated: string[];
  stats: RunStats;
  screen: ScreenId;
  /** Pending modal windows (level-up choices) to show in order. */
  modalQueue: ModalRequest[];
  /** Logic → render notifications. Nobody listens in headless simulation. */
  events: EventBus<GameEvent>;
  /** Progress saved at the last rest in town; death returns here. */
  checkpoint: Checkpoint;
  /** Towns reached on foot: the coachman goes only there (ROADMAP 10.5). */
  townsVisited: string[];
  /** The highest invasion threshold already announced (ROADMAP 10.3), %. */
  invasionSeen: number;
  /** Set by a death; the doctor talks about it when the hero wakes up in town. */
  lastDeath: LastDeath | null;
  /** Debug: the coachman rides for free. */
  freeCoach?: boolean;
  /** Debug: travel to any node, not only to neighbours. */
  freeTravel?: boolean;
}

/** The last death, until the doctor has told about it in town. */
export interface LastDeath {
  nodeId: string;
  cause: DeathCause | null;
  /** The battle's loot was left in the location. */
  lostLoot: boolean;
}

/** Snapshot of run progress restored after death. */
export interface Checkpoint {
  hero: Hero;
  gold: number;
  day: number;
  lives: number;
  world: World;
  bossesDefeated: string[];
  homeTown: string;
  lastDeath: LastDeath | null;
}

export function createRunStats(): RunStats {
  return { kills: 0, damageDealt: 0, damageTaken: 0, playTime: 0, locationsCleared: 0, deaths: 0 };
}
