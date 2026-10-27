// Balance simulation (no render). By default — full runs in the full world (PLAN.md 6.8):
// the bot walks the map (scripts/route.ts), classes in turn, until it beats the 4 bosses
// or dies too often (a death returns it to the last rest, as the player; after
// SIM.maxDeaths + 1 deaths the run counts as lost).
//
//   npm run sim                       — 200 full runs, bot uses skills as soon as they are ready
//   npm run sim -- --no-skills        — bot never uses skills
//   npm run sim -- --runs 60 --seed 1 --class mage
//   npm run sim -- --slice            — the old mini simulation of the slice (grove × N, boss)
//   npm run sim -- --slice --passes 6 --class archer

import { Rng } from '../src/core/rng';
import { SIM } from '../src/data/balance';
import { CLASS_ORDER } from '../src/data/classes';
import { SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID } from '../src/systems/mapgen';
import { createGameState, restInTown, travel } from '../src/systems/run';
import { runBattle } from './bot';
import { type FullRunResult, simulateFullRun } from './route';

interface Args {
  runs: number;
  passes: number;
  seed: number;
  useSkills: boolean;
  /** Slice mode: this class; full mode: only this class (empty: classes in turn). */
  classId: string;
  slice: boolean;
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
    classId: argv.includes('--class') ? (argv[argv.indexOf('--class') + 1] ?? '') : '',
    slice: argv.includes('--slice'),
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
  const state = createGameState(seed, 'slice');
  const rng = new Rng(seed).fork('bot');
  const opts = { useSkills: args.useSkills, rng, maxBattleTime: SIM.maxBattleTime, classId: args.classId || 'warrior' };
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

function mainSlice(args: Args): void {
  const started = Date.now();
  const results: RunResult[] = [];
  for (let i = 0; i < args.runs; i++) results.push(simulateRun(args.seed + i, args));

  const reachedBoss = results.filter((r) => r.levelBeforeBoss !== null);
  const bossWins = reachedBoss.filter((r) => r.bossWon);
  const groveDeaths = new Map<number, number>();
  for (const r of results) if (r.diedInGrove !== null) groveDeaths.set(r.diedInGrove, (groveDeaths.get(r.diedInGrove) ?? 0) + 1);

  console.log(`Експедиція — міні-симуляція зрізу`);
  console.log(`Прогонів: ${args.runs} · проходжень гаю: ${args.passes} · скіли: ${args.useSkills ? 'так' : 'ні'} · клас: ${args.classId || 'warrior'} · seed від ${args.seed}`);
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

/** Full runs: classes in turn (or one class), death ends the bot's run. */
function mainFull(args: Args): void {
  const started = Date.now();
  const results: FullRunResult[] = [];
  for (let i = 0; i < args.runs; i++) {
    const seed = args.seed + i;
    const classId = args.classId || CLASS_ORDER[i % CLASS_ORDER.length]!;
    const state = createGameState(seed);
    results.push(
      simulateFullRun(state, {
        useSkills: args.useSkills,
        rng: new Rng(seed).fork('bot'),
        classId,
        maxBattleTime: SIM.maxBattleTime,
        maxDeaths: SIM.maxDeaths,
        maxBattles: SIM.maxBattles,
        maxDays: SIM.maxDays,
      }),
    );
  }
  const wins = results.filter((r) => r.won);
  console.log('Експедиція — симуляція повних забігів');
  console.log(`Забігів: ${args.runs} · скіли: ${args.useSkills ? 'так' : 'ні'} · класи: ${args.classId || 'по черзі'} · seed від ${args.seed}`);
  console.log('');
  const byClass: Record<string, string> = {};
  for (const c of CLASS_ORDER) {
    const rs = results.filter((r) => r.classId === c);
    if (rs.length > 0) byClass[`Перемог: ${c}`] = `${rs.filter((r) => r.won).length}/${rs.length} (${pct(rs.filter((r) => r.won).length, rs.length)})`;
  }
  console.table({
    'Перемог (усі 4 боси)': `${wins.length} (${pct(wins.length, args.runs)})`,
    ...byClass,
    'Застрягли (ліміт днів / боїв)': String(results.filter((r) => r.stuck).length),
    'Середні дні до перемоги': avg(wins.map((r) => r.days)).toFixed(1),
    'Рівень на першій перемозі над босом': avg(results.flatMap((r) => (r.levelAtFirstBossWin === null ? [] : [r.levelAtFirstBossWin]))).toFixed(1),
    'Середній бій у локації, с': avg(results.flatMap((r) => r.locationTimes)).toFixed(1),
    'Середній бій з босом, с': avg(results.flatMap((r) => r.bossTimes)).toFixed(1),
    'Боїв за забіг': avg(results.map((r) => r.battles)).toFixed(1),
    'Візитів у місто за забіг': avg(results.map((r) => r.townVisits)).toFixed(1),
  });
  console.log('Середній рівень героя на початку бою з босом (за порядком):');
  for (let k = 0; k < 4; k++) {
    const lv = results.flatMap((r) => (r.bossLevels[k] === undefined ? [] : [r.bossLevels[k]!]));
    if (lv.length > 0) console.log(`  бос ${k + 1}: ${avg(lv).toFixed(1)} (спроб: ${lv.length})`);
  }
  console.log(`Смерті за глибиною (усього; забіг програно після ${SIM.maxDeaths + 1}-ї):`);
  for (let d = 1; d <= 4; d++) {
    const n = results.reduce((a, r) => a + r.deaths.filter((x) => x === d).length, 0);
    const runs = results.filter((r) => r.deaths.includes(d)).length;
    console.log(`  глибина ${d}${d === 4 ? ' (бос)' : ''}: ${n} смертей, у ${pct(runs, args.runs)} забігів`);
  }
  const lost = results.filter((r) => !r.won && !r.stuck);
  console.log(`Програно (забагато смертей): ${lost.length} (${pct(lost.length, args.runs)}); середня кількість смертей за забіг: ${avg(results.map((r) => r.deaths.length)).toFixed(2)}`);
  console.log(`\nЧас симуляції: ${((Date.now() - started) / 1000).toFixed(1)} с`);
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.slice) mainSlice(parsed);
else mainFull(parsed);
