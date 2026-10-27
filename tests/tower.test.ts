import { describe, expect, it } from 'vitest';
import { TOWER } from '../src/data/tower';
import { BOSSES } from '../src/data/bosses';
import { ARENA } from '../src/data/balance';
import { ARENAS } from '../src/data/arenas';
import { questState, startQuest } from '../src/systems/quests';
import { createGameState, teleport } from '../src/systems/run';
import { finishFloor, floorLevel, floorModifiers, isBossFloor, towerBattle, towerOpen, towerStart } from '../src/systems/tower';

function climber() {
  const s = createGameState(4);
  s.hero.immortal = true;
  s.siege = 'won';
  teleport(s, 'capital');
  return s;
}

describe('the Endless tower (ROADMAP 18)', () => {
  it('opens after the siege; a climb starts after the last boss floor beaten', () => {
    const s = createGameState(4);
    expect(towerOpen(s)).toBe(false);
    s.siege = 'won';
    expect(towerOpen(s)).toBe(true);
    expect(towerStart(s)).toBe(1);
  });

  it('floors grow harder; every 10th is a boss with more modifiers higher up; the 100th is the lord', () => {
    expect(floorLevel(50)).toBeGreaterThan(floorLevel(10));
    for (let f = 10; f <= 100; f += 10) expect(isBossFloor(f)).toBe(true);
    expect(isBossFloor(7)).toBe(false);
    expect(floorModifiers(90).length).toBeGreaterThan(floorModifiers(10).length);
    for (const b of TOWER.bosses) expect(BOSSES[b], b).toBeDefined();
    const s = climber();
    const top = towerBattle(s, 100);
    expect(top.boss?.defId).toBe(TOWER.finalBoss);
  });

  it('an ordinary floor fights a land’s arena with its waves; a boss floor carries its modifiers', () => {
    const s = climber();
    const b = towerBattle(s, 3);
    expect(b.waves!.total).toBe(TOWER.waves);
    expect(Object.values(ARENAS).some((a) => a.w === ARENA.w && a.h === ARENA.h)).toBe(true);
    const plain = BOSSES[TOWER.bosses[0]!]!;
    const boss = towerBattle(s, 10).boss!;
    expect(boss.defId).toBe(TOWER.bosses[0]);
    expect(boss.name).not.toBe(plain.name);
  });

  it('a won boss floor becomes the start of the next climb; the 100th meets the tower quest', () => {
    const s = climber();
    const b = towerBattle(s, 10);
    b.outcome = 'won';
    finishFloor(s, b);
    expect(s.tower.best).toBe(10);
    expect(towerStart(s)).toBe(11);
    const mid = towerBattle(s, 15);
    mid.outcome = 'won';
    finishFloor(s, mid);
    expect(towerStart(s)).toBe(11);
    expect(s.tower.best).toBe(15);
    startQuest(s, 'mainTower');
    const top = towerBattle(s, 100);
    top.outcome = 'won';
    expect(finishFloor(s, top).runCompleted).toBe(true);
    expect(questState(s, 'mainTower')!.step).toBe(1);
  });
});
