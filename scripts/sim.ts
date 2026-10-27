// Balance simulation (no render). By default — full runs in the full world (PLAN.md 6.8):
// the bot walks the map (scripts/route.ts), classes in turn, until it beats the 4 bosses
// or dies too often (a death returns it to the last rest, as the player; after
// SIM.maxDeaths + 1 deaths the run counts as lost).
//
//   npm run sim                       — 200 full runs, bot uses skills as soon as they are ready
//   npm run sim -- --no-skills        — bot never uses skills
//   npm run sim -- --class mage       — only the mage's runs of the rotation (same seeds as in the full run)
//   npm run sim -- --builds 60        — build diversity test (ROADMAP 15.6): random builds per class

import { Rng } from '../src/core/rng';
import { SIM } from '../src/data/balance';
import { CLASS_ORDER } from '../src/data/classes';
import { createGameState } from '../src/systems/run';
import { type FullRunResult, simulateFullRun } from './route';
import { mainBuilds } from './builds';

interface Args {
  runs: number;
  seed: number;
  useSkills: boolean;
  /** Only this class (empty: classes in turn). */
  classId: string;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, def: number): number => {
    const i = argv.indexOf(name);
    const v = i >= 0 ? Number(argv[i + 1]) : NaN;
    return Number.isFinite(v) ? v : def;
  };
  return {
    runs: get('--runs', SIM.runs),
    seed: get('--seed', SIM.baseSeed),
    useSkills: !argv.includes('--no-skills'),
    classId: argv.includes('--class') ? (argv[argv.indexOf('--class') + 1] ?? '') : '',
  };
}

function avg(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`;
}

/** Full runs: classes in turn (or one class), death ends the bot's run. */
function mainFull(args: Args): void {
  const started = Date.now();
  const results: FullRunResult[] = [];
  for (let i = 0; i < args.runs; i++) {
    const seed = args.seed + i;
    const turn = CLASS_ORDER[i % CLASS_ORDER.length]!;
    // One class: exactly the runs (seeds) it gets in the full rotation, so its result can
    // be put next to the other classes' numbers from SIM_RESULTS.md.
    if (args.classId && args.classId !== turn) continue;
    const classId = turn;
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
  console.log(`Забігів: ${results.length} · скіли: ${args.useSkills ? 'так' : 'ні'} · класи: ${args.classId || 'по черзі'} · seed від ${args.seed}`);
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
  console.log(`Смерті за регіонами (усього; забіг програно після ${SIM.maxDeaths + 1}-ї):`);
  const places = [...new Set(results.flatMap((r) => r.deaths))].sort();
  for (const place of places) {
    const n = results.reduce((a, r) => a + r.deaths.filter((x) => x === place).length, 0);
    const runs = results.filter((r) => r.deaths.includes(place)).length;
    console.log(`  ${place}: ${n} смертей, у ${pct(runs, results.length)} забігів`);
  }
  const lost = results.filter((r) => !r.won && !r.stuck);
  console.log(`Програно (забагато смертей): ${lost.length} (${pct(lost.length, args.runs)}); середня кількість смертей за забіг: ${avg(results.map((r) => r.deaths.length)).toFixed(2)}`);
  console.log(`\nЧас симуляції: ${((Date.now() - started) / 1000).toFixed(1)} с`);
}

const argv = process.argv.slice(2);
if (argv.includes('--builds')) {
  const a = parseArgs(argv);
  mainBuilds(Number(argv[argv.indexOf('--builds') + 1]) || 40, a.classId, a.seed);
} else mainFull(parseArgs(argv));
