// A trip through a location's arenas (ROADMAP 13.2): the plan of arenas, the battle of the
// current one, what each arena gives when won (altar — a gift once per location, treasure
// and lair — chests) and the fork choice. Shared by the game and the bot.

import type { GameState } from '../core/state';
import { EXPEDITION, type ArenaStepKind } from '../data/expedition';
import { OBJECTIVES, type ObjectiveKind } from '../data/objectives';
import { LOOT } from '../data/items';
import { type Battle, createBattle } from './battle';
import { displayName, dropItemLevel, itemLevelRange, rollItem, rollRarity, stashLoot } from './items';
import type { Item } from './items';
import { getNode } from './mapgen';
import { type BattleSummary, completeBattle } from './run';
import { clearBonusGold } from './scaling';
import { rollRelics } from './trophies';
import { fillNames } from '../data/names';

export interface ArenaStep {
  kind: ArenaStepKind;
  /** An objective arena: its goal. */
  goal?: ObjectiveKind;
}

export interface Expedition {
  nodeId: string;
  /** The arenas still to come after the current one, in order; a fork is a pair to choose from. */
  steps: (ArenaStep | [ArenaStep, ArenaStep])[];
  /** The arena being fought (or just won). */
  current: ArenaStep;
  /** Waves of the location already behind (the growth goes on). */
  wavesDone: number;
  /** Totals of the whole trip (the summary screen). */
  kills: number;
  xp: number;
  gold: number;
  loot: Item[];
  trophies: Record<string, number>;
}

/** The plan of a location: regular, short (transition zones, the prologue road) or a boss lair. */
export function planFor(state: GameState, nodeId: string): (ArenaStep | [ArenaStep, ArenaStep])[] {
  const node = getNode(state.world, nodeId);
  if (node.isBoss) return [{ kind: 'antechamber' }, { kind: 'boss' }];
  if (EXPEDITION.shortRegions.includes(node.region)) return [{ kind: 'entrance' }, { kind: 'lair' }];
  const kinds = state.cardRng.shuffle(EXPEDITION.forkKinds);
  const step = (kind: ArenaStepKind): ArenaStep => (kind === 'objective' ? { kind, goal: state.cardRng.pick(EXPEDITION.objectiveKinds) } : { kind });
  const fork: [ArenaStep, ArenaStep] = [step(kinds[0] ?? 'altar'), step(kinds[1] ?? kinds[0] ?? 'treasure')];
  return [{ kind: 'entrance' }, fork, { kind: 'lair' }];
}

/** Starts the trip: the first arena is current. */
export function startExpedition(state: GameState, nodeId: string): Expedition {
  const steps = planFor(state, nodeId);
  const first = steps.shift() as ArenaStep;
  const exp: Expedition = { nodeId, steps, current: first, wavesDone: 0, kills: 0, xp: 0, gold: 0, loot: [], trophies: {} };
  state.expedition = exp;
  return exp;
}

/** The battle of the current arena. */
export function stepBattle(state: GameState): Battle {
  const exp = state.expedition!;
  const k = exp.current.kind;
  if (k === 'boss') return createBattle(state, exp.nodeId);
  // The fork's arenas are mirrored left to right, the lair top to bottom (or left to right
  // when its sea must stay below): one location, different fields.
  const flip = { x: k === 'altar' || k === 'treasure' || k === 'objective', y: k === 'lair' };
  const b = createBattle(state, exp.nodeId, exp.wavesDone, false, { waves: EXPEDITION.waves[k], miniboss: k === 'lair', boss: false, objective: exp.current.goal, flip });
  if (k === 'treasure' && b.waves) b.waves.sizeMult = EXPEDITION.treasureWaveMult;
  b.step = k;
  return b;
}

/** The next choice: a fork (two arenas), the next arena, or nothing (the trip is over). */
export function nextChoice(exp: Expedition): ArenaStep[] {
  const next = exp.steps[0];
  if (!next) return [];
  return Array.isArray(next) ? [...next] : [next];
}

export interface StepResult {
  /** The whole location is done (the summary of the trip), or null — more arenas ahead. */
  summary: BattleSummary | null;
  lost: boolean;
  /** What this arena gave (chest, altar). */
  rewards: string[];
}

/**
 * The current arena's battle is over: a loss ends the trip; a win gives the arena's reward;
 * the last arena completes the location.
 */
export function finishStep(state: GameState, b: Battle): StepResult {
  const exp = state.expedition!;
  const won = b.outcome === 'won';
  const last = exp.steps.length === 0;
  exp.kills += b.stats.kills;
  exp.xp += b.stats.xp;
  exp.gold += b.stats.gold;
  exp.loot.push(...b.stats.loot);
  for (const [id, n] of Object.entries(b.stats.trophies)) exp.trophies[id] = (exp.trophies[id] ?? 0) + n;
  if (b.waves) exp.wavesDone = b.waves.cleared;
  const rewards = won ? arenaReward(state, b, exp.current.kind) : [];
  if (!won || last) {
    // The location counts as fought only now (a loss — a death — ends the trip too).
    const summary = completeBattle(state, b, { final: last || !won });
    summary.kills = exp.kills;
    summary.xp = exp.xp;
    summary.gold = exp.gold + summary.clearBonus;
    summary.loot = [...exp.loot];
    summary.trophies = { ...exp.trophies };
    summary.wavesCleared = exp.wavesDone;
    summary.firstWave = 1;
    summary.lastWave = exp.wavesDone;
    state.expedition = null;
    return { summary, lost: !won, rewards };
  }
  completeBattle(state, b, { final: false });
  return { summary: null, lost: false, rewards };
}

/** Goes on to the next arena (`choice`: which of a fork). */
export function chooseNext(state: GameState, choice = 0): ArenaStep | null {
  const exp = state.expedition;
  if (!exp) return null;
  const next = exp.steps.shift();
  if (!next) return null;
  exp.current = Array.isArray(next) ? (next[choice] ?? next[0]) : next;
  return exp.current;
}

/** Leaves the trip halfway (the location is not cleared). */
export function abandonExpedition(state: GameState): void {
  state.expedition = null;
}

/** Chests and altars. */
function arenaReward(state: GameState, b: Battle, kind: ArenaStepKind): string[] {
  const out: string[] = [];
  const node = b.node;
  if (kind === 'altar') {
    if (!node.altarUsed && state.hero.classId) {
      node.altarUsed = true;
      state.modalQueue.push({ kind: 'gift', rarity: state.cardRng.chance(0.5) ? 'rare' : 'common' });
      out.push('вівтар дає дар');
    } else out.push('вівтар уже порожній');
  }
  if (kind === 'treasure' || kind === 'lair' || kind === 'objective') {
    const share = kind === 'treasure' ? EXPEDITION.treasureGold : kind === 'lair' ? EXPEDITION.lairGold : OBJECTIVES.gold;
    const gold = Math.round(clearBonusGold(b.tier) * share);
    state.gold += gold;
    out.push(`${gold} зол.`);
    if (kind === 'treasure') {
      const rarity = rollRarity(state.lootRng, LOOT.miniboss.weights);
      const item = rollItem(state.lootRng, rarity, state.nextItemUid++, undefined, dropItemLevel(state.lootRng, itemLevelRange(b.level), 'miniboss', 3));
      stashLoot(state.hero, item);
      b.stats.loot.push(item);
      state.expedition?.loot.push(item);
      out.push(displayName(item));
      for (const tr of rollRelics(b)) out.push(fillNames(tr.name));
    }
  }
  return out;
}
