// Death of the hero (ROADMAP 9.4–9.5): a death takes a life at once (the save is written,
// so closing the tab does not undo it), the loot of that battle stays in the location
// until the hero clears it again, and the hero wakes up in the town of the last rest,
// where the doctor tells what happened.

import type { GameState, LastDeath } from '../core/state';
import { WAKE } from '../data/death';
import { resolveName } from '../data/names';
import { type NpcDef, getNpc } from '../data/npcs';
import { CAPITAL_ID } from '../data/world';
import type { Battle } from './battle';
import type { DeathCause } from './combat';
import type { Item } from './items';
import { stashLoot } from './items';
import { type MapNode, getNode } from './mapgen';

/** A lost battle: −1 life, its loot is left in the location, the doctor will talk. */
export function applyDeath(state: GameState, b: Battle): void {
  state.lives = Math.max(0, state.lives - 1);
  const cp = state.checkpoint;
  cp.lives = state.lives;
  // The checkpoint world is the one the hero wakes up in.
  const node = getNode(cp.world, b.node.id);
  const items = structuredClone(b.stats.loot);
  const gold = Math.floor(b.stats.gold);
  const lost = items.length > 0 || gold > 0;
  if (lost) {
    node.lostLoot = { items: [...(node.lostLoot?.items ?? []), ...items], gold: (node.lostLoot?.gold ?? 0) + gold };
  }
  const death: LastDeath = { nodeId: b.node.id, cause: b.deathCause, lostLoot: lost };
  state.lastDeath = death;
  cp.lastDeath = death;
  // Written now: a death cannot be undone by closing the game.
  state.events.emit({ type: 'checkpoint' });
}

/** The doctor has told about the death: it is no longer waiting in the save. */
export function forgetDeath(state: GameState): void {
  state.lastDeath = null;
  state.checkpoint.lastDeath = null;
  state.events.emit({ type: 'checkpoint' });
}

/** A cleared location gives back the loot left there by a death. */
export function recoverLostLoot(state: GameState, node: MapNode): { items: Item[]; gold: number } | null {
  const lost = node.lostLoot;
  if (!lost) return null;
  node.lostLoot = null;
  for (const it of lost.items) stashLoot(state.hero, it);
  state.gold += lost.gold;
  return lost;
}

/** Name of whoever struck: a boss or an enemy (the current name, wiki renames included). */
function killerName(id: string | null): string | null {
  if (!id) return null;
  return resolveName('boss', id) ?? resolveName('enemy', id);
}

function causeLine(cause: DeathCause | null): string {
  const c = WAKE.causes;
  if (!cause) return c.unknown;
  switch (cause.kind) {
    case 'melee': {
      const by = killerName(cause.by);
      return by ? c.melee.replace('{by}', by) : c.unknown;
    }
    case 'shot': {
      const by = killerName(cause.by);
      return by ? c.shotBy.replace('{by}', by) : c.shot;
    }
    case 'telegraph': {
      const by = killerName(cause.by);
      return by ? c.telegraphBy.replace('{by}', by) : c.telegraph;
    }
    case 'hazard':
      return c.hazard;
    case 'trap':
      return c.trap;
    case 'poison':
      return c.poison;
  }
}

/**
 * The doctor's talk after waking up: where the hero was found, what happened, the loot
 * left behind and the lives left. The capital's doctor, a healer in other towns.
 */
export function wakeTalk(state: GameState, death: LastDeath): NpcDef {
  const place = state.world.nodes.find((n) => n.id === death.nodeId)?.name ?? '';
  const who = state.currentNodeId === CAPITAL_ID ? getNpc(WAKE.doctorNpc) : { id: 'healer', ...WAKE.healer };
  const lives = (state.lives <= 1 ? WAKE.lastLife : WAKE.lives).replace('{lives}', String(state.lives));
  return {
    id: who.id,
    name: who.name,
    title: who.title,
    look: who.look,
    start: 'wake',
    nodes: {
      wake: { text: `${WAKE.place.replace('{place}', place)} ${causeLine(death.cause)}`, options: [{ text: WAKE.askQuestion, next: 'after' }] },
      after: { text: death.lostLoot ? `${WAKE.lostLoot} ${lives}` : lives, options: [{ text: WAKE.thanks, action: 'close' }] },
    },
  };
}
