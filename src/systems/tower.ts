// The Endless tower (ROADMAP 18): after the siege. A climb starts on the last boss floor
// beaten (+1) and goes floor by floor (HP stays between them) until the hero walks back to
// the town or falls. Boss floors carry modifiers; the 100th is the lord — the true finale.

import type { GameState } from '../core/state';
import { BIOMES } from '../data/biomes';
import { TOWER } from '../data/tower';
import { ARENAS } from '../data/arenas';
import { CAPITAL_ID, WORLD_NODES } from '../data/world';
import { type Battle, createBattle } from './battle';
import { type MapNode, nodeFromDef } from './mapgen';
import { questsSpecial } from './quests';
import { type BattleSummary, completeBattle } from './run';

export function towerOpen(state: GameState): boolean {
  return state.siege === 'won';
}

/** The floor a new climb starts on: the one after the last boss floor beaten. */
export function towerStart(state: GameState): number {
  return state.tower.checkpoint + 1;
}

export function isBossFloor(floor: number): boolean {
  return floor % TOWER.bossEvery === 0;
}

export function floorLevel(floor: number): number {
  return Math.round(TOWER.level0 + TOWER.levelPerFloor * floor);
}

/** The land of a floor (its monsters and arena). */
export function floorLand(floor: number): string {
  return TOWER.lands[(floor - 1) % TOWER.lands.length]!;
}

/** The boss of a boss floor. */
export function floorBoss(floor: number): string {
  if (floor >= TOWER.floors) return TOWER.finalBoss;
  return TOWER.bosses[(floor / TOWER.bossEvery - 1) % TOWER.bosses.length]!;
}

/** Modifiers of a boss floor: one, and one more every `modifierEvery` floors (the order is fixed by the floor). */
export function floorModifiers(floor: number): string[] {
  if (!isBossFloor(floor)) return [];
  const all = Object.keys(TOWER.modifiers);
  const n = Math.min(all.length, 1 + Math.floor(floor / TOWER.modifierEvery));
  const start = (floor / TOWER.bossEvery) % all.length;
  return Array.from({ length: n }, (_, i) => all[(start + i) % all.length]!);
}

/** The arena of a floor: a location of its land (by the floor), a boss floor — a lair. */
function floorArena(floor: number, land: string, boss: string | null): string {
  const lair = boss ? WORLD_NODES.find((n) => n.kind === 'boss' && n.boss === boss) : undefined;
  if (lair && ARENAS[lair.id]) return lair.id;
  const places = WORLD_NODES.filter((n) => n.kind === 'location' && n.biome === land && !n.secret && ARENAS[n.id]);
  return places[floor % Math.max(1, places.length)]?.id ?? 'siege';
}

function floorNode(floor: number): { node: MapNode; arena: string } {
  const land = floorLand(floor);
  const boss = isBossFloor(floor) ? floorBoss(floor) : null;
  const capital = WORLD_NODES.find((n) => n.id === CAPITAL_ID)!;
  const node = nodeFromDef({
    id: 'tower',
    name: `Вежа · поверх ${floor}`,
    kind: boss ? 'boss' : 'location',
    biome: land,
    region: 'tower',
    level: floorLevel(floor),
    pos: capital.pos,
    description: '',
    enemies: [...(BIOMES[land]?.enemies ?? [])],
    miniboss: '',
    boss: boss ?? '',
  });
  return { node, arena: floorArena(floor, land, boss) };
}

/** The battle of a floor. */
export function towerBattle(state: GameState, floor: number): Battle {
  const { node, arena } = floorNode(floor);
  const b = createBattle(state, node.id, 0, false, isBossFloor(floor) ? { waves: 0, miniboss: false, arena } : { waves: TOWER.waves, miniboss: false, boss: false, arena }, node);
  b.towerFloor = floor;
  // The boss floor's modifiers.
  if (b.boss) {
    const mods = floorModifiers(floor).map((id) => TOWER.modifiers[id]!);
    for (const m of mods) {
      b.boss.maxHp *= m.hp ?? 1;
      b.boss.damage *= m.damage ?? 1;
      b.boss.speed *= m.speed ?? 1;
    }
    b.boss.hp = b.boss.maxHp;
    if (mods.length > 0) b.boss.name = `${b.boss.name} (${mods.map((m) => m.name.toLowerCase()).join(', ')})`;
  }
  return b;
}

/** A floor over: the next floor (won), a new checkpoint on a boss floor, the record, the finale. */
export function finishFloor(state: GameState, b: Battle): BattleSummary {
  const summary = completeBattle(state, b, { final: false });
  const floor = b.towerFloor ?? 0;
  if (b.outcome !== 'won') return summary;
  const gold = TOWER.goldPerFloor * floor;
  state.gold += gold;
  summary.gold += gold;
  state.tower.best = Math.max(state.tower.best, floor);
  if (isBossFloor(floor)) {
    state.tower.checkpoint = Math.max(state.tower.checkpoint, floor);
    if (state.hero.classId) state.modalQueue.push({ kind: 'gift', rarity: floor >= TOWER.floors ? 'legendary' : 'rare' });
  }
  if (floor >= TOWER.floors) {
    questsSpecial(state, 'tower100');
    summary.runCompleted = true;
  }
  return summary;
}
