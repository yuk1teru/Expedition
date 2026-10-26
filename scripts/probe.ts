// Balance probe: on which wave does the bot die? One grove visit from a given level.
//
//   npm run probe                          — 100 runs, level 1, leaves through the first portal
//   npm run probe -- --endless --level 10  — never takes the portal (how deep can it go)

import { Rng } from '../src/core/rng';
import { LOOP, SIM } from '../src/data/balance';
import { createBattle, stepBattle } from '../src/systems/battle';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { grantLevel } from '../src/systems/leveling';
import { createGameState, teleport } from '../src/systems/run';
import { enterPortal } from '../src/systems/waves';
import { botHeal, dodgeTelegraphs, resolveModals, useReadySkills } from './bot';

const argv = process.argv.slice(2);
const arg = (n: string, d: number): number => {
  const i = argv.indexOf(n);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const runs = arg('--runs', 100);
const level = arg('--level', 1);
const endless = argv.includes('--endless');

const deathWave = new Map<number, number>();
let survived = 0;
let gold = 0;
let waves = 0;
for (let r = 0; r < runs; r++) {
  const state = createGameState(1000 + r, 'slice');
  const rng = new Rng(r).fork('bot');
  for (let l = 1; l < level; l++) {
    grantLevel(state);
    resolveModals(state, rng);
  }
  teleport(state, SLICE_GROVE_ID);
  const b = createBattle(state, SLICE_GROVE_ID);
  while (!b.finished && b.time < SIM.maxBattleTime) {
    useReadySkills(b);
    if (b.hero.hp < b.hero.maxHp * SIM.botHerbBelow) botHeal(b);
    if (!endless && b.portal) enterPortal(b);
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
console.log(`runs ${runs}, start level ${level}, ${endless ? 'endless' : 'until portal'}: survived ${survived}`);
console.log(`avg gold ${(gold / runs).toFixed(0)} for ${(waves / runs).toFixed(1)} waves cleared`);
console.log('deaths by wave:', [...deathWave.entries()].sort((a, b) => a[0] - b[0]).map(([w, n]) => `${w}:${n}`).join(' '));
