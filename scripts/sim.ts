// Mini balance simulation for the vertical slice (no render):
// the bot clears the grove N times, then fights the boss.
//
//   npm run sim                  — 200 runs, bot uses skills as soon as they are ready
//   npm run sim -- --no-skills   — bot never uses skills
//   npm run sim -- --runs 500 --passes 6 --seed 1

import { Rng } from '../src/core/rng';
import { SIM } from '../src/data/balance';
import { SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID } from '../src/systems/mapgen';
import { createGameState, restInTown, travel } from '../src/systems/run';
import { runBattle } from './bot';

interface Args {
  runs: number;
  passes: number;
  seed: number;
  useSkills: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, def: number): number => {
    const i = argv.indexOf(name);
    const v = i >= 0 ? Number(argv[i + 1]) : NaN;
    return Number.isFinite(v) ? v : def;
  };
  return {
    runs: get('--runs', SIM.runs),
    passes: get('--passes', SIM.grovePasses),
    seed: get('--seed', SIM.baseSeed),
    useSkills: !argv.includes('--no-skills'),
  };
}

interface RunResult {
  diedInGrove: number | null;
  levelBeforeBoss: number | null;
  bossWon: boolean;
  bossTime: number;
  groveTimes: number[];
  groveHpLeft: number[];
}

function simulateRun(seed: number, args: Args): RunResult {
  const state = createGameState(seed);
  const rng = new Rng(seed).fork('bot');
  const opts = { useSkills: args.useSkills, rng, maxBattleTime: SIM.maxBattleTime };
  const groveTimes: number[] = [];
  const groveHpLeft: number[] = [];
  for (let p = 0; p < args.passes; p++) {
    restInTown(state);
    travel(state, SLICE_GROVE_ID);
    const res = runBattle(state, SLICE_GROVE_ID, opts);
    groveTimes.push(res.time);
    if (!res.summary.won) {
      return { diedInGrove: p + 1, levelBeforeBoss: null, bossWon: false, bossTime: 0, groveTimes, groveHpLeft };
    }
    groveHpLeft.push(res.hpLeftFrac);
    travel(state, TOWN_ID);
  }
  restInTown(state);
  const levelBeforeBoss = state.hero.level;
  travel(state, SLICE_LAIR_ID);
  const boss = runBattle(state, SLICE_LAIR_ID, opts);
  return { diedInGrove: null, levelBeforeBoss, bossWon: boss.summary.won, bossTime: boss.time, groveTimes, groveHpLeft };
}

function avg(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const results: RunResult[] = [];
  for (let i = 0; i < args.runs; i++) results.push(simulateRun(args.seed + i, args));

  const reachedBoss = results.filter((r) => r.levelBeforeBoss !== null);
  const bossWins = reachedBoss.filter((r) => r.bossWon);
  const groveDeaths = new Map<number, number>();
  for (const r of results) if (r.diedInGrove !== null) groveDeaths.set(r.diedInGrove, (groveDeaths.get(r.diedInGrove) ?? 0) + 1);

  console.log(`Експедиція — міні-симуляція зрізу`);
  console.log(`Прогонів: ${args.runs} · проходжень гаю: ${args.passes} · скіли: ${args.useSkills ? 'так' : 'ні'} · seed від ${args.seed}`);
  console.log('');
  console.table({
    'Дійшли до боса': `${reachedBoss.length} (${pct(reachedBoss.length, args.runs)})`,
    'Середній рівень перед босом': avg(reachedBoss.map((r) => r.levelBeforeBoss ?? 0)).toFixed(2),
    'Перемог над босом (з тих, хто дійшов)': `${bossWins.length} (${pct(bossWins.length, reachedBoss.length)})`,
    'Перемог над босом (усі прогони)': pct(bossWins.length, args.runs),
    'Середній час бою з босом, с (перемоги)': avg(bossWins.map((r) => r.bossTime)).toFixed(1),
    'Середній час бою в гаю, с': avg(results.flatMap((r) => r.groveTimes)).toFixed(1),
    'Середнє HP після гаю': avg(results.flatMap((r) => r.groveHpLeft)).toFixed(2),
  });
  if (groveDeaths.size > 0) {
    console.log('Смерті в гаю за проходженням:');
    for (const [pass, n] of [...groveDeaths.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  проходження ${pass}: ${n} (${pct(n, args.runs)})`);
    }
  }
  console.log(`\nЧас симуляції: ${((Date.now() - started) / 1000).toFixed(1)} с`);
}

main();
