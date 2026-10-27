// Full-run bot (PLAN.md 6.8): route on the world map, town visits, shopping.
// Route: the nearest location not cleared yet with tier ≤ level / 3 + 1, otherwise the
// nearest boss not defeated yet whose recommended level the hero (almost) has, otherwise
// farming the hardest cleared location; back to town (rest, shop) when HP < 40%. A death
// returns the bot to the last rest (as the player); too many deaths end the run.

import type { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { SIM } from '../src/data/balance';
import { CONSUMABLES, HEAL_ORDER } from '../src/data/consumables';
import { RARITIES } from '../src/data/items';
import { buyConsumable, equipFromBag, identifyItem, itemLevelMult, type Item } from '../src/systems/items';
import { type World, effectiveTier, getNode, neighbours, recommendedLevel } from '../src/systems/mapgen';
import { isRunWon, passThrough, restInTown, restoreCheckpoint, travel } from '../src/systems/run';
import { runBattle } from './bot';

export interface FullRunResult {
  classId: string;
  won: boolean;
  /** Where every death happened: the region, or `boss:<region>`; after `maxDeaths` + 1 deaths the run is lost. */
  deaths: string[];
  /** Ran out of the day / battle budget without winning or dying. */
  stuck: boolean;
  days: number;
  /** Hero level when each boss fight started (in order). */
  bossLevels: number[];
  /** Hero level when the first boss was defeated (null if never). */
  levelAtFirstBossWin: number | null;
  locationTimes: number[];
  bossTimes: number[];
  battles: number;
  townVisits: number;
}

export interface FullRunOptions {
  useSkills: boolean;
  rng: Rng;
  classId: string;
  maxBattleTime: number;
  /** Deaths return to the last rest, as for the player; one more than this ends the run. */
  maxDeaths: number;
  /** Safety caps. */
  maxBattles: number;
  maxDays: number;
}

/** BFS path (excluding the start) from `from` to `to`. */
export function findPath(world: World, from: string, to: string): string[] {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of neighbours(world, cur)) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(to)) return [];
  const path: string[] = [];
  for (let at: string | null = to; at !== null && at !== from; at = prev.get(at) ?? null) path.unshift(at);
  return path;
}

/** The plan's route rule: nearest uncleared location with tier ≤ level / 3 + 1, else nearest boss left. */
export function chooseTarget(state: GameState): string | null {
  const world = state.world;
  const limit = state.hero.level / 3 + 1;
  const from = state.currentNodeId;
  const byDistance = (ids: string[]): string | null => {
    let best: string | null = null;
    let bestLen = Infinity;
    for (const id of ids) {
      const len = id === from ? 0 : findPath(world, from, id).length;
      if (len > 0 || id === from) {
        if (len < bestLen) {
          bestLen = len;
          best = id;
        }
      }
    }
    return best;
  };
  const tier = (n: (typeof world.nodes)[number]): number => effectiveTier(world, n, state.bossesDefeated.length);
  const open = world.nodes.filter((n) => !n.isTown && !n.isBoss && n.timesCleared === 0 && tier(n) <= limit).map((n) => n.id);
  if (open.length > 0) return byDistance(open);
  // A boss once the hero is about its recommended level (the fixed world has early bosses).
  const left = world.nodes.filter((n) => n.isBoss && !state.bossesDefeated.includes(n.id));
  const ready = left.filter((n) => recommendedLevel(tier(n)) <= state.hero.level + SIM.botBossLevelSlack).map((n) => n.id);
  if (ready.length > 0) return byDistance(ready);
  // Otherwise farm: replay the hardest cleared location within the limit (or the easiest boss left).
  const farm = world.nodes.filter((n) => !n.isTown && !n.isBoss && n.timesCleared > 0 && tier(n) <= limit);
  if (farm.length > 0) return farm.reduce((a, b) => (tier(b) > tier(a) ? b : a)).id;
  return byDistance(left.map((n) => n.id));
}

/** Item score for the bot: rarity power × item level. */
function itemScore(item: Item): number {
  return RARITIES[item.rarity].power * itemLevelMult(item.ilvl, false);
}

/**
 * The town to rest in: the nearest one reachable over cleared locations (crossed without
 * a battle), otherwise the home town (always reachable from the map).
 */
function restTown(state: GameState): string[] {
  const world = state.world;
  const prev = new Map<string, string | null>([[state.currentNodeId, null]]);
  const queue = [state.currentNodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const node = getNode(world, cur);
    if (node.isTown && cur !== state.currentNodeId) {
      const path: string[] = [];
      for (let at: string | null = cur; at !== null && at !== state.currentNodeId; at = prev.get(at) ?? null) path.unshift(at);
      return path;
    }
    if (cur !== state.currentNodeId && !node.isTown && node.timesCleared === 0) continue;
    for (const n of neighbours(world, cur)) {
      if (prev.has(n) || getNode(world, n).isBoss) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  return [state.homeTown];
}

/** Town: rest (checkpoint), identify and wear better items, buy potions with what is left. */
export function townVisit(state: GameState): void {
  if (!getNode(state.world, state.currentNodeId).isTown) {
    for (const id of restTown(state)) {
      if (getNode(state.world, id).isTown) travel(state, id);
      else passThrough(state, id);
    }
  }
  restInTown(state);
  const hero = state.hero;
  // Identify what could beat the worn item of its slot.
  for (let i = 0; i < hero.bag.length; i++) {
    const item = hero.bag[i]!;
    const worn = hero.equipment[item.slot];
    if (item.identified || (worn && itemScore(worn) >= itemScore(item))) continue;
    if (hero.consumables.magnifier <= 0 && !buyConsumable(state, 'magnifier')) break;
    identifyItem(hero, i);
  }
  for (let i = hero.bag.length - 1; i >= 0; i--) {
    const item = hero.bag[i];
    if (!item || !item.identified) continue;
    const worn = hero.equipment[item.slot];
    if (!worn || itemScore(item) > itemScore(worn)) equipFromBag(hero, i);
  }
  // Potions, the biggest first, while gold lasts.
  for (const id of [...HEAL_ORDER].reverse()) {
    if (CONSUMABLES[id].price <= 0) continue;
    while (buyConsumable(state, id)) {
      // keep buying
    }
  }
  restInTown(state);
}

export function simulateFullRun(state: GameState, opts: FullRunOptions): FullRunResult {
  const res: FullRunResult = {
    classId: opts.classId,
    won: false,
    deaths: [],
    stuck: false,
    days: 0,
    bossLevels: [],
    levelAtFirstBossWin: null,
    locationTimes: [],
    bossTimes: [],
    battles: 0,
    townVisits: 0,
  };
  const battleOpts = { useSkills: opts.useSkills, rng: opts.rng, maxBattleTime: opts.maxBattleTime, classId: opts.classId };
  townVisit(state);
  while (!isRunWon(state)) {
    if (res.battles >= opts.maxBattles || state.day > opts.maxDays) {
      res.stuck = true;
      break;
    }
    const target = chooseTarget(state);
    if (!target) {
      res.stuck = true;
      break;
    }
    const path = target === state.currentNodeId ? [target] : findPath(state.world, state.currentNodeId, target);
    let died = false;
    for (const id of path) {
      const node = getNode(state.world, id);
      if (node.isTown) {
        townVisit(state);
        res.townVisits++;
        continue;
      }
      // Cleared locations on the way are crossed; the target and new ones are fought.
      if (id !== target && node.timesCleared > 0 && passThrough(state, id)) continue;
      travel(state, id);
      if (node.isBoss) res.bossLevels.push(state.hero.level);
      const run = runBattle(state, id, battleOpts);
      res.battles++;
      (node.isBoss ? res.bossTimes : res.locationTimes).push(run.time);
      if (!run.summary.won) {
        res.deaths.push(node.isBoss ? `boss:${node.region}` : node.region);
        died = true;
        break;
      }
      if (node.isBoss && res.levelAtFirstBossWin === null) res.levelAtFirstBossWin = state.hero.level;
      if (state.hero.hp < state.hero.maxHp * SIM.botTownBelow) {
        townVisit(state);
        res.townVisits++;
        break;
      }
    }
    if (died) {
      if (res.deaths.length > opts.maxDeaths) break;
      // Back to the last rest in town, like the player.
      restoreCheckpoint(state);
      townVisit(state);
    }
  }
  res.won = isRunWon(state);
  res.days = state.day;
  return res;
}
