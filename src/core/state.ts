// Run state: everything that describes one expedition.

import type { Item } from '../systems/items';
import type { EventBus } from './events';
import type { Rng } from './rng';
import type { GameEvent } from '../systems/gameEvents';
import type { ScreenId } from './screens';
import type { Hero } from '../systems/entities';
import type { World } from '../systems/mapgen';
import type { DeathCause } from '../systems/combat';
import type { QuestLog } from '../systems/quests';
import type { Expedition } from '../systems/expedition';
import type { GiftRarity } from '../data/gifts';

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
export type ModalRequest = { kind: 'classChoice' } | { kind: 'gift'; rarity: GiftRarity } | { kind: 'promotion' } | { kind: 'promotion2' }
  /** A soul touched with an empty rune stone in the bag (ROADMAP 14.3). */
  | { kind: 'soulCatch'; soul: string };

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
  /** The location trip in progress (ROADMAP 13.2), or null. Not saved: a reload starts in town. */
  expedition: Expedition | null;
  /** Quests taken and done (ROADMAP 11.1). */
  quests: QuestLog;
  /** Talent points not spent yet (quests give them; the tree comes in stage 12). */
  talentPoints: number;
  /** Rune stones for souls (stage 14). */
  runeStones: number;
  /** Orders of the artifact buyer handed in (ROADMAP 14.1а). */
  ordersDone: string[];
  /** A beast's soul has been seen (ROADMAP 14.3): the wanderer tells about the stones. */
  soulSeen: boolean;
  /** Invasion events (ROADMAP 15.2): raided locations (→ the day the raid began), the captured land, the town under attack. */
  raids: Record<string, number>;
  lastRaidDay: number;
  capturedRegion: string | null;
  townAttack: string | null;
  /** Thresholds whose event has already happened (each once). */
  invasionEventsDone: number[];
  /** Invasion news not shown yet (the map shows them). */
  invasionNews: { title: string; text: string }[];
  /** Items in the stash, shared by all towns (ROADMAP 14.7); part of the checkpoint like the bag. */
  stash: Item[];
  /** Town growth levels (ROADMAP 15.4); part of the checkpoint like the gold paid for them. */
  townGrowth: Record<string, number>;
  /** Map nodes the hero has been to (fog of war, ROADMAP 10.6). */
  nodesVisited: string[];
  /** Secret places revealed (a hint, a quest). */
  revealed: string[];
  /** Debug: the map without the fog. */
  noFog?: boolean;
  /** Towns reached on foot: the coachman goes only there (ROADMAP 10.5). */
  townsVisited: string[];
  /** The highest invasion threshold already announced (ROADMAP 10.3), %. */
  invasionSeen: number;
  /** Set by a death; the doctor talks about it when the hero wakes up in town. */
  lastDeath: LastDeath | null;
  /** Debug: the coachman rides for free. */
  freeCoach?: boolean;
  /** Debug: the invasion does not make enemies stronger. */
  noInvasion?: boolean;
  /** Debug: a death takes no life. */
  infiniteLives?: boolean;
  /** The prologue's first moment: the hero wakes up at the town's arrival point (not saved). */
  arriving?: boolean;
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
  stash: Item[];
  townGrowth: Record<string, number>;
}

export function createRunStats(): RunStats {
  return { kills: 0, damageDealt: 0, damageTaken: 0, playTime: 0, locationsCleared: 0, deaths: 0 };
}
