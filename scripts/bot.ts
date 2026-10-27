// Headless bot used by the balance simulation.

import { TALENTS } from '../src/data/talents';
import { branchNodes, canLearn, learn, treeNodes } from '../src/systems/talents';
import type { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { LOOP, SIM } from '../src/data/balance';
import { CLASS_ORDER, getClass } from '../src/data/classes';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { chooseClass, chooseGift, choosePromotion, completePromotion, completeBattle, type BattleSummary, nextGiftOffer } from '../src/systems/run';
import { promotionChoices } from '../src/systems/promotion';
import { useSkill } from '../src/systems/skills';
import { botIdentifyAndEquip } from '../src/systems/items';
import { useHealItem } from '../src/systems/pickups';
import { HEAL_ORDER } from '../src/data/consumables';
import { enterPortal } from '../src/systems/waves';
import { telegraphContains } from '../src/systems/boss';
import { dist, normalize } from '../src/systems/entities';

export interface BotOptions {
  useSkills: boolean;
  rng: Rng;
  /** Safety cap for a single battle, seconds. */
  maxBattleTime: number;
  /** Class to take at the class choice (default: the first one). */
  classId?: string;
  /** A one-wave crossing of a cleared location (autopath). */
  transit?: boolean;
}

/**
 * The bot's talents: first fill the panel with skills (row order), then raise the panel
 * skills from the lowest rank (forks — a random variant), then passives.
 */
export function botSpendTalents(state: GameState, rng: Rng): void {
  const hero = state.hero;
  if (!hero.classId) return;
  const nodes = [...treeNodes(hero.classId), ...branchNodes(hero)];
  for (let guard = 0; guard < 100 && state.talentPoints > 0; guard++) {
    const ok = nodes.filter((n) => canLearn(state, n) === 'ok');
    const onPanel = hero.skills.filter((s) => s.slot >= 0 && s.slot < TALENTS.classSlots).length;
    const fresh = ok.find((n) => n.kind === 'skill' && !hero.skills.some((s) => s.id === n.id));
    const raise = ok
      .filter((n) => n.kind === 'skill' && hero.skills.some((s) => s.id === n.id && s.slot >= 0))
      .sort((a, b) => hero.skills.find((s) => s.id === a.id)!.rank - hero.skills.find((s) => s.id === b.id)!.rank)[0];
    const other = ok.find((n) => n.kind !== 'skill');
    const pick = (onPanel < TALENTS.classSlots ? fresh : undefined) ?? raise ?? other ?? fresh;
    if (!pick) break;
    learn(state, pick, rng.chance(0.5) ? 1 : 0);
  }
}

/** Resolves pending level-up choices: the given (or first unlocked) class, random cards; spends talent points. */
export function resolveModals(state: GameState, rng: Rng, classId?: string): void {
  while (state.modalQueue.length > 0) {
    const req = state.modalQueue.shift()!;
    if (req.kind === 'classChoice') {
      const id = classId ?? CLASS_ORDER.find((c) => !getClass(c).locked);
      if (id) chooseClass(state, id, getClass(id).defaultPicks);
    } else if (req.kind === 'promotion') {
      const branches = promotionChoices(state.hero);
      if (branches.length > 0) choosePromotion(state, rng.pick(branches).id);
    } else if (req.kind === 'promotion2') {
      completePromotion(state);
    } else if (req.kind === 'gift' && state.hero.classId) {
      const offer = nextGiftOffer(state, req.rarity);
      if (offer.length > 0) chooseGift(state, rng.pick(offer));
    }
  }
  if (state.talentPoints > 0) botSpendTalents(state, rng);
}

/** Eats / drinks the strongest healing item it carries. */
export function botHeal(b: Battle): void {
  for (const id of [...HEAL_ORDER].reverse()) if (useHealItem(b, id)) return;
}

/** Uses every ready skill that has a target. */
export function useReadySkills(b: Battle): void {
  for (const s of b.hero.skills) if (s.cooldown <= 0) useSkill(b, s.slot);
}

/** Steps out of red telegraph circles and boss puddles (away from their centres); otherwise lets the AI walk. */
export function dodgeTelegraphs(b: Battle): void {
  const hero = b.hero;
  let x = 0;
  let y = 0;
  for (const t of b.telegraphs) {
    if (t.dead || !telegraphContains(t, hero.pos, hero.radius)) continue;
    if (t.shape.kind === 'line') {
      // Out of a line sideways, to the side the hero is already on.
      const ax = t.shape.to.x - t.pos.x;
      const ay = t.shape.to.y - t.pos.y;
      const side = Math.sign(ax * (hero.pos.y - t.pos.y) - ay * (hero.pos.x - t.pos.x)) || 1;
      const n = normalize({ x: -ay * side, y: ax * side });
      x += n.x;
      y += n.y;
      continue;
    }
    const d = normalize({ x: hero.pos.x - t.pos.x, y: hero.pos.y - t.pos.y });
    x += d.x || 1;
    y += d.y;
  }
  // Puddles too: a player walks out of acid and poison.
  for (const h of b.hazards) {
    if (h.dead || h.ring || dist(hero.pos, h.pos) > h.radius + hero.radius) continue;
    const d = normalize({ x: hero.pos.x - h.pos.x, y: hero.pos.y - h.pos.y });
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
  const b = createBattle(state, nodeId, 0, opts.transit ?? false);
  while (!b.finished && b.time < opts.maxBattleTime) {
    if (opts.useSkills) useReadySkills(b);
    if (b.hero.hp < b.hero.maxHp * SIM.botHerbBelow) botHeal(b);
    if (b.portal) enterPortal(b);
    dodgeTelegraphs(b);
    stepBattle(b, LOOP.step);
    resolveModals(state, opts.rng, opts.classId);
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
