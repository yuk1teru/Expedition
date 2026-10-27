// Balance probe: on which wave does the bot die? One grove arena (its regular waves) from a given level.
//
//   npm run probe                    — 100 runs, level 1
//   npm run probe -- --level 10

import { Rng } from '../src/core/rng';
import { LOOP, SIM } from '../src/data/balance';
import { createBattle, stepBattle } from '../src/systems/battle';
import { grantLevel } from '../src/systems/leveling';
import { createGameState, teleport } from '../src/systems/run';
import { botHeal, dodgeTelegraphs, resolveModals, useReadySkills } from './bot';

const argv = process.argv.slice(2);
const arg = (n: string, d: number): number => {
  const i = argv.indexOf(n);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const runs = arg('--runs', 100);
const level = arg('--level', 1);

const deathWave = new Map<number, number>();
let survived = 0;
let gold = 0;
let waves = 0;
for (let r = 0; r < runs; r++) {
  const state = createGameState(1000 + r);
  const rng = new Rng(r).fork('bot');
  for (let l = 1; l < level; l++) {
    grantLevel(state);
    resolveModals(state, rng);
  }
  teleport(state, 'quietGrove');
  const b = createBattle(state, 'quietGrove');
  while (!b.finished && b.time < SIM.maxBattleTime) {
    useReadySkills(b);
    if (b.hero.hp < b.hero.maxHp * SIM.botHerbBelow) botHeal(b);
    dodgeTelegraphs(b);
    stepBattle(b, LOOP.step);
    resolveModals(state, rng);
  }
  const wave = (b.waves?.index ?? 0) + 1;
  gold += b.stats.gold;
  waves += b.waves?.cleared ?? 0;
  if (b.outcome === 'lost') {
    deathWave.set(wave, (deathWave.get(wave) ?? 0) + 1);
  } else survived++;
}
console.log(`runs ${runs}, start level ${level}: survived ${survived}`);
console.log(`avg gold ${(gold / runs).toFixed(0)} for ${(waves / runs).toFixed(1)} waves cleared`);
console.log('deaths by wave:', [...deathWave.entries()].sort((a, b) => a[0] - b[0]).map(([w, n]) => `${w}:${n}`).join(' '));
