import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/data/biomes';
import { SIEGE } from '../src/data/siege';
import { invest } from '../src/systems/growth';
import { questState, startQuest } from '../src/systems/quests';
import { createGameState, isRunWon, teleport } from '../src/systems/run';
import { bossesAlive, checkSiege, finishSiege, siegeBattle, siegeRoster } from '../src/systems/siege';

const bossIds = (s: ReturnType<typeof createGameState>): string[] => s.world.nodes.filter((n) => n.isBoss).map((n) => n.id);

describe('the siege of the capital (ROADMAP 17)', () => {
  it('begins at 100% invasion or when no boss of the lands is left', () => {
    const s = createGameState(2);
    checkSiege(s);
    expect(s.siege).toBe('none');
    s.day = 101;
    checkSiege(s);
    expect(s.siege).toBe('active');
    const t = createGameState(2);
    t.bossesDefeated = bossIds(t);
    checkSiege(t);
    expect(t.siege).toBe('active');
  });

  it('every boss still alive brings its detachment; a beaten one does not', () => {
    const s = createGameState(2);
    const enat = s.world.nodes.find((n) => n.id === 'enatLair')!;
    const forest = BIOMES[enat.biome]!.enemies[0]!;
    expect(siegeRoster(s)).toContain(forest);
    s.bossesDefeated.push('enatLair');
    expect(siegeRoster(s)).not.toContain(forest);
    s.bossesDefeated = bossIds(s);
    expect(bossesAlive(s)).toHaveLength(0);
    expect(new Set(siegeRoster(s))).toEqual(new Set(['deadRaider']));
  });

  it('the square, then the lord: his fall wins the campaign and the siege quest', () => {
    const s = createGameState(2);
    s.hero.immortal = true;
    s.bossesDefeated = bossIds(s);
    checkSiege(s);
    startQuest(s, 'mainSiege');
    teleport(s, 'capital');
    const square = siegeBattle(s, 'waves');
    expect(square.waves!.total).toBe(SIEGE.waves);
    square.outcome = 'won';
    finishSiege(s, square);
    expect(isRunWon(s)).toBe(false);
    const lord = siegeBattle(s, 'lord');
    expect(lord.boss?.defId).toBe(SIEGE.boss);
    lord.outcome = 'won';
    expect(finishSiege(s, lord).runCompleted).toBe(true);
    expect(isRunWon(s)).toBe(true);
    expect(questState(s, 'mainSiege')!.step).toBe(1);
  });

  it('the capital’s walls, guard and ballistas take waves off the siege', () => {
    const s = createGameState(2);
    s.gold = 10_000;
    teleport(s, 'capital');
    for (let i = 0; i < 3; i++) invest(s, 'capital');
    expect(siegeBattle(s, 'waves').waves!.total).toBe(Math.max(1, SIEGE.waves - 3));
  });
});
