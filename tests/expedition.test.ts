import { describe, expect, it } from 'vitest';
import { EXPEDITION } from '../src/data/expedition';
import { PROGRESSION } from '../src/data/balance';
import { killAll, stepBattle as step } from '../src/systems/battle';
import type { Battle } from '../src/systems/battle';
import { chooseNext, finishStep, nextChoice, planFor, startExpedition, stepBattle } from '../src/systems/expedition';
import { assignClass } from '../src/systems/hero';
import { getNode } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';

function hero() {
  const s = createGameState(4);
  s.hero.immortal = true;
  s.hero.level = PROGRESSION.classChoiceLevel;
  assignClass(s.hero, 'warrior', ['whirlwind', 'charge']);
  return s;
}

/** Wins the arena: kills every wave as it comes. */
function win(b: Battle): void {
  for (let t = 0; t < 300 && !b.finished; t += 1 / 60) {
    step(b, 1 / 60);
    if (b.waves?.started && b.waves.queue.length === 0) killAll(b);
    if (b.boss && !b.boss.dead) killAll(b);
  }
  expect(b.outcome).toBe('won');
}

describe('location trips', () => {
  it('plans: a regular location — entrance, a fork of two, lair; short ones — entrance and lair; a boss — antechamber and boss', () => {
    const s = hero();
    const regular = planFor(s, 'quietGrove');
    expect(regular.length).toBe(3);
    expect(Array.isArray(regular[1]) && regular[1].length === 2).toBe(true);
    expect((regular[2] as { kind: string }).kind).toBe('lair');
    const short = planFor(s, 'coastRoad');
    expect(short.map((x) => (x as { kind: string }).kind)).toEqual(['entrance', 'lair']);
    const boss = planFor(s, 'enatLair');
    expect(boss.map((x) => (x as { kind: string }).kind)).toEqual(['antechamber', 'boss']);
  });

  it('a trip: HP stays between arenas, the waves keep growing, the lair completes the location', () => {
    const s = hero();
    teleport(s, 'quietGrove');
    startExpedition(s, 'quietGrove');
    const node = getNode(s.world, 'quietGrove');
    const day = s.day;
    // Entrance.
    let b = stepBattle(s);
    expect(b.waves!.total - b.waves!.start).toBe(EXPEDITION.waves.entrance);
    win(b);
    s.hero.hp = 50;
    let res = finishStep(s, b);
    expect(res.summary).toBeNull();
    expect(node.timesCleared).toBe(0);
    // Fork: two options.
    const options = nextChoice(s.expedition!);
    expect(options).toHaveLength(2);
    // A wave arena (an objective one has no waves).
    chooseNext(s, options.findIndex((o) => o.kind !== 'objective'));
    b = stepBattle(s);
    expect(s.hero.hp).toBe(50);
    expect(b.waves!.start).toBe(EXPEDITION.waves.entrance);
    win(b);
    res = finishStep(s, b);
    expect(res.summary).toBeNull();
    // Lair: the miniboss, then the location is done.
    chooseNext(s);
    b = stepBattle(s);
    expect(b.waves!.miniboss).toBe(true);
    win(b);
    res = finishStep(s, b);
    expect(res.summary?.won).toBe(true);
    expect(node.timesCleared).toBe(1);
    expect(s.day).toBe(day + 1);
    expect(s.expedition).toBeNull();
  });

  it('the altar gives a gift once per location', () => {
    const s = hero();
    teleport(s, 'quietGrove');
    // No level-ups: their gifts would mix in.
    s.hero.level = PROGRESSION.maxLevel;
    for (let round = 0; round < 2; round++) {
      startExpedition(s, 'quietGrove');
      s.expedition!.current = { kind: 'altar' };
      s.modalQueue = [];
      const b = stepBattle(s);
      win(b);
      finishStep(s, b);
      const gifts = s.modalQueue.filter((m) => m.kind === 'gift').length;
      expect(gifts, `round ${round}`).toBe(round === 0 ? 1 : 0);
      s.expedition = null;
    }
  });

  it('a loss ends the trip', () => {
    const s = hero();
    s.hero.immortal = false;
    teleport(s, 'quietGrove');
    startExpedition(s, 'quietGrove');
    const b = stepBattle(s);
    b.outcome = 'lost';
    const res = finishStep(s, b);
    expect(res.lost).toBe(true);
    expect(res.summary?.won).toBe(false);
    expect(s.expedition).toBeNull();
  });
});
