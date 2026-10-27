// The invasion's events (ROADMAP 15.2), checked whenever a day passes: raids on cleared
// locations (driven off by clearing them, or the location falls), a captured land (its quest
// wins it back) and an attack on a town (a battle at its gates when the hero comes).

import { townDefense } from './growth';
import type { GameState } from '../core/state';
import { INVASION_EVENTS } from '../data/invasion';
import { fillNames } from '../data/names';
import { type Battle, createBattle } from './battle';
import { getNode, type MapNode, resetClears } from './mapgen';
import { type BattleSummary, completeBattle } from './run';
import { clearBonusGold, invasionPct } from './scaling';

/** The land the invasion goes for: the first (in the events' order) whose boss still lives. */
function targetLand(state: GameState): string | null {
  for (const region of Object.keys(INVASION_EVENTS.captured.quests)) {
    const boss = state.world.nodes.find((n) => n.isBoss && n.region === region);
    if (boss && !state.bossesDefeated.includes(boss.id)) return region;
  }
  return null;
}

/** The front of the raids: the land of the weakest boss still alive (where the hero fights now). */
export function raidLand(state: GameState): string | null {
  const alive = state.world.nodes.filter((n) => n.isBoss && !state.bossesDefeated.includes(n.id)).sort((a, b) => a.level - b.level);
  return alive[0]?.region ?? null;
}

function townOf(state: GameState, region: string): MapNode | undefined {
  return state.world.nodes.find((n) => n.isTown && n.region === region);
}

function news(state: GameState, title: string, text: string): void {
  state.invasionNews.push({ title, text: fillNames(text) });
}

/** A day passed: new raids, fallen locations, the captured land, the attacked town. */
export function invasionTick(state: GameState, here: string): void {
  if (state.noInvasion) return;
  const pct = invasionPct(state.day);
  const ev = INVASION_EVENTS;
  // Raids not driven off in time: the location falls.
  for (const [id, start] of Object.entries(state.raids)) {
    if (state.day - start < ev.raid.days) continue;
    delete state.raids[id];
    const node = getNode(state.world, id);
    resetClears(node);
    news(state, 'Локацію втрачено', `Мерці закріпилися в локації «${node.name}». Її доведеться пройти знову.`);
  }
  // A new raid every few days on a cleared location of the front.
  const front = raidLand(state);
  if (front && pct >= ev.raid.from && state.day - state.lastRaidDay >= ev.raid.every) {
    const pool = state.world.nodes.filter((n) => n.region === front && !n.isTown && !n.isBoss && n.timesCleared > 0 && n.id !== here && state.raids[n.id] === undefined);
    if (pool.length > 0) {
      const node = state.rng.pick(pool);
      state.raids[node.id] = state.day;
      state.lastRaidDay = state.day;
      news(state, 'Набіг!', `Мерці напали на «${node.name}». Відбий їх за ${ev.raid.days} днів — інакше локація впаде.`);
    }
  }
  // The land is captured (once).
  if (pct >= ev.captured.at && !state.invasionEventsDone.includes(ev.captured.at)) {
    state.invasionEventsDone.push(ev.captured.at);
    const land = targetLand(state);
    if (land) {
      state.capturedRegion = land;
      const town = townOf(state, land);
      news(state, 'Край захоплено', `Мерці захопили край навколо ${town ? `«${town.name}»` : 'міста'}: звірі там сильніші. Староста просить допомоги.`);
    }
  }
  // A town is attacked (once).
  if (pct >= ev.townAttack.at && !state.invasionEventsDone.includes(ev.townAttack.at)) {
    state.invasionEventsDone.push(ev.townAttack.at);
    const land = state.capturedRegion ?? targetLand(state);
    const town = land ? townOf(state, land) : undefined;
    if (town) {
      state.townAttack = town.id;
      news(state, 'Напад на місто', `Мерці під брамою «${town.name}». Поспішай: бій почнеться біля воріт.`);
    }
  }
}

/** Enemies here are the invasion's: a raided location or a captured land. */
export function invaded(state: GameState, node: MapNode): boolean {
  return state.raids[node.id] !== undefined || (state.capturedRegion !== null && node.region === state.capturedRegion && !node.isBoss);
}

/** The location is cleared: its raid is driven off (gold); false — there was none. */
export function driveOffRaid(state: GameState, node: MapNode, tier: number): number {
  if (state.raids[node.id] === undefined) return 0;
  delete state.raids[node.id];
  const gold = Math.round(clearBonusGold(tier) * INVASION_EVENTS.raid.gold);
  state.gold += gold;
  news(state, 'Набіг відбито', `«${node.name}» знову вільна. Нагорода: ${gold} зол.`);
  return gold;
}

/** The battle at the gates of a town under attack: waves of the land's beasts and the dead. */
export function defenseBattle(state: GameState, townId: string): Battle {
  const town = getNode(state.world, townId);
  const near = state.world.nodes.filter((n) => !n.isTown && !n.isBoss && n.region === town.region).sort((a, b) => a.level - b.level)[0];
  if (!near) throw new Error(`No location near ${townId}`);
  // A grown town's palisade shortens the battle (ROADMAP 15.4).
  const waves = Math.max(1, INVASION_EVENTS.townAttack.waves - townDefense(state, townId));
  const b = createBattle(state, near.id, 0, false, { waves, miniboss: false, boss: false });
  b.raid = true;
  b.defense = townId;
  return b;
}

/** The gates held (or not): the attack is over when won. */
export function finishDefense(state: GameState, b: Battle): BattleSummary {
  const summary = completeBattle(state, b, { final: false });
  if (b.outcome === 'won') {
    state.townAttack = null;
    state.gold += INVASION_EVENTS.townAttack.gold;
    summary.gold += INVASION_EVENTS.townAttack.gold;
    if (state.hero.classId) state.modalQueue.push({ kind: 'gift', rarity: 'rare' });
  }
  return summary;
}
