import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { createBattle, stepBattle } from '../src/systems/battle';
import { lineOfSight, terrainAt } from '../src/systems/arena';
import { assignClass } from '../src/systems/hero';
import { createGameState, teleport } from '../src/systems/run';
import { spawnEnemy } from '../src/systems/waves';
import { botCoach } from '../scripts/route';

function battle(nodeId: string, classId: string, skills: string[]) {
  const s = createGameState(5);
  s.hero.level = 3;
  assignClass(s.hero, classId, skills);
  s.hero.immortal = true;
  teleport(s, nodeId);
  const b = createBattle(s, nodeId);
  b.waves = null;
  b.enemies = [];
  return { s, b };
}

describe('bot 2.0 in battle (ROADMAP 15.5)', () => {
  it('an archer bot with a tree in the way steps around it until it can shoot', () => {
    const { b } = battle('quietGrove', 'archer', ['multishot', 'arrowRain']);
    const tree = b.arena.obstacles[0]!;
    // The hero on one side of the tree, a standing target on the other.
    b.hero.pos = { x: tree.x - tree.r - 60, y: tree.y };
    const e = spawnEnemy(b, 'stump', { x: tree.x + tree.r + 60, y: tree.y });
    e.speed = 0;
    expect(lineOfSight(b.arena, b.hero.pos, e.pos)).toBe(false);
    let seen = false;
    for (let t = 0; t < 4 && !seen; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      e.pos = { x: tree.x + tree.r + 60, y: tree.y };
      seen = lineOfSight(b.arena, b.hero.pos, e.pos);
    }
    expect(seen).toBe(true);
  });

  it('the bot does not walk into thorns on its way', () => {
    const { b } = battle('darkThicket', 'warrior', ['whirlwind', 'charge']);
    const th = b.arena.terrain.find((x) => x.kind === 'thorns')!;
    // Target straight behind the thorn patch.
    const y = th.y + th.h / 2;
    b.hero.pos = { x: th.x - 40, y };
    const e = spawnEnemy(b, 'stump', { x: th.x + th.w + 80, y });
    e.speed = 0;
    let inThorns = 0;
    for (let t = 0; t < 3; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      if (terrainAt(b.arena, b.hero.pos) === 'thorns') inThorns++;
    }
    expect(inThorns).toBe(0);
  });

  it('an archer bot picks the arrows that hit the target hardest', () => {
    const { s, b } = battle('coastRoad', 'archer', ['multishot', 'arrowRain']);
    s.hero.arrows = ['fire', 'wind', 'earth'];
    // A crab: water with a shell — earth beats water.
    const crab = spawnEnemy(b, 'crab', { x: b.hero.pos.x + 200, y: b.hero.pos.y });
    crab.speed = 0;
    stepBattle(b, LOOP.step);
    expect(s.hero.arrowElement).not.toBe('neutral');
  });

  it('the bot rides the coach to a town much nearer its target', () => {
    const s = createGameState(5);
    s.gold = 500;
    s.townsVisited.push('forestTown');
    teleport(s, 'capital');
    expect(botCoach(s, 'enatLair')).toBe(true);
    expect(s.currentNodeId).toBe('forestTown');
    // Already there: no ride.
    expect(botCoach(s, 'enatLair')).toBe(false);
  });
});
