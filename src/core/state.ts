// Run state: everything that describes one expedition.

import type { EventBus } from './events';
import type { Rng } from './rng';
import type { GameEvent } from '../systems/gameEvents';
import type { ScreenId } from './screens';
import type { Hero } from '../systems/entities';
import type { World } from '../systems/mapgen';

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

export type ModalRequest = { kind: 'classChoice' } | { kind: 'cardChoice'; level: number };

export interface GameState {
  seed: number;
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
  hero: Hero;
  world: World;
  currentNodeId: string;
  bossesDefeated: string[];
  stats: RunStats;
  screen: ScreenId;
  /** Pending modal windows (level-up choices) to show in order. */
  modalQueue: ModalRequest[];
  /** Logic → render notifications. Nobody listens in headless simulation. */
  events: EventBus<GameEvent>;
  /** Progress saved at the last rest in town; death returns here. */
  checkpoint: Checkpoint;
}

/** Snapshot of run progress restored after death. */
export interface Checkpoint {
  hero: Hero;
  gold: number;
  day: number;
  world: World;
  bossesDefeated: string[];
}

export function createRunStats(): RunStats {
  return { kills: 0, damageDealt: 0, damageTaken: 0, playTime: 0, locationsCleared: 0, deaths: 0 };
}
