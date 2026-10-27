// Quests in play (ROADMAP 11.1): all of them come from src/data/quests.ts — a new quest is
// new data, not new code. Objectives go in order; kills, minibosses, bosses, clears and
// arrivals advance them after battles and travels, talks — in the conversation with the
// NPC. Conversations get their quest options here (offer, talk, turn-in).

import type { GameState } from '../core/state';
import { LIVES } from '../data/balance';
import { RARITIES } from '../data/items';
import { fillNames, resolveName } from '../data/names';
import { type DialogueNode, type DialogueOption, NPC_LINES, type NpcDef } from '../data/npcs';
import { QUESTS, QUEST_LINES, type QuestDef, type QuestObjective } from '../data/quests';
import { merchantItemLevels, rollItem, stashLoot } from './items';

/** A quest the hero is doing: the objective in work and its counter (kills). */
export interface QuestState {
  id: string;
  step: number;
  count: number;
}

export interface QuestLog {
  active: QuestState[];
  /** Completed quests (a repeatable one may be here and active again). */
  done: string[];
}

export function emptyQuestLog(): QuestLog {
  return { active: [], done: [] };
}

/** Objective kinds the game can track now; quests with others wait (special ones — their stages). */
const PLAYABLE = new Set(['kill', 'killMiniboss', 'killBoss', 'clear', 'reach', 'deliver', 'talk', 'bring']);

/** Special objectives the game tracks (the others wait for their stages). */
const SPECIAL = new Set(['amulet', 'siege', 'tower100']);

export function questPlayable(q: QuestDef): boolean {
  return q.objectives.every((o) => PLAYABLE.has(o.kind) || (o.kind === 'special' && SPECIAL.has(o.target)));
}

/** A special objective is met (the amulet found…): quests waiting for it go on. */
export function questsSpecial(state: GameState, target: string): void {
  for (const qs of state.quests.active) {
    const o = currentObjective(qs);
    if (o?.kind === 'special' && o.target === target) advance(qs);
  }
}

export function questState(state: GameState, id: string): QuestState | undefined {
  return state.quests.active.find((x) => x.id === id);
}

/** The objective in work (undefined — all done, the quest waits for the turn-in). */
export function currentObjective(qs: QuestState): QuestObjective | undefined {
  return QUESTS[qs.id]?.objectives[qs.step];
}

export function turnInNpc(q: QuestDef): string {
  return q.turnIn ?? q.giver;
}

export function questReady(qs: QuestState): boolean {
  const q = QUESTS[qs.id];
  return !!q && qs.step >= q.objectives.length;
}

/** Quests this NPC can give now: requirements met, not taken, not done (unless repeatable). */
export function questsOffered(state: GameState, npcId: string): QuestDef[] {
  return Object.values(QUESTS).filter((q) => {
    if (q.giver !== npcId || !questPlayable(q) || questState(state, q.id)) return false;
    if (state.quests.done.includes(q.id) && !q.repeatable) return false;
    const r = q.requires;
    if (r?.quests?.some((id) => !state.quests.done.includes(id))) return false;
    if (r?.level && state.hero.level < r.level) return false;
    if (r?.flag === 'siegeActive' ? state.siege === 'none' : r?.flag && !state[r.flag]) return false;
    // A class quest is for that class only.
    if (q.classId && state.hero.classId !== q.classId) return false;
    if (r?.captured && state.capturedRegion !== r.captured) return false;
    return true;
  });
}

export function startQuest(state: GameState, id: string): void {
  if (!QUESTS[id] || questState(state, id)) return;
  state.quests.active.push({ id, step: 0, count: 0 });
  // An arrival objective may be met already (the hero stands there), the trophies may be in the bag.
  questsArrive(state, state.currentNodeId);
  questsBring(state);
}

/**
 * "Bring" objectives (ROADMAP 14.1): once the bag holds enough of the trophy, the quest
 * puts them aside (they leave the bag) and goes on. The counter shows what is collected.
 */
export function questsBring(state: GameState): void {
  const bag = state.hero.trophies;
  for (const qs of state.quests.active) {
    for (let guard = 0; guard < 4; guard++) {
      const o = currentObjective(qs);
      if (o?.kind !== 'bring') break;
      const need = o.count ?? 1;
      const have = bag[o.target] ?? 0;
      qs.count = Math.min(need, have);
      if (have < need) break;
      if (have === need) delete bag[o.target];
      else bag[o.target] = have - need;
      advance(qs);
    }
  }
}

function advance(qs: QuestState): void {
  qs.step += 1;
  qs.count = 0;
}

/** The hero is at a node: "reach" objectives there are met. */
export function questsArrive(state: GameState, nodeId: string): void {
  for (const qs of state.quests.active) {
    const o = currentObjective(qs);
    if (o?.kind === 'reach' && o.target === nodeId) advance(qs);
  }
}

/** What a finished battle did for the quests. */
export interface BattleOutcomeForQuests {
  nodeId: string;
  won: boolean;
  transit: boolean;
  isBoss: boolean;
  killsById: Record<string, number>;
  minibossKills: number;
}

export function questsAfterBattle(state: GameState, r: BattleOutcomeForQuests): void {
  for (const qs of state.quests.active) {
    // Several objectives in a row may be met by one battle (kill wolves, then clear the place).
    for (let guard = 0; guard < 4; guard++) {
      const o = currentObjective(qs);
      if (!o) break;
      if (o.kind === 'kill' && (!o.where || o.where === r.nodeId)) {
        const n = o.target === 'any' ? Object.values(r.killsById).reduce((a, x) => a + x, 0) : (r.killsById[o.target] ?? 0);
        qs.count = Math.min(o.count ?? 1, qs.count + n);
        if (qs.count >= (o.count ?? 1)) advance(qs);
        break;
      } else if (o.kind === 'killMiniboss' && o.target === r.nodeId && r.minibossKills > 0) advance(qs);
      else if (o.kind === 'killBoss' && o.target === r.nodeId && r.won && r.isBoss) advance(qs);
      else if (o.kind === 'clear' && o.target === r.nodeId && r.won && !r.transit) advance(qs);
      else break;
    }
  }
  questsBring(state);
}

/** Gives the quest's rewards and closes it; a short list of what was given. */
export function completeQuest(state: GameState, id: string): string[] {
  const q = QUESTS[id];
  const i = state.quests.active.findIndex((x) => x.id === id);
  if (!q || i < 0) return [];
  state.quests.active.splice(i, 1);
  if (!state.quests.done.includes(id)) state.quests.done.push(id);
  return giveReward(state, q);
}

function giveReward(state: GameState, q: QuestDef): string[] {
  const r = q.reward;
  const out: string[] = [];
  if (r.gold) {
    state.gold += r.gold;
    out.push(`${r.gold} зол.`);
  }
  if (r.item) {
    const [lo, hi] = merchantItemLevels(state);
    const item = rollItem(state.lootRng, r.item, state.nextItemUid++, undefined, Math.round((lo + hi) / 2), state.hero.classId);
    stashLoot(state.hero, item);
    out.push(`річ (${RARITIES[r.item].name.toLowerCase()})`);
  }
  if (r.lives) {
    const before = state.lives;
    state.lives = Math.min(LIVES.max, state.lives + r.lives);
    if (state.lives > before) out.push(`+${state.lives - before} життя`);
  }
  if (r.talentPoints) {
    state.talentPoints += r.talentPoints;
    out.push(`${r.talentPoints} очк. таланту`);
  }
  if (r.runeStones) {
    state.runeStones += r.runeStones;
    out.push(`${r.runeStones} рунічні камені`);
  }
  if (r.gift) {
    state.modalQueue.push({ kind: 'gift', rarity: r.gift });
    out.push('дар');
  }
  if (r.reclaim && state.capturedRegion === r.reclaim) {
    state.capturedRegion = null;
    out.push('край відбито');
  }
  if (r.unlock) out.push(fillNames(r.unlock));
  return out;
}

// ---- Texts ----

const nodeName = (id: string): string => resolveName('loc', id) ?? resolveName('town', id) ?? id;
const npcName = (id: string): string => resolveName('npc', id) ?? id;

/** What to do now, in one line (journal, map hint). */
export function objectiveText(o: QuestObjective, count = 0): string {
  switch (o.kind) {
    case 'kill': {
      const who = o.target === 'any' ? 'ворогів' : (resolveName('enemy', o.target) ?? o.target);
      return `Убити: ${who} — ${count}/${o.count ?? 1}${o.where ? ` (${nodeName(o.where)})` : ''}`;
    }
    case 'killMiniboss':
      return `Перемогти мінібоса: ${nodeName(o.target)}`;
    case 'killBoss':
      return `Перемогти боса: ${nodeName(o.target)}`;
    case 'clear':
      return `Пройти локацію: ${nodeName(o.target)}`;
    case 'reach':
      return `Дійти до: ${nodeName(o.target)}`;
    case 'deliver':
      return `Віднести посилку: ${npcName(o.target)}`;
    case 'talk':
      return `Поговорити: ${npcName(o.target)}`;
    case 'bring':
      return `Зібрати: ${resolveName('trophy', o.target) ?? o.target} — ${count}/${o.count ?? 1}`;
    default:
      return o.text ? fillNames(o.text) : o.target;
  }
}

/** Map nodes the active quests point at: where to go next (map hints). */
export function questTargets(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const qs of state.quests.active) {
    const q = QUESTS[qs.id]!;
    const o = currentObjective(qs);
    if (!o) {
      const town = npcTown(turnInNpc(q));
      if (town) out.add(town);
    } else if (o.kind === 'talk' || o.kind === 'deliver') {
      const town = npcTown(o.target);
      if (town) out.add(town);
    } else if (o.kind === 'kill') {
      if (o.where) out.add(o.where);
    } else if (state.world.nodes.some((n) => n.id === o.target)) out.add(o.target);
  }
  return out;
}

/** The town an NPC lives in (set by the app from the town layouts; tests may leave it). */
let npcTown: (npcId: string) => string | null = () => null;
export function setNpcTownLookup(fn: (npcId: string) => string | null): void {
  npcTown = fn;
}

/** The mark over an NPC in town: '?' — something to report, '!' — a quest to take. */
export function npcMark(state: GameState, npcId: string): '!' | '?' | null {
  for (const qs of state.quests.active) {
    const q = QUESTS[qs.id]!;
    const o = currentObjective(qs);
    if (!o && turnInNpc(q) === npcId) return '?';
    if (o && (o.kind === 'talk' || o.kind === 'deliver') && o.target === npcId) return '?';
  }
  return questsOffered(state, npcId).length > 0 ? '!' : null;
}

// ---- Conversations ----

function finish(state: GameState, q: QuestDef): void {
  const got = completeQuest(state, q.id);
  state.events.emit({ type: 'questDone', name: fillNames(q.name), reward: got });
}

/**
 * The NPC's conversation with the quest options on its first node: turn-ins and talk
 * objectives first, then offers. Choosing them changes the quest state (and closes the
 * talk, so the options are fresh next time).
 */
export function withQuests(npc: NpcDef, state: GameState): NpcDef {
  const nodes: Record<string, DialogueNode> = { ...npc.nodes };
  const extra: DialogueOption[] = [];
  for (const qs of state.quests.active) {
    const q = QUESTS[qs.id]!;
    const o = currentObjective(qs);
    if (!o && turnInNpc(q) === npc.id) {
      const id = `quest:${q.id}:done`;
      nodes[id] = { text: q.done, options: [{ text: NPC_LINES.thanks, action: 'close', run: () => finish(state, q) }] };
      extra.push({ text: `✔ ${fillNames(q.name)}`, next: id });
    } else if (o && (o.kind === 'talk' || o.kind === 'deliver') && o.target === npc.id) {
      const id = `quest:${q.id}:talk${qs.step}`;
      // The last step is a talk with the turn-in NPC: that talk ends the quest.
      const last = qs.step === q.objectives.length - 1 && turnInNpc(q) === npc.id;
      nodes[id] = last
        ? { text: q.done, options: [{ text: NPC_LINES.thanks, action: 'close', run: () => (advance(qs), finish(state, q)) }] }
        : { text: o.text ?? (o.kind === 'deliver' ? QUEST_LINES.delivered : QUEST_LINES.talked), options: [{ text: QUEST_LINES.understood, action: 'close', run: () => advance(qs) }] };
      extra.push({ text: `💬 ${fillNames(q.name)}`, next: id });
    }
  }
  for (const q of questsOffered(state, npc.id)) {
    const id = `quest:${q.id}:offer`;
    nodes[id] = {
      text: q.offer,
      options: [
        { text: QUEST_LINES.accept, action: 'close', run: () => startQuest(state, q.id) },
        { text: QUEST_LINES.later, next: npc.start },
      ],
    };
    extra.push({ text: `❗ ${fillNames(q.name)}`, next: id });
  }
  if (extra.length === 0) return npc;
  const start = nodes[npc.start]!;
  // "Any errands for me?" — "Not now" makes no sense next to the real quests.
  const rest = start.options.filter((o) => o.text !== NPC_LINES.askQuest);
  nodes[npc.start] = { ...start, options: [...extra, ...rest] };
  return { ...npc, nodes };
}
