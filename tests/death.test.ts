import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { LIVES } from '../src/data/balance';
import { WAKE } from '../src/data/death';
import { resolveName } from '../src/data/names';
import { createBattle } from '../src/systems/battle';
import { damageHero } from '../src/systems/combat';
import { wakeTalk } from '../src/systems/death';
import { rollItem } from '../src/systems/items';
import { getNode } from '../src/systems/mapgen';
import { makeGrave, readMeta, records } from '../src/systems/meta';
import { completeBattle, createGameState, restInTown, restoreCheckpoint, teleport } from '../src/systems/run';
import { fromSave, readSave, toSave, writeSave } from '../src/systems/save';

function lostBattle(seed = 7) {
  const s = createGameState(seed, 'Ярина');
  restInTown(s);
  teleport(s, 'quietGrove');
  const b = createBattle(s, 'quietGrove');
  const item = rollItem(new Rng(1), 'rare', 999);
  b.stats.loot.push(item);
  b.stats.gold = 40;
  s.hero.bag.push(item);
  b.outcome = 'lost';
  b.deathCause = { kind: 'melee', by: 'wolf' };
  return { s, b, item };
}

describe('death and lives', () => {
  it('a lost battle takes a life at once and writes the save', () => {
    const { s, b } = lostBattle();
    let writes = 0;
    s.events.on('checkpoint', () => writes++);
    const sum = completeBattle(s, b);
    expect(s.lives).toBe(LIVES.start - 1);
    expect(sum.lives).toBe(LIVES.start - 1);
    expect(writes).toBe(1);
    // Closing the game now and loading: the life is still gone, the doctor still waits.
    const loaded = fromSave(readSave(writeSave(toSave(s)))!);
    expect(loaded.lives).toBe(LIVES.start - 1);
    expect(loaded.lastDeath).toMatchObject({ nodeId: 'quietGrove', cause: { kind: 'melee', by: 'wolf' }, lostLoot: true });
    // Waking up keeps the lost life.
    restoreCheckpoint(s);
    expect(s.lives).toBe(LIVES.start - 1);
  });

  it('the loot of the lost battle stays in the location until it is cleared again', () => {
    const { s, b, item } = lostBattle();
    completeBattle(s, b);
    restoreCheckpoint(s);
    expect(s.hero.bag.some((x) => x.uid === item.uid)).toBe(false);
    expect(getNode(s.world, 'quietGrove').lostLoot?.items.map((x) => x.uid)).toEqual([item.uid]);
    const gold = s.gold;
    teleport(s, 'quietGrove');
    const again = createBattle(s, 'quietGrove');
    again.outcome = 'won';
    const sum = completeBattle(s, again);
    expect(sum.recovered?.items.map((x) => x.uid)).toEqual([item.uid]);
    expect(s.hero.bag.some((x) => x.uid === item.uid)).toBe(true);
    expect(s.gold).toBeGreaterThanOrEqual(gold + 40);
    expect(getNode(s.world, 'quietGrove').lostLoot).toBeNull();
  });

  it('the last blow is remembered: who struck it', () => {
    const s = createGameState(3);
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove');
    s.hero.hp = 1;
    const wolf = { defId: 'wolf', dead: false, boss: null } as unknown as Parameters<typeof damageHero>[2]['attacker'];
    damageHero(b, 1000, { melee: false, attacker: wolf });
    expect(b.hero.dead).toBe(true);
    expect(b.deathCause).toEqual({ kind: 'melee', by: 'wolf' });
  });

  it('the doctor tells the place, the killer and the lives left', () => {
    const { s, b } = lostBattle();
    completeBattle(s, b);
    restoreCheckpoint(s);
    const talk = wakeTalk(s, s.lastDeath!);
    const first = talk.nodes[talk.start]!.text;
    expect(first).toContain(getNode(s.world, 'quietGrove').name);
    expect(first).toContain(resolveName('enemy', 'wolf')!);
    const after = Object.values(talk.nodes).map((n) => n.text).join(' ');
    expect(after).toContain(String(s.lives));
    expect(after).toContain(WAKE.lostLoot);
  });

  it('the last life: a death leaves none', () => {
    const { s, b } = lostBattle();
    s.lives = 1;
    completeBattle(s, b);
    expect(s.lives).toBe(0);
  });
});

describe('graves and records', () => {
  it('a grave keeps the hero, where the story ended and how', () => {
    const { s, b } = lostBattle();
    s.lives = 1;
    completeBattle(s, b);
    const g = makeGrave(s, { abandoned: false, now: 5 });
    expect(g).toMatchObject({ name: 'Ярина', level: s.hero.level, nodeId: 'quietGrove', cause: { kind: 'melee', by: 'wolf' }, abandoned: false, date: 5 });
  });

  it('broken meta starts empty; records pick the best hero', () => {
    expect(readMeta('oops').graves).toEqual([]);
    expect(readMeta(null).graves).toEqual([]);
    const s = createGameState(1, 'А');
    const a = makeGrave(s, { abandoned: true });
    const bState = createGameState(2, 'Б');
    bState.hero.level = 9;
    bState.day = 30;
    const g2 = makeGrave(bState, { abandoned: false });
    const meta = readMeta(JSON.stringify({ version: 1, graves: [a, g2] }));
    const r = records(meta);
    expect(r.heroes).toBe(2);
    expect(r.bestLevel?.name).toBe('Б');
    expect(r.mostDays?.name).toBe('Б');
  });
});
