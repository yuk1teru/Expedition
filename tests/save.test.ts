import { describe, expect, it } from 'vitest';
import { LIVES } from '../src/data/balance';
import { gainXp } from '../src/systems/leveling';
import { getNode, markCleared } from '../src/systems/mapgen';
import { createGameState, restInTown, saveCheckpoint } from '../src/systems/run';
import { SAVE_VERSION, fromSave, readSave, saveFileName, toSave, writeSave } from '../src/systems/save';
import { chooseClass } from '../src/systems/run';

function playedState() {
  const s = createGameState(42, 'Ярина');
  gainXp(s, 400);
  if (s.hero.level >= 3 && !s.hero.classId) chooseClass(s, 'archer');
  s.gold = 321;
  s.day = 7;
  s.lives = 2;
  markCleared(getNode(s.world, 'quietGrove'), 3);
  s.bossesDefeated.push('enatLair');
  s.rng.next();
  s.lootRng.next();
  restInTown(s);
  return s;
}

describe('save', () => {
  it('a new hero starts with the starting lives and the given name', () => {
    const s = createGameState(1, 'Ярина');
    expect(s.heroName).toBe('Ярина');
    expect(s.lives).toBe(LIVES.start);
    expect(LIVES.max).toBeGreaterThanOrEqual(LIVES.start);
  });

  it('saving and loading gives the same hero at the last checkpoint', () => {
    const s = playedState();
    const text = writeSave(toSave(s, 1000));
    const data = readSave(text);
    expect(data).not.toBeNull();
    const l = fromSave(data!);
    expect(l.heroName).toBe('Ярина');
    expect(l.hero.level).toBe(s.hero.level);
    expect(l.hero.classId).toBe(s.hero.classId);
    expect(l.hero.skills).toEqual(s.hero.skills);
    expect(l.hero.equipment).toEqual(s.hero.equipment);
    expect(l.hero.consumables).toEqual(s.hero.consumables);
    expect(l.hero.hp).toBe(l.hero.maxHp);
    expect(l.gold).toBe(321);
    expect(l.day).toBe(7);
    expect(l.lives).toBe(2);
    expect(l.bossesDefeated).toEqual(['enatLair']);
    expect(getNode(l.world, 'quietGrove')).toMatchObject({ timesCleared: 1, lastWave: 3, cleared: true });
    expect(l.currentNodeId).toBe(s.homeTown);
    // The random streams go on where they were.
    expect(l.rng.next()).toBe(s.rng.next());
    expect(l.lootRng.next()).toBe(s.lootRng.next());
    expect(l.cardRng.next()).toBe(s.cardRng.next());
    // The loaded state's checkpoint is itself.
    expect(l.checkpoint.gold).toBe(321);
  });

  it('the save is the checkpoint, not what happened after it', () => {
    const s = playedState();
    s.gold = 99999;
    expect(fromSave(readSave(writeSave(toSave(s)))!).gold).toBe(321);
  });

  it('saving the checkpoint tells the app to write the save', () => {
    const s = createGameState(3);
    let writes = 0;
    s.events.on('checkpoint', () => writes++);
    restInTown(s);
    saveCheckpoint(s);
    expect(writes).toBe(2);
  });

  it('broken saves, other files and saves of a newer game are not loaded', () => {
    expect(readSave(null)).toBeNull();
    expect(readSave('not json')).toBeNull();
    expect(readSave('{"a":1}')).toBeNull();
    const data = toSave(createGameState(5));
    expect(readSave(JSON.stringify({ ...data, version: SAVE_VERSION + 1 }))).toBeNull();
    expect(readSave(JSON.stringify({ ...data, hero: null }))).toBeNull();
    expect(readSave(JSON.stringify(data))).not.toBeNull();
  });

  it('export file name has the hero and the date', () => {
    const data = toSave(createGameState(5, 'Сірий Вовк'), Date.UTC(2026, 9, 27));
    expect(saveFileName(data)).toBe('expedition-Сірий_Вовк-2026-10-27.json');
  });
});
