// The expedition around the biome's run (ROADMAP 20.16, VISION §8): the class chosen once, the
// Berehynia's signs as lives, checkpoints. A death costs a sign and the biome starts again from
// its first location at level 1 — everything won in that try is gone with the run; with no signs
// left the expedition goes back to its last checkpoint (in the Forest — its very start) and a
// tombstone marks the try. Beating the biome's boss is a checkpoint: the signs come back. Each of
// these moments has her words. No DOM here.

import { REWORK_LIVES, type ReworkClassId } from '../../data/rework';

export interface Expedition {
  classId: ReworkClassId;
  lives: number;
  /** Where a lost expedition goes back to; the tries that ended there. */
  checkpoint: 'start' | 'forest';
  tombstones: number;
  deaths: number;
}

/** What a death did: her words, the signs left, whether it went back to the checkpoint. */
export interface DeathOutcome {
  line: string;
  lives: number;
  rollback: boolean;
}

export function newExpedition(classId: ReworkClassId): Expedition {
  return { classId, lives: REWORK_LIVES.max, checkpoint: 'start', tombstones: 0, deaths: 0 };
}

/** A death in the biome: a sign goes out; with none left — back to the checkpoint, a tombstone. */
export function loseLife(exp: Expedition): DeathOutcome {
  exp.deaths += 1;
  exp.lives -= 1;
  if (exp.lives > 0) return { line: REWORK_LIVES.death[REWORK_LIVES.max - exp.lives - 1] ?? REWORK_LIVES.death[REWORK_LIVES.death.length - 1]!, lives: exp.lives, rollback: false };
  exp.tombstones += 1;
  exp.lives = REWORK_LIVES.max;
  return { line: REWORK_LIVES.lost, lives: 0, rollback: true };
}

/** The biome's boss beaten: a checkpoint, the signs come back. */
export function reachCheckpoint(exp: Expedition): string {
  exp.lives = REWORK_LIVES.max;
  exp.checkpoint = 'forest';
  return REWORK_LIVES.checkpoint;
}
