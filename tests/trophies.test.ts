import { describe, expect, it } from 'vitest';
import { TROPHIES } from '../src/data/trophies';
import { createBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { killEnemy } from '../src/systems/combat';
import { currentObjective, questPlayable, questsBring, startQuest } from '../src/systems/quests';
import { QUESTS } from '../src/data/quests';
import { createGameState, saveCheckpoint, teleport } from '../src/systems/run';
import { SAVE_VERSION, fromSave, readSave, toSave } from '../src/systems/save';
import { addTrophy, rollRelics, sellTrophies, trophiesOf, trophySale } from '../src/systems/trophies';
import { spawnEnemy } from '../src/systems/waves';

function grove() {
  const s = createGameState(11);
  s.hero.immortal = true;
  teleport(s, 'quietGrove');
  const b = createBattle(s, 'quietGrove');
  b.waves = null;
  return { s, b };
}

describe('trophies', () => {
  it('every enemy kind drops only its own trophy, about as often as its chance; summoned ones drop none', () => {
    const { s, b } = grove();
    const pelt = trophiesOf('wolf')[0]!;
    const n = 400;
    for (let i = 0; i < n; i++) killEnemy(b, spawnEnemy(b, 'wolf', { x: 500, y: 300 }));
    const got = s.hero.trophies[pelt.id] ?? 0;
    expect(got).toBeGreaterThan(n * pelt.chance * 0.5);
    expect(got).toBeLessThan(n * pelt.chance * 1.5);
    expect(Object.keys(s.hero.trophies)).toEqual([pelt.id]);
    expect(b.stats.trophies[pelt.id]).toBe(got);
    s.hero.trophies = {};
    for (let i = 0; i < 200; i++) killEnemy(b, spawnEnemy(b, 'wolf', { x: 500, y: 300 }, false, true));
    expect(s.hero.trophies).toEqual({});
  });

  it('a boss always drops its trophy; a miniboss — its rare one, sometimes', () => {
    const { s, b } = grove();
    const enat = trophiesOf('enat')[0]!;
    expect(enat.kind).toBe('boss');
    killEnemy(b, createBossEnemy(b, 'enat', { x: 500, y: 300 }));
    expect(s.hero.trophies[enat.id]).toBe(1);
    const alpha = trophiesOf('alpha')[0]!;
    for (let i = 0; i < 40; i++) killEnemy(b, createBossEnemy(b, 'alpha', { x: 500, y: 300 }));
    expect(s.hero.trophies[alpha.id] ?? 0).toBeGreaterThan(0);
  });

  it('relics come from the treasure of their own region only', () => {
    const { s, b } = grove();
    for (let i = 0; i < 100; i++) rollRelics(b);
    const got = Object.keys(s.hero.trophies);
    expect(got.length).toBeGreaterThan(0);
    for (const id of got) {
      expect(TROPHIES[id]!.kind).toBe('relic');
      expect(TROPHIES[id]!.from).toContain('forest');
    }
  });

  it('a merchant buys every trophy at its price but keeps what the quests collect', () => {
    const s = createGameState(2);
    addTrophy(s, 'wolfPelt', 5);
    addTrophy(s, 'sporeCap', 3);
    s.quests.active.push({ id: 'linkFurs', step: 0, count: 0 });
    const sale = trophySale(s);
    expect(sale.count).toBe(3);
    const gold = s.gold;
    expect(sellTrophies(s)).toBe(3 * TROPHIES.sporeCap!.price);
    expect(s.gold).toBe(gold + sale.gold);
    expect(s.hero.trophies).toEqual({ wolfPelt: 5 });
  });

  it('"bring" quests are playable: once the bag holds enough, the quest takes them and goes on', () => {
    expect(questPlayable(QUESTS.linkFurs!)).toBe(true);
    const s = createGameState(2);
    const need = QUESTS.linkFurs!.objectives[0]!.count!;
    addTrophy(s, 'wolfPelt', need - 1);
    startQuest(s, 'linkFurs');
    const qs = s.quests.active.find((q) => q.id === 'linkFurs')!;
    expect(currentObjective(qs)?.kind).toBe('bring');
    expect(qs.count).toBe(need - 1);
    // A battle brings the last ones (any battle end checks the bag).
    addTrophy(s, 'wolfPelt', 2);
    questsBring(s);
    expect(currentObjective(qs)?.kind).toBe('deliver');
    expect(s.hero.trophies.wolfPelt).toBe(1);
  });

  it('saves keep the trophies; an old save gets an empty bag of them', () => {
    const s = createGameState(3);
    addTrophy(s, 'wolfPelt', 4);
    saveCheckpoint(s);
    const data = toSave(s);
    expect(fromSave(readSave(JSON.stringify(data))!).hero.trophies).toEqual({ wolfPelt: 4 });
    const old = { ...data, version: 3, hero: { ...data.hero, trophies: undefined } };
    const read = readSave(JSON.stringify(old))!;
    expect(read.version).toBe(SAVE_VERSION);
    expect(fromSave(read).hero.trophies).toEqual({});
  });
});
