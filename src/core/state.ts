// Run state: everything that describes one expedition.

import type { Rng } from './rng';
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
}

export type ModalRequest = { kind: 'classChoice' } | { kind: 'cardChoice' };

export interface GameState {
  seed: number;
  /** Root RNG; subsystems use forks of it. */
  rng: Rng;
  /** Card offers stream (`rng.fork("cards")`). */
  cardRng: Rng;
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
}

export function createRunStats(): RunStats {
  return { kills: 0, damageDealt: 0, damageTaken: 0, playTime: 0, locationsCleared: 0 };
}
