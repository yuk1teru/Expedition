import { describe, expect, it } from 'vitest';
import { COACH } from '../src/data/balance';
import { TOWNS } from '../src/data/towns';
import { coachDestinations, coachPrice, locationGold, rideCoach } from '../src/systems/coach';
import { getNode } from '../src/systems/mapgen';
import { createGameState, restInTown, teleport } from '../src/systems/run';
import { fromSave, readSave, toSave, writeSave } from '../src/systems/save';

describe('«Швидка тарадайка»', () => {
  it('goes only to towns reached on foot', () => {
    const s = createGameState(1);
    restInTown(s);
    expect(coachDestinations(s)).toEqual([]);
    teleport(s, 'forestTown');
    restInTown(s);
    expect(coachDestinations(s)).toEqual(['capital']);
    expect(rideCoach(s, 'port')).toBe(false);
  });

  it('a ride costs gold, takes no day and brings the hero to the town', () => {
    const s = createGameState(1);
    teleport(s, 'forestTown');
    restInTown(s);
    const price = coachPrice(s, 'capital');
    s.gold = price - 1;
    expect(rideCoach(s, 'capital')).toBe(false);
    s.gold = price + 7;
    const day = s.day;
    expect(rideCoach(s, 'capital')).toBe(true);
    expect(s.gold).toBe(7);
    expect(s.day).toBe(day);
    expect(s.currentNodeId).toBe('capital');
  });

  it('price: a share of what a location of the region brings; farther regions cost more', () => {
    const s = createGameState(1);
    for (const t of ['capital', 'port', 'forestTown', 'swampTown', 'desertTown', 'iceTown']) {
      const p = coachPrice(s, t);
      expect(p, t).toBeGreaterThanOrEqual(COACH.min);
      expect(p % COACH.roundTo, t).toBe(0);
    }
    expect(coachPrice(s, 'iceTown')).toBeGreaterThan(coachPrice(s, 'forestTown'));
    expect(locationGold(20)).toBeGreaterThan(locationGold(5));
    s.freeCoach = true;
    expect(coachPrice(s, 'iceTown')).toBe(0);
  });

  it('every town has a coachman, and the reached towns are saved', () => {
    for (const [id, layout] of Object.entries(TOWNS)) expect(layout.npcs.some((n) => n.id.endsWith('Coach')), id).toBe(true);
    const s = createGameState(1);
    teleport(s, 'forestTown');
    restInTown(s);
    const l = fromSave(readSave(writeSave(toSave(s)))!);
    expect(l.townsVisited.sort()).toEqual(['capital', 'forestTown']);
    expect(getNode(l.world, 'forestTown').isTown).toBe(true);
  });
});
