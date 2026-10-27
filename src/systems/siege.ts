// The siege of the capital (ROADMAP 17): it begins when the invasion reaches 100% or when the
// last boss of the lands falls. Entering the capital then means the battle on its square:
// waves of the dead with the detachments of every boss still alive, then {name:lord} himself.
// His fall ends the campaign. The battle is fought on a node of its own that is not on the
// map (and never counts among the bosses of the lands).

import type { GameState } from '../core/state';
import { INVASION_EVENTS } from '../data/invasion';
import { SIEGE } from '../data/siege';
import { CAPITAL_ID, WORLD_NODES } from '../data/world';
import { BIOMES } from '../data/biomes';
import { type Battle, createBattle } from './battle';
import { type MapNode, nodeFromDef } from './mapgen';
import { questsSpecial } from './quests';
import { type BattleSummary, completeBattle } from './run';
import { invasionPct } from './scaling';
import { townDefense } from './growth';

/** The bosses of the lands still alive (their detachments come to the siege). */
export function bossesAlive(state: GameState): MapNode[] {
  return state.world.nodes.filter((n) => n.isBoss && !state.bossesDefeated.includes(n.id));
}

/** Starts the siege when it is due: the invasion at 100% or no boss of the lands left. */
export function checkSiege(state: GameState): void {
  if (state.siege !== 'none') return;
  const due = (!state.noInvasion && invasionPct(state.day) >= 100) || bossesAlive(state).length === 0;
  if (!due) return;
  state.siege = 'active';
  const alive = bossesAlive(state).length;
  state.invasionNews.push({
    title: 'Облога столиці',
    text:
      alive > 0
        ? `Мертві під стінами {town:capital:of}! З ними — загони ${alive} охоронців краю, яких ще не звільнено. Варта чекає на тебе.`
        : 'Мертві під стінами {town:capital:of}! Усі охоронці краю звільнені — з мертвими йде лише {name:lord}. Варта чекає на тебе.',
  });
}

/** The monsters of the siege: the dead and a detachment of every boss still alive. */
export function siegeRoster(state: GameState): string[] {
  const roster = Array<string>(SIEGE.deadShare).fill(INVASION_EVENTS.raid.raider);
  for (const boss of bossesAlive(state)) roster.push(...(BIOMES[boss.biome]?.enemies ?? []).slice(0, SIEGE.detachment));
  return roster;
}

/** The node of a siege battle: the square (waves) or the lord's fight. */
function siegeNode(state: GameState, lord: boolean): MapNode {
  const capital = WORLD_NODES.find((n) => n.id === CAPITAL_ID)!;
  return nodeFromDef({
    id: 'siege',
    name: 'Облога столиці',
    kind: lord ? 'boss' : 'location',
    biome: capital.biome,
    region: capital.region,
    level: SIEGE.level,
    pos: capital.pos,
    description: '',
    enemies: siegeRoster(state),
    miniboss: '',
    boss: SIEGE.boss,
  });
}

/** The battle of a siege step: the waves on the square, then the lord. */
export function siegeBattle(state: GameState, step: 'waves' | 'lord'): Battle {
  const node = siegeNode(state, step === 'lord');
  // The capital's walls, if it has grown, shorten the waves (ROADMAP 17.4).
  const waves = Math.max(1, SIEGE.waves - townDefense(state, CAPITAL_ID));
  const b = createBattle(state, node.id, 0, false, step === 'lord' ? undefined : { waves, miniboss: false, boss: false }, node);
  b.raid = step === 'waves';
  b.siege = step;
  return b;
}

/** A siege battle over: the lord's fall wins the campaign. */
export function finishSiege(state: GameState, b: Battle): BattleSummary {
  const summary = completeBattle(state, b, { final: false });
  if (b.outcome === 'won' && b.siege === 'lord') {
    state.siege = 'won';
    questsSpecial(state, 'siege');
    summary.runCompleted = true;
  }
  return summary;
}
