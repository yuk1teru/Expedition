// Experience, gold and the level-up choice in the rework's run (ROADMAP 20.5–20.8). Gems and
// coins lie where beasts fell and fly to the hero inside the magnet radius. A level-up stops the
// run for a choice of 1 of 3 cards: a new skill while one of 4 slots is free, a skill's next
// rank, a new passive while one of 5 slots is free, a passive's next rank — and, when a skill at
// rank 5 has its passive, the golden evolution card. The first choice is always three skills —
// the hero starts with none. The cards can be re-rolled for gold, dearer each time.

import { PASSIVE_SLOTS, REWORK_CARDS, REWORK_PROGRESS, type ReworkCardId } from '../../data/rework';
import { CLASS_SKILLS, REWORK_SKILLS, SKILL_SLOTS } from '../../data/reworkSkills';
import { heroStats } from './hero';
import { evolutionReady } from './skills';
import type { CardOffer, Run } from './types';

const P = REWORK_PROGRESS;

/** Experience to go from `level` to the next one. */
export function xpToNext(level: number): number {
  return Math.round(P.xpBase + P.xpPerLevel * level + P.xpSquare * level * level);
}

export function rerollPrice(run: Run): number {
  return P.rerollCost + P.rerollStep * run.rerolls;
}

/** Gems and coins: pulled inside the magnet (slow, then faster), picked up on touch. */
export function stepPickups(run: Run, dt: number): void {
  const h = run.hero;
  if (h.dead) return;
  const magnet = heroStats(run).magnet;
  const fly = (p: { pos: { x: number; y: number }; pulled: boolean; speed?: number }): boolean => {
    const dx = h.pos.x - p.pos.x;
    const dy = h.pos.y - p.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < P.pickup + h.radius) return true;
    if (d < magnet) p.pulled = true;
    if (p.pulled) {
      // Slow at first, faster and faster: the flight is seen.
      p.speed = Math.min(P.gemMaxSpeed, (p.speed ?? P.gemSpeed) + P.gemAccel * dt);
      const step = Math.min(d, p.speed * dt);
      p.pos.x += (dx / d) * step;
      p.pos.y += (dy / d) * step;
    }
    return false;
  };
  run.gems = run.gems.filter((g) => {
    if (!fly(g)) return true;
    gainXp(run, g.xp);
    return false;
  });
  run.coins = run.coins.filter((c) => {
    if (!fly(c)) return true;
    run.gold += 1;
    return false;
  });
}

export function gainXp(run: Run, xp: number): void {
  run.xp += xp;
  while (run.xp >= xpToNext(run.level)) {
    run.xp -= xpToNext(run.level);
    run.level += 1;
    run.pendingLevels += 1;
    run.events.push({ type: 'levelUp', level: run.level });
  }
  if (!run.offer && run.pendingLevels > 0) run.offer = makeOffer(run);
  // Every card at its last rank: levels pass without a choice.
  if (run.offer && run.offer.length === 0) {
    run.offer = null;
    run.pendingLevels = 0;
  }
}

/** Every card that could come now. */
function openCards(run: Run): CardOffer[] {
  const owned = new Map(run.skills.map((s) => [s.id, s.rank]));
  const newSkills: CardOffer[] = run.skills.length < SKILL_SLOTS ? CLASS_SKILLS[run.hero.classId].filter((id) => !owned.has(id)).map((id) => ({ kind: 'skill', id, rank: 1 })) : [];
  // The hero starts with the basic attack only: the first choice is a skill.
  if (run.skills.length === 0 && newSkills.length > 0) return newSkills;
  const ranks: CardOffer[] = run.skills.filter((s) => s.rank < REWORK_SKILLS[s.id].ranks.length + 1).map((s) => ({ kind: 'skill', id: s.id, rank: s.rank + 1 }));
  // A new passive only while a slot is free; the ones taken keep growing.
  const full = passivesTaken(run).length >= PASSIVE_SLOTS;
  const passives: CardOffer[] = (Object.keys(REWORK_CARDS) as ReworkCardId[])
    .filter((id) => (run.cards[id] ?? 0) < REWORK_CARDS[id].ranks && (!full || (run.cards[id] ?? 0) > 0))
    .map((id) => ({ kind: 'passive', id, rank: (run.cards[id] ?? 0) + 1 }));
  return [...newSkills, ...ranks, ...passives];
}

/** The passives in their slots, in the order they came. */
export function passivesTaken(run: Run): ReworkCardId[] {
  return (Object.keys(run.cards) as ReworkCardId[]).filter((id) => (run.cards[id] ?? 0) > 0);
}

/** Up to three different cards; a ready evolution always comes first (golden). */
export function makeOffer(run: Run): CardOffer[] {
  const picks: CardOffer[] = run.skills.filter((s) => evolutionReady(run, s)).map((s) => ({ kind: 'evolve', id: s.id, rank: s.rank }));
  const open = openCards(run);
  while (picks.length < 3 && open.length > 0) picks.push(open.splice(Math.floor(run.rng.next() * open.length), 1)[0]!);
  return picks.slice(0, 3);
}

/** Takes card `index` of the offer; the next pending level gets a new offer. */
export function chooseCard(run: Run, index: number): boolean {
  const card = run.offer?.[index];
  if (!card) return false;
  const before = heroStats(run).maxHp;
  if (card.kind === 'passive') run.cards[card.id] = card.rank;
  else if (card.kind === 'evolve') {
    const sk = run.skills.find((s) => s.id === card.id);
    if (sk) sk.evolved = true;
    run.events.push({ type: 'evolve', skill: card.id });
  } else {
    const have = run.skills.find((s) => s.id === card.id);
    if (have) have.rank = card.rank;
    else run.skills.push({ id: card.id, rank: 1, cooldown: 0 });
  }
  const after = heroStats(run).maxHp;
  // Health: the new HP comes filled.
  run.hero.maxHp = after;
  run.hero.hp = Math.min(after, run.hero.hp + Math.max(0, after - before));
  run.pendingLevels -= 1;
  run.offer = run.pendingLevels > 0 ? makeOffer(run) : null;
  // Nothing left to offer: the level passes without a choice.
  if (run.offer && run.offer.length === 0) {
    run.offer = null;
    run.pendingLevels = 0;
  }
  return true;
}

/** New cards for gold; false if the gold is short. */
export function reroll(run: Run): boolean {
  if (!run.offer) return false;
  const price = rerollPrice(run);
  if (run.gold < price) return false;
  run.gold -= price;
  run.rerolls += 1;
  run.offer = makeOffer(run);
  return true;
}
