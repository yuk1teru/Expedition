// Experience, gold and the level-up choice in the rework's run (ROADMAP 20.5). Gems and coins
// lie where beasts fell and fly to the hero inside the magnet radius. A level-up stops the run
// for a choice of 1 of 3 cards; the cards can be re-rolled for gold, dearer each time.

import { REWORK_CARDS, REWORK_PROGRESS, type ReworkCardId } from '../../data/rework';
import { heroStats } from './hero';
import type { CardOffer, Run } from './types';

const P = REWORK_PROGRESS;

/** Experience to go from `level` to the next one. */
export function xpToNext(level: number): number {
  return Math.round(P.xpBase + P.xpPerLevel * level + P.xpSquare * level * level);
}

export function rerollPrice(run: Run): number {
  return P.rerollCost + P.rerollStep * run.rerolls;
}

/** Gems and coins: pulled inside the magnet, picked up on touch. */
export function stepPickups(run: Run, dt: number): void {
  const h = run.hero;
  if (h.dead) return;
  const magnet = heroStats(run).magnet;
  const fly = (p: { pos: { x: number; y: number }; pulled: boolean }): boolean => {
    const dx = h.pos.x - p.pos.x;
    const dy = h.pos.y - p.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < P.pickup + h.radius) return true;
    if (d < magnet) p.pulled = true;
    if (p.pulled) {
      const step = Math.min(d, P.gemSpeed * dt);
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

/** Up to three different cards that are not at their last rank. */
export function makeOffer(run: Run): CardOffer[] {
  const open = (Object.keys(REWORK_CARDS) as ReworkCardId[]).filter((id) => (run.cards[id] ?? 0) < REWORK_CARDS[id].ranks);
  const picks: CardOffer[] = [];
  while (picks.length < 3 && open.length > 0) {
    const i = Math.floor(run.rng.next() * open.length);
    const id = open.splice(i, 1)[0]!;
    picks.push({ id, rank: (run.cards[id] ?? 0) + 1 });
  }
  return picks;
}

/** Takes card `index` of the offer; the next pending level gets a new offer. */
export function chooseCard(run: Run, index: number): boolean {
  const card = run.offer?.[index];
  if (!card) return false;
  const before = heroStats(run).maxHp;
  run.cards[card.id] = card.rank;
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
