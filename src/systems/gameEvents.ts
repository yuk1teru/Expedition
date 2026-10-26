// Events emitted by logic for render (floating numbers, particles, shake, banners).

import type { PickupKind } from '../data/consumables';
import type { Rarity } from '../data/items';
import type { WeatherId } from '../data/weather';
import type { Vec } from './entities';
import type { WaveMult } from './waves';

export type GameEvent =
  | { type: 'hit'; pos: Vec; amount: number; crit: boolean; targetId: number; radius: number; source: HitSource }
  | { type: 'heroHurt'; pos: Vec; amount: number }
  /** Every basic attack of the hero (swing or shot), for the attack-speed visuals. */
  | { type: 'heroAttack'; pos: Vec; angle: number; reach: number; arc: number; ranged: boolean; targets: number }
  | { type: 'heroHeal'; pos: Vec; amount: number }
  | { type: 'kill'; pos: Vec; defId: string; radius: number; elite: boolean; boss: boolean }
  | { type: 'gold'; pos: Vec; amount: number }
  | { type: 'spawn'; pos: Vec; radius: number }
  | { type: 'wave'; index: number; total: number; bonus: number; mult: WaveMult; weather: WeatherId | null }
  | { type: 'weatherEnd' }
  | { type: 'trapSnap'; pos: Vec }
  | { type: 'bossCombo'; pos: Vec }
  /** Boot dash (Shift). */
  | { type: 'heroDodge'; from: Vec; to: Vec }
  | { type: 'miniboss'; name: string; pos: Vec }
  | { type: 'portalOpen'; pos: Vec; seconds: number }
  | { type: 'pickupSpawn'; kind: PickupKind; pos: Vec }
  | { type: 'pickup'; kind: PickupKind; pos: Vec }
  | { type: 'loot'; pos: Vec; name: string; rarity: Rarity }
  | { type: 'levelUp'; level: number; hp: number; attack: number }
  | { type: 'heroDeath'; pos: Vec }
  | { type: 'skillCast'; skillId: string; rank: number; pos: Vec; target: Vec | null }
  | { type: 'skillTick'; skillId: string; pos: Vec; radius: number }
  /** A skill could not be used: no target, or the hero is rooted. */
  | { type: 'noTarget'; slot: number; reason?: 'rooted' }
  | { type: 'bossPhase'; phase: number; pos: Vec }
  | { type: 'telegraphFire'; kind: string; pos: Vec; radius: number }
  | { type: 'enemyShot'; pos: Vec }
  | { type: 'battleEnd'; won: boolean };

export type HitSource = 'basic' | 'splash' | 'skill' | 'zone' | 'thorns' | 'burn';
