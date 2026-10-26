// Headless bot used by the balance simulation.

import type { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { LOOP, SIM } from '../src/data/balance';
import { CLASS_ORDER, getClass } from '../src/data/classes';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { chooseCard, chooseClass, completeBattle, type BattleSummary, nextCardOffer } from '../src/systems/run';
import { useSkill } from '../src/systems/skills';
import { botIdentifyAndEquip } from '../src/systems/items';
import { useHealItem } from '../src/systems/pickups';
import { HEAL_ORDER } from '../src/data/consumables';
import { enterPortal } from '../src/systems/waves';
import { telegraphContains } from '../src/systems/boss';
import { normalize } from '../src/systems/entities';

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
      if (id) chooseClass(state, id, getClass(id).defaultPicks);
    } else if (state.hero.classId) {
      const offer = nextCardOffer(state);
      if (offer.length > 0) chooseCard(state, rng.pick(offer));
    }
  }
}

/** Eats / drinks the strongest healing item it carries. */
export function botHeal(b: Battle): void {
  for (const id of [...HEAL_ORDER].reverse()) if (useHealItem(b, id)) return;
}

/** Uses every ready skill that has a target. */
export function useReadySkills(b: Battle): void {
  for (const s of b.hero.skills) if (s.cooldown <= 0) useSkill(b, s.slot);
}

/** Steps out of red telegraph circles (away from their centres); otherwise lets the AI walk. */
export function dodgeTelegraphs(b: Battle): void {
  const hero = b.hero;
  let x = 0;
  let y = 0;
  for (const t of b.telegraphs) {
    if (t.dead || !telegraphContains(t, hero.pos, hero.radius)) continue;
    const d = normalize({ x: hero.pos.x - t.pos.x, y: hero.pos.y - t.pos.y });
    x += d.x || 1;
    y += d.y;
  }
  b.input.move = x === 0 && y === 0 ? { x: 0, y: 0 } : normalize({ x, y });
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
    if (b.hero.hp < b.hero.maxHp * SIM.botHerbBelow) botHeal(b);
    if (b.portal) enterPortal(b);
    dodgeTelegraphs(b);
    stepBattle(b, LOOP.step);
    resolveModals(state, opts.rng);
  }
  if (!b.finished) {
    // Timed out: count as a loss.
    b.outcome = 'lost';
  }
  const time = b.time;
  const summary = completeBattle(state, b);
  // A player would buy magnifiers and wear new items; the bot fills empty slots.
  botIdentifyAndEquip(state);
  return { summary, time, hpLeftFrac: state.hero.hp / state.hero.maxHp };
}
