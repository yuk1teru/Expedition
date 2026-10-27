import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/data/quests';
import { TOWNS } from '../src/data/towns';
import { questsOffered } from '../src/systems/quests';
import { createGameState } from '../src/systems/run';

describe('the Smerekove chain and board (ROADMAP 15.1)', () => {
  it('the town chain has 4 steps, each opening the next', () => {
    const chain = ['forestWolves', 'forestSpores', 'forestAlpha', 'forestSpring'];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(QUESTS[chain[i]!]!.next).toBe(chain[i + 1]);
      expect(QUESTS[chain[i + 1]!]!.requires?.quests).toContain(chain[i]);
    }
  });

  it('the board stands in Smerekove and offers its errands from the start; they repeat', () => {
    expect(TOWNS.forestTown!.npcs.some((n) => n.id === 'forestBoard')).toBe(true);
    const s = createGameState(1);
    const offered = questsOffered(s, 'forestBoard');
    expect(offered.length).toBeGreaterThanOrEqual(3);
    for (const q of offered) expect(q.repeatable).toBe(true);
  });

  it('a class quest is offered to its class only', () => {
    const s = createGameState(1);
    s.hero.level = 10;
    expect(questsOffered(s, 'warriorTeacher').map((q) => q.id)).not.toContain('warriorDrill');
    s.hero.classId = 'mage';
    expect(questsOffered(s, 'warriorTeacher').map((q) => q.id)).not.toContain('warriorDrill');
    s.hero.classId = 'warrior';
    expect(questsOffered(s, 'warriorTeacher').map((q) => q.id)).toContain('warriorDrill');
  });

  it('every land town has its errand board and a 4-step chain (ROADMAP 16)', () => {
    const chains: Record<string, string[]> = {
      port: ['portGulls', 'portShells', 'portBlackSails', 'portLighthouse'],
      swampTown: ['swampSlime', 'swampTongues', 'swampToad', 'swampWell'],
      desertTown: ['desertStings', 'desertScarabs', 'desertKing', 'desertOasis'],
      iceTown: ['iceSnowmen', 'iceCrystals', 'iceKnightTrail', 'iceBanner'],
    };
    const s = createGameState(1);
    for (const [town, chain] of Object.entries(chains)) {
      const boardId = TOWNS[town]!.npcs.map((n) => n.id).find((id) => id.endsWith('Board'));
      expect(boardId, town).toBeDefined();
      expect(questsOffered(s, boardId!).length, town).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < chain.length - 1; i++) expect(QUESTS[chain[i]!]!.next, chain[i]).toBe(chain[i + 1]);
    }
  });
});
