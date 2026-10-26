// Headless bot used by the balance simulation.

import type { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { LOOP } from '../src/data/balance';
import { CLASS_ORDER, getClass } from '../src/data/classes';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { chooseCard, chooseClass, completeBattle, type BattleSummary, nextCardOffer } from '../src/systems/run';
import { useSkill } from '../src/systems/skills';
import { enterPortal } from '../src/systems/waves';

export interface BotOptions {
  useSkills: boolean;
  rng: Rng;
  /** Safety cap for a single battle, seconds. */
  maxBattleTime: number;
}

/** Resolves pending level-up choices: first unlocked class, random cards. */
export function resolveModals(state: GameState, rng: Rng): void {
  while (state.modalQueue.length > 0) {
    const req = state.modalQueue.shift()!;
    if (req.kind === 'classChoice') {
      const id = CLASS_ORDER.find((c) => !getClass(c).locked);
      if (id) chooseClass(state, id);
    } else if (state.hero.classId) {
      const offer = nextCardOffer(state);
      if (offer.length > 0) chooseCard(state, rng.pick(offer));
    }
  }
}

/** Uses every ready skill that has a target. */
export function useReadySkills(b: Battle): void {
  for (const s of b.hero.skills) if (s.cooldown <= 0) useSkill(b, s.slot);
}

export interface BattleRun {
  summary: BattleSummary;
  time: number;
  hpLeftFrac: number;
}

export function runBattle(state: GameState, nodeId: string, opts: BotOptions): BattleRun {
  const b = createBattle(state, nodeId);
  while (!b.finished && b.time < opts.maxBattleTime) {
    if (opts.useSkills) useReadySkills(b);
    if (b.portal) enterPortal(b);
    stepBattle(b, LOOP.step);
    resolveModals(state, opts.rng);
  }
  if (!b.finished) {
    // Timed out: count as a loss.
    b.outcome = 'lost';
  }
  const time = b.time;
  const summary = completeBattle(state, b);
  return { summary, time, hpLeftFrac: state.hero.hp / state.hero.maxHp };
}
