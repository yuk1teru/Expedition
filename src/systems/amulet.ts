// The Amulet of life (ROADMAP 16.6): it exists only for a hero someone died before. It lies in
// one of the secret places; a tombstone on the cemetery tells the land and reveals the place;
// the guarded arena there gives it — one more life.

import type { GameState } from '../core/state';
import { LIVES } from '../data/balance';
import { WORLD_MAP } from '../data/world';
import { revealSecret } from './fog';
import type { MapNode } from './mapgen';
import { questsSpecial } from './quests';
import { clearBonusGold } from './scaling';

/** A new hero: if someone died before, the amulet waits in one of the secret places. */
export function placeAmulet(state: GameState, someoneDied: boolean): void {
  const places = state.world.nodes.filter((n) => n.secret);
  state.amulet = someoneDied && places.length > 0 ? { nodeId: state.rng.pick(places).id, found: false } : null;
  state.amuletHinted = false;
}

/** What a tombstone tells of the amulet (and the place shows on the map); null — nothing to tell. */
export function amuletHint(state: GameState): string | null {
  const a = state.amulet;
  if (!a || a.found) return null;
  const node = state.world.nodes.find((n) => n.id === a.nodeId);
  if (!node) return null;
  revealSecret(state, node.id);
  state.amuletHinted = true;
  const land = WORLD_MAP.regions.find((r) => r.id === node.region)?.name ?? node.region;
  return `У світі мертвих розповідають, що в краї «${land}» лежить Амулет життя — у місці, що зветься «${node.name}». Забери його, щоб не опинитися на моєму місці.`;
}

/** A secret place cleared: the amulet if it lies here, else a forgotten stash of gold. */
export function claimSecret(state: GameState, node: MapNode, tier: number): void {
  const a = state.amulet;
  if (a && !a.found && a.nodeId === node.id) {
    a.found = true;
    state.lives = Math.min(LIVES.max, state.lives + 1);
    questsSpecial(state, 'amulet');
    state.invasionNews.push({ title: 'Амулет життя', text: `У місці «${node.name}» знайдено Амулет життя: +1 життя.` });
    return;
  }
  // The stash is there the first time only (the place is marked cleared after this).
  if (node.timesCleared > 0) return;
  const gold = clearBonusGold(tier) * 2;
  state.gold += gold;
  state.invasionNews.push({ title: 'Схованка', text: `У місці «${node.name}» лежала давня схованка: ${gold} зол.` });
}
