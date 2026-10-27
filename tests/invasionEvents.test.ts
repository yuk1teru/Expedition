import { describe, expect, it } from 'vitest';
import { INVASION_EVENTS } from '../src/data/invasion';
import { QUESTS } from '../src/data/quests';
import { LOOP } from '../src/data/balance';
import { createBattle, killAll, stepBattle } from '../src/systems/battle';
import { defenseBattle, finishDefense, invasionTick } from '../src/systems/invasion';
import { getNode, markCleared } from '../src/systems/mapgen';
import { completeQuest, questsOffered, startQuest } from '../src/systems/quests';
import { completeBattle, createGameState, teleport } from '../src/systems/run';
import { spawnEnemy } from '../src/systems/waves';

const ev = INVASION_EVENTS;
/** The day the scale reaches this percent (it starts at 0% on day 1). */
const dayOf = (pct: number): number => pct + 1;

function played() {
  const s = createGameState(12);
  s.hero.immortal = true;
  for (const id of ['quietGrove', 'wolfTrail', 'mushroomGlade']) markCleared(getNode(s.world, id));
  return s;
}

describe('invasion events (ROADMAP 15.2)', () => {
  it('no raids before the threshold; then raids on cleared locations; a raid not driven off makes the location fall', () => {
    const s = played();
    s.day = dayOf(ev.raid.from) - 1;
    invasionTick(s, 'capital');
    expect(Object.keys(s.raids)).toHaveLength(0);
    s.day = dayOf(ev.raid.from);
    invasionTick(s, 'capital');
    const [id] = Object.keys(s.raids);
    expect(id).toBeDefined();
    const node = getNode(s.world, id!);
    expect(node.timesCleared).toBeGreaterThan(0);
    expect(node.isBoss).toBe(false);
    s.day += ev.raid.days;
    invasionTick(s, 'capital');
    expect(s.raids[id!]).toBeUndefined();
    expect(node.timesCleared).toBe(0);
    expect(s.invasionNews.length).toBeGreaterThan(0);
  });

  it('a raided location: stronger enemies, the dead among them; clearing it drives the raid off for gold', () => {
    const s = played();
    teleport(s, 'quietGrove');
    const calm = createBattle(s, 'quietGrove');
    const a = spawnEnemy(calm, 'wolf', { x: 300, y: 300 });
    s.raids.quietGrove = s.day;
    const raided = createBattle(s, 'quietGrove');
    expect(raided.raid).toBe(true);
    const b = spawnEnemy(raided, 'wolf', { x: 300, y: 300 });
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    let dead = 0;
    for (let t = 0; t < 30 && !raided.finished; t += LOOP.step) {
      stepBattle(raided, LOOP.step);
      dead += raided.enemies.filter((e) => e.defId === ev.raid.raider).length > 0 ? 1 : 0;
      if (raided.waves?.started && raided.waves.queue.length === 0) killAll(raided);
    }
    expect(dead).toBeGreaterThan(0);
    raided.outcome = 'won';
    const gold = s.gold;
    completeBattle(s, raided);
    expect(s.raids.quietGrove).toBeUndefined();
    expect(s.gold).toBeGreaterThan(gold);
  });

  it('at 50% the Forest is captured: the elder offers to win it back, and the quest frees it', () => {
    const s = played();
    s.day = dayOf(ev.captured.at);
    invasionTick(s, 'capital');
    expect(s.capturedRegion).toBe('forest');
    expect(questsOffered(s, 'forestElder').map((q) => q.id)).toContain('reclaimForest');
    startQuest(s, 'reclaimForest');
    s.quests.active.find((q) => q.id === 'reclaimForest')!.step = 99;
    completeQuest(s, 'reclaimForest');
    expect(s.capturedRegion).toBeNull();
  });

  it('at 75% the Forest town is attacked; winning at its gates ends the attack', () => {
    const s = played();
    s.day = dayOf(ev.townAttack.at);
    invasionTick(s, 'capital');
    expect(s.townAttack).toBe('forestTown');
    const b = defenseBattle(s, 'forestTown');
    expect(b.raid).toBe(true);
    expect(b.waves!.total).toBe(ev.townAttack.waves);
    b.outcome = 'won';
    const gold = s.gold;
    finishDefense(s, b);
    expect(s.townAttack).toBeNull();
    expect(s.gold).toBeGreaterThanOrEqual(gold + ev.townAttack.gold);
  });

  it('every land the invasion can capture has a quest that wins it back, from a town of that land', () => {
    for (const [region, id] of Object.entries(ev.captured.quests)) {
      const q = QUESTS[id]!;
      expect(q, id).toBeDefined();
      expect(q.requires?.captured).toBe(region);
      expect(q.reward.reclaim).toBe(region);
    }
  });
});
