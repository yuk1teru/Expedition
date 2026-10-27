// XP, level-ups and the queue of level-up choices.

import { HERO, PROGRESSION } from '../data/balance';
import type { GameState } from '../core/state';
import { recomputeHeroStats } from './hero';
import { xpToNext } from './scaling';
import { levelPoints } from './talents';
import { GIFT_RULES } from '../data/gifts';

export function isMaxLevel(level: number): boolean {
  return level >= PROGRESSION.maxLevel;
}

/** Adds XP; may raise several levels at once. Returns the number of levels gained. */
export function gainXp(state: GameState, amount: number): number {
  const hero = state.hero;
  if (isMaxLevel(hero.level)) {
    hero.xp = 0;
    return 0;
  }
  hero.xp += amount;
  let gained = 0;
  while (!isMaxLevel(hero.level) && hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    levelUp(state);
    gained++;
  }
  if (isMaxLevel(hero.level)) hero.xp = 0;
  return gained;
}

/** Raises the level by one: base growth, then a choice depending on the level. */
export function levelUp(state: GameState): void {
  const hero = state.hero;
  if (isMaxLevel(hero.level)) return;
  hero.level += 1;
  recomputeHeroStats(hero);
  state.events.emit({
    type: 'levelUp',
    level: hero.level,
    hp: HERO.perLevel.hp,
    attack: HERO.perLevel.attack,
  });
  // Talent points (ROADMAP 12.1): the tree is where they go.
  state.talentPoints += levelPoints(hero.level);
  if (hero.level === PROGRESSION.classChoiceLevel) state.modalQueue.push({ kind: 'classChoice' });
  else if (hero.level === PROGRESSION.promotionLevel) state.modalQueue.push({ kind: 'promotion' });
  else if (hero.level === PROGRESSION.promotion2Level) state.modalQueue.push({ kind: 'promotion2' });
  // A gift every few levels (ROADMAP 12.8), sometimes a rare one.
  if (hero.classId && hero.level % GIFT_RULES.levelEvery === 0) {
    state.modalQueue.push({ kind: 'gift', rarity: state.cardRng.chance(GIFT_RULES.levelRareChance) ? 'rare' : 'common' });
  }
}

/** Debug: exactly one level up (keeps XP progress). */
export function grantLevel(state: GameState): void {
  if (isMaxLevel(state.hero.level)) return;
  const keep = state.hero.xp;
  state.hero.xp = 0;
  gainXp(state, xpToNext(state.hero.level));
  state.hero.xp = isMaxLevel(state.hero.level) ? 0 : keep;
}

/** XP progress within the current level, 0..1. */
export function xpFraction(level: number, xp: number): number {
  if (isMaxLevel(level)) return 1;
  return Math.min(1, xp / xpToNext(level));
}
