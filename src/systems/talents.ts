// Talent trees in play (ROADMAP 12.1, 12.3): points from levels and quests are spent on the
// class tree — opening skills, raising ranks (forks at ranks 3 and 5), passive stacks,
// arrow types. Rows open with the points already in the tree. Which skills sit on the
// panel (keys 1–5) is chosen out of battle.

import type { GameState } from '../core/state';
import { RANKS } from '../data/balance';
import type { Element } from '../data/elements';
import { getSkill, getPassive } from '../data/skills';
import { TALENTS, TALENT_TREES, TEACHERS } from '../data/talents';
import { getPromotion } from '../data/promotions';
import type { Hero, HeroSkill } from './entities';
import { recomputeHeroStats } from './hero';

/** A tree node; `row` 1–3 for the class tree, BRANCH_ROW for the specialization. */
export type TalentNode =
  | { kind: 'skill'; id: string; row: number }
  | { kind: 'passive'; id: string; row: number }
  | { kind: 'arrow'; id: Element; row: number };

/** The specialization's "row": open from the promotion on, its skills come with levels 12 and 22. */
export const BRANCH_ROW = 4;

/** The branch's nodes: its two skills and two passives (empty before the promotion). */
export function branchNodes(hero: Hero): TalentNode[] {
  if (!hero.promotion) return [];
  const p = getPromotion(hero.promotion);
  return [
    { kind: 'skill', id: p.signature, row: BRANCH_ROW },
    { kind: 'skill', id: p.signature2, row: BRANCH_ROW },
    ...p.passives.map((id): TalentNode => ({ kind: 'passive', id, row: BRANCH_ROW })),
  ];
}

/** All nodes of a class tree, row by row (1-based rows). */
export function treeNodes(classId: string): TalentNode[] {
  const rows = TALENT_TREES[classId] ?? [];
  return rows.flatMap((r, i) => [
    ...r.skills.map((id): TalentNode => ({ kind: 'skill', id, row: i + 1 })),
    ...r.passives.map((id): TalentNode => ({ kind: 'passive', id, row: i + 1 })),
    ...(r.arrows ?? []).map((id): TalentNode => ({ kind: 'arrow', id, row: i + 1 })),
  ]);
}

/** Starting skills of a class: its first row. */
export function startingSkills(classId: string): string[] {
  return TALENT_TREES[classId]?.[0]?.skills ?? [];
}

/** Points that a skill of this rank cost (the free starting opening not counted). */
function skillCost(rank: number, free: boolean): number {
  let sum = 0;
  for (let r = 1; r <= rank; r++) sum += TALENTS.rankCost[r - 1] ?? 0;
  return free ? sum - (TALENTS.rankCost[0] ?? 0) : sum;
}

/** Points already in the class tree (they open the rows). */
export function pointsSpent(hero: Hero): number {
  if (!hero.classId) return 0;
  let sum = 0;
  for (const n of treeNodes(hero.classId)) {
    if (n.kind === 'skill') {
      const s = hero.skills.find((x) => x.id === n.id);
      if (s) sum += skillCost(s.rank, hero.freeSkills.includes(n.id));
    } else if (n.kind === 'passive') sum += (hero.passives[n.id] ?? 0) * TALENTS.passiveCost;
    else if (hero.arrows.includes(n.id)) sum += TALENTS.arrowCost;
  }
  return sum;
}

/** The whole class tree's price (the wiki: how much of it a hero can get). */
export function treeCost(classId: string): number {
  let sum = 0;
  for (const n of treeNodes(classId)) {
    if (n.kind === 'skill') sum += skillCost(RANKS.max, false);
    else if (n.kind === 'passive') sum += getPassive(n.id).maxStacks * TALENTS.passiveCost;
    else sum += TALENTS.arrowCost;
  }
  return sum - 2 * (TALENTS.rankCost[0] ?? 0);
}

export function rowOpen(hero: Hero, row: number): boolean {
  if (row === BRANCH_ROW) return !!hero.promotion;
  return pointsSpent(hero) >= (TALENTS.rowUnlock[row - 1] ?? Infinity);
}

/** Price of the next step of a node; null — maxed. */
export function nextCost(hero: Hero, n: TalentNode): number | null {
  if (n.kind === 'skill') {
    const s = hero.skills.find((x) => x.id === n.id);
    // Branch skills are not bought: they come with levels 12 and 22.
    if (!s && n.row === BRANCH_ROW) return null;
    const rank = s?.rank ?? 0;
    return rank >= RANKS.max ? null : (TALENTS.rankCost[rank] ?? null);
  }
  if (n.kind === 'passive') return (hero.passives[n.id] ?? 0) >= getPassive(n.id).maxStacks ? null : TALENTS.passiveCost;
  return hero.arrows.includes(n.id) ? null : TALENTS.arrowCost;
}

/** The rank a skill would get next and whether it is a fork (two variants to pick from). */
export function nextFork(hero: Hero, skillId: string): 3 | 5 | null {
  const s = hero.skills.find((x) => x.id === skillId);
  const next = (s?.rank ?? 0) + 1;
  return getSkill(skillId).forks?.some((f) => f.rank === next) ? (next as 3 | 5) : null;
}

export type LearnCheck = 'ok' | 'noClass' | 'rowLocked' | 'maxed' | 'noPoints';

export function canLearn(state: GameState, n: TalentNode): LearnCheck {
  const hero = state.hero;
  if (!hero.classId) return 'noClass';
  if (!rowOpen(hero, n.row)) return 'rowLocked';
  const cost = nextCost(hero, n);
  if (cost === null) return 'maxed';
  if (state.talentPoints < cost) return 'noPoints';
  return 'ok';
}

/** First free class slot (1–5), or -1 when the panel is full (the skill waits off the panel). */
export function firstFreeClassSlot(hero: Hero): number {
  for (let i = 0; i < TALENTS.classSlots; i++) if (!hero.skills.some((s) => s.slot === i)) return i;
  return -1;
}

/** Spends points on a node; `fork` — the variant at a fork rank (0 or 1). */
export function learn(state: GameState, n: TalentNode, fork: 0 | 1 = 0): boolean {
  if (canLearn(state, n) !== 'ok') return false;
  const hero = state.hero;
  const cost = nextCost(hero, n)!;
  if (n.kind === 'skill') {
    const s = hero.skills.find((x) => x.id === n.id);
    if (!s) hero.skills.push({ id: n.id, rank: 1, cooldown: 0, slot: firstFreeClassSlot(hero) });
    else {
      const at = nextFork(hero, n.id);
      s.rank += 1;
      if (at) s.forks = { ...s.forks, [at]: fork };
    }
  } else if (n.kind === 'passive') hero.passives[n.id] = (hero.passives[n.id] ?? 0) + 1;
  else {
    hero.arrows.push(n.id);
    // The first arrows learned go on the bow at once.
    if (hero.arrowElement === 'neutral') hero.arrowElement = n.id;
  }
  state.talentPoints -= cost;
  recomputeHeroStats(hero);
  return true;
}

/** Points for reaching a level: one from TALENTS.pointsFrom on, one more every bonusEvery levels. */
export function levelPoints(level: number): number {
  if (level < TALENTS.pointsFrom) return 0;
  return 1 + (level % TALENTS.bonusEvery === 0 ? 1 : 0);
}

/** All the points levels give up to this level. */
export function pointsUpTo(level: number): number {
  let sum = 0;
  for (let l = 2; l <= level; l++) sum += levelPoints(l);
  return sum;
}

/** Puts a learned class skill on a panel slot (0–4), or takes it off (-1); a skill already there swaps away. */
export function setPanelSlot(hero: Hero, skillId: string, slot: number): void {
  const s = hero.skills.find((x) => x.id === skillId);
  if (!s || s.slot >= TALENTS.classSlots) return;
  if (slot < -1 || slot >= TALENTS.classSlots) return;
  const other = slot >= 0 ? hero.skills.find((x) => x.slot === slot && x !== s) : undefined;
  if (other) other.slot = s.slot;
  s.slot = slot;
}

/** Class skills on the panel and off it. */
export function panelSkills(hero: Hero): { on: HeroSkill[]; off: HeroSkill[] } {
  const cls = hero.skills.filter((s) => s.slot < TALENTS.classSlots);
  return { on: cls.filter((s) => s.slot >= 0).sort((a, b) => a.slot - b.slot), off: cls.filter((s) => s.slot < 0) };
}

/** Price of resetting the tree at the class teacher (grows with the level). */
export function resetPrice(hero: Hero): number {
  return TEACHERS.resetBase + TEACHERS.resetPerLevel * hero.level;
}

/** Points that a reset gives back: the class tree and the branch (the free openings not counted). */
export function refundablePoints(hero: Hero): number {
  let sum = pointsSpent(hero);
  for (const n of branchNodes(hero)) {
    if (n.kind === 'skill') {
      const s = hero.skills.find((x) => x.id === n.id);
      if (s) sum += skillCost(s.rank, true);
    } else if (n.kind === 'passive') sum += (hero.passives[n.id] ?? 0) * TALENTS.passiveCost;
  }
  return sum;
}

/**
 * The teacher resets the tree: every point comes back; the starting skills and the branch
 * skills stay at rank 1, the rest is unlearned (forks and arrows too). Gifts stay.
 */
export function resetTree(state: GameState): boolean {
  const hero = state.hero;
  if (!hero.classId) return false;
  const price = resetPrice(hero);
  if (state.gold < price) return false;
  state.gold -= price;
  state.talentPoints += refundablePoints(hero);
  const branch = new Set(branchNodes(hero).filter((n) => n.kind === 'skill').map((n) => n.id));
  hero.skills = hero.skills
    .filter((s) => hero.freeSkills.includes(s.id) || branch.has(s.id))
    .map((s) => ({ ...s, rank: 1, forks: undefined, cooldown: 0 }));
  hero.freeSkills.forEach((id, i) => {
    const s = hero.skills.find((x) => x.id === id);
    if (s) s.slot = i;
  });
  hero.passives = {};
  hero.arrows = [];
  hero.arrowElement = 'neutral';
  recomputeHeroStats(hero);
  return true;
}
