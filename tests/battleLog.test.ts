import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/systems/battle';
import { BATTLE_LOG_MAX, type BattleRecord, battleRecord, pushRecord, summarize } from '../src/systems/battleLog';
import { gainConsumable } from '../src/systems/items';
import { emptyMeta, readMeta, statsExport } from '../src/systems/meta';
import { useHealItem } from '../src/systems/pickups';
import { createGameState, teleport } from '../src/systems/run';

describe('battle statistics', () => {
  it('a record keeps the place, the hero, the result, time, damage and potions', () => {
    const s = createGameState(4, 'Ярина');
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove');
    gainConsumable(s.hero, 'herbGreen');
    s.hero.hp = 1;
    expect(useHealItem(b, 'herbGreen')).toBe(true);
    b.time = 31.27;
    b.stats.damageTaken = 99.6;
    b.outcome = 'lost';
    b.deathCause = { kind: 'trap' };
    const r = battleRecord(s, b, 7);
    expect(r).toMatchObject({ node: 'quietGrove', hero: 'Ярина', level: 1, won: false, time: 31.3, damageTaken: 100, heals: 1, cause: { kind: 'trap' }, date: 7 });
  });

  it('the log keeps the newest records up to the limit', () => {
    const log: BattleRecord[] = [];
    const r = { node: 'x', date: 0 } as BattleRecord;
    for (let i = 0; i < BATTLE_LOG_MAX + 5; i++) pushRecord(log, { ...r, date: i });
    expect(log).toHaveLength(BATTLE_LOG_MAX);
    expect(log[0]!.date).toBe(5);
  });

  it('summary per location: battles, wins, averages', () => {
    const base = { tier: 1, hero: 'a', classId: null, day: 1, damageDealt: 0, kills: 0, waves: 0, cause: null, date: 0 };
    const log: BattleRecord[] = [
      { ...base, node: 'a', won: true, time: 10, damageTaken: 100, heals: 2, level: 2 },
      { ...base, node: 'a', won: false, time: 30, damageTaken: 300, heals: 0, level: 4 },
      { ...base, node: 'b', won: true, time: 5, damageTaken: 0, heals: 0, level: 1 },
    ];
    const a = summarize(log).find((x) => x.node === 'a')!;
    expect(a).toMatchObject({ battles: 2, wins: 1, deaths: 1, avgTime: 20, avgDamageTaken: 200, avgHeals: 1, avgLevel: 3 });
  });

  it('statistics survive the meta save and go out as a file', () => {
    const meta = emptyMeta();
    meta.battles.push({ node: 'quietGrove' } as BattleRecord);
    expect(readMeta(JSON.stringify(meta)).battles).toHaveLength(1);
    const file = JSON.parse(statsExport(meta, '1.0.0', 3));
    expect(file).toMatchObject({ kind: 'expedition-stats', gameVersion: '1.0.0', exportedAt: 3 });
    expect(file.battles).toHaveLength(1);
  });
});
