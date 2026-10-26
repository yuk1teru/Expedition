// Events emitted by logic for render (floating numbers, particles, shake, banners).

import type { Rarity } from '../data/items';
import type { Vec } from './entities';

export type GameEvent =
  | { type: 'hit'; pos: Vec; amount: number; crit: boolean; targetId: number; radius: number; source: HitSource }
  | { type: 'heroHurt'; pos: Vec; amount: number }
  /** Every basic attack of the hero (swing or shot), for the attack-speed visuals. */
  | { type: 'heroAttack'; pos: Vec; angle: number; reach: number; ranged: boolean }
  | { type: 'heroHeal'; pos: Vec; amount: number }
  | { type: 'kill'; pos: Vec; defId: string; radius: number; elite: boolean; boss: boolean }
  | { type: 'gold'; pos: Vec; amount: number }
  | { type: 'spawn'; pos: Vec; radius: number }
  | { type: 'wave'; index: number; total: number; bonus: number }
  | { type: 'miniboss'; name: string; pos: Vec }
  | { type: 'portalOpen'; pos: Vec }
  | { type: 'loot'; pos: Vec; name: string; rarity: Rarity; equipped: boolean }
  | { type: 'levelUp'; level: number; hp: number; attack: number }
  | { type: 'heroDeath'; pos: Vec }
  | { type: 'skillCast'; skillId: string; rank: number; pos: Vec; target: Vec | null }
  | { type: 'skillTick'; skillId: string; pos: Vec; radius: number }
  | { type: 'noTarget'; slot: number }
  | { type: 'bossPhase'; phase: number; pos: Vec }
  | { type: 'telegraphFire'; kind: string; pos: Vec; radius: number }
  | { type: 'enemyShot'; pos: Vec }
  | { type: 'battleEnd'; won: boolean };

export type HitSource = 'basic' | 'skill' | 'zone' | 'thorns' | 'burn';
