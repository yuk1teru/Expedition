// Events emitted by logic for render (floating numbers, particles, shake, banners).

import type { HealId, PickupKind } from '../data/consumables';
import type { Rarity } from '../data/items';
import type { Element } from '../data/elements';
import type { WeatherId } from '../data/weather';
import type { Vec } from './entities';
import type { WaveMult } from './waves';

export type GameEvent =
  /** Progress was saved as the checkpoint (the app writes the save). */
  | { type: 'checkpoint' }
  /** A quest was handed in (`reward`: what was given). */
  | { type: 'questDone'; name: string; reward: string[] }
  | { type: 'hit'; pos: Vec; amount: number; crit: boolean; targetId: number; radius: number; source: HitSource; element?: Element; eff?: number }
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
  /** A boss calls out its move (Sandstorm, Toxic Wave). */
  | { type: 'bossShout'; text: string; pos: Vec }
  /** N in a break: the skipped seconds were taken off the hero's cooldowns. */
  | { type: 'breakSkipped'; seconds: number; pos: Vec }
  /** Boot dash (Shift). */
  | { type: 'heroDodge'; from: Vec; to: Vec }
  | { type: 'miniboss'; name: string; pos: Vec }
  | { type: 'portalOpen'; pos: Vec; seconds: number }
  | { type: 'pickupSpawn'; kind: PickupKind; pos: Vec }
  | { type: 'pickup'; kind: PickupKind; pos: Vec }
  /** A healing item from a quick slot: `total` HP over `duration` s. */
  | { type: 'healUse'; id: HealId; pos: Vec; total: number; duration: number }
  | { type: 'loot'; pos: Vec; name: string; rarity: Rarity }
  | { type: 'levelUp'; level: number; hp: number; attack: number }
  | { type: 'heroDeath'; pos: Vec }
  | { type: 'skillCast'; skillId: string; rank: number; pos: Vec; target: Vec | null }
  | { type: 'skillTick'; skillId: string; pos: Vec; radius: number }
  /** A jumping effect (Chain Lightning): the hero and every target in order. */
  | { type: 'chain'; skillId: string; points: Vec[] }
  | { type: 'allyDeath'; pos: Vec }
  /** Archer dodged a melee hit. */
  | { type: 'heroDodged'; pos: Vec }
  /** Mage mana took a hit; `empty` when it ran out. */
  | { type: 'manaShield'; pos: Vec; amount: number; empty: boolean }
  | { type: 'manaPickup'; pos: Vec; amount: number }
  /** A barrier absorbed a hit. */
  | { type: 'shieldHit'; pos: Vec; amount: number; broken: boolean }
  /** A skill could not be used: no target, or the hero is rooted. */
  | { type: 'noTarget'; slot: number; reason?: 'rooted' }
  | { type: 'bossPhase'; phase: number; pos: Vec }
  | { type: 'telegraphFire'; kind: string; pos: Vec; radius: number }
  | { type: 'enemyShot'; pos: Vec }
  | { type: 'battleEnd'; won: boolean };

export type HitSource = 'basic' | 'splash' | 'skill' | 'zone' | 'thorns' | 'burn' | 'ally';
