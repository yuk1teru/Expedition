// Build diversity test (ROADMAP 15.6): many random builds of each class (starting skills,
// talents and forks, the branch) at the same level, without items or gifts, fight the same
// benchmark battles. A build's power is how fast it clears them; the best build should not
// be more than 15–20% stronger than the average one.
//
//   npm run sim -- --builds 60              — 60 builds per class
//   npm run sim -- --builds 60 --class mage

import { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { LOOP } from '../src/data/balance';
import { CLASS_ORDER } from '../src/data/classes';
import { TALENTS } from '../src/data/talents';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { grantLevel } from '../src/systems/leveling';
import { promotionChoices } from '../src/systems/promotion';
import { chooseBranchFork, chooseClass, choosePromotion, completePromotion, createGameState, teleport } from '../src/systems/run';
import { branchNodes, canLearn, learn, startingSkills, treeNodes } from '../src/systems/talents';
import { botHeal, dodgeTelegraphs, useReadySkills } from './bot';

const LEVEL = 22;
/** Benchmark: late locations (their waves with the miniboss) and boss lairs. */
const BENCH = [
  // One per land of the late game, so no element is favoured: swamp, desert, mountains, ice; two bosses.
  { node: 'blackMuck', waves: 3 },
  { node: 'scorchedPlain', waves: 3 },
  { node: 'mountainPass', waves: 3 },
  { node: 'iceLake', waves: 3 },
  { node: 'motherNest', waves: 0 },
  { node: 'wormBurrow', waves: 0 },
];
const MAX_TIME = 150;
/** Seeds per benchmark battle. */
const SEEDS = 2;
/** Every max HP of damage taken counts as this many seconds (a build that tanks is worth something too). */
const HURT_SECONDS = 10;

/** Spends the talent points at random — fresh skills first while the panel has room. */
function randomTalents(state: GameState, rng: Rng): void {
  const hero = state.hero;
  const nodes = [...treeNodes(hero.classId!), ...branchNodes(hero)];
  for (let guard = 0; guard < 200 && state.talentPoints > 0; guard++) {
    const ok = nodes.filter((n) => canLearn(state, n) === 'ok');
    if (ok.length === 0) break;
    const onPanel = hero.skills.filter((s) => s.slot >= 0 && s.slot < TALENTS.classSlots).length;
    const fresh = ok.filter((n) => n.kind === 'skill' && !hero.skills.some((s) => s.id === n.id));
    const pool = onPanel < TALENTS.classSlots && fresh.length > 0 ? fresh : ok;
    learn(state, rng.pick(pool), rng.chance(0.5) ? 1 : 0);
  }
}

export interface Build {
  classId: string;
  seed: number;
  branch: string | null;
  skills: string;
  state: GameState;
}

export function randomBuild(classId: string, seed: number): Build {
  const state = createGameState(seed);
  state.noInvasion = true;
  const rng = new Rng(seed).fork('build');
  for (let guard = 0; guard < 60 && state.hero.level < LEVEL; guard++) {
    grantLevel(state);
    while (state.modalQueue.length > 0) {
      const req = state.modalQueue.shift()!;
      if (req.kind === 'classChoice') chooseClass(state, classId, rng.shuffle(startingSkills(classId)).slice(0, 2));
      else if (req.kind === 'promotion') {
        const b = promotionChoices(state.hero);
        if (b.length > 0) choosePromotion(state, rng.pick(b).id);
      } else if (req.kind === 'promotion2') completePromotion(state);
      else if (req.kind === 'branchFork') chooseBranchFork(state, rng.int(0, 1));
      // Gifts are left out: the build alone is measured.
    }
    randomTalents(state, rng);
  }
  const skills = state.hero.skills
    .filter((s) => s.slot >= 0)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => `${s.id}${s.rank}${s.forks && Object.keys(s.forks).length ? `[${Object.values(s.forks).join('')}]` : ''}`)
    .join(' ');
  const fork = state.hero.promotion && state.hero.branchFork !== undefined && state.hero.branchFork !== null ? `/${state.hero.branchFork}` : '';
  return { classId, seed, branch: `${state.hero.promotion}${fork}`, skills, state };
}

/**
 * The cost of the benchmark battles: seconds to clear them plus HURT_SECONDS per max HP of
 * damage taken (an immortal hero; a battle not cleared counts MAX_TIME).
 */
function benchmark(build: Build, seeds: number, firstSeed = 0): number {
  let total = 0;
  for (const bench of BENCH) {
    for (let k = firstSeed; k < firstSeed + seeds; k++) {
      const s = build.state;
      s.hero.hp = s.hero.maxHp;
      s.hero.immortal = true;
      s.rng = new Rng(7000 + k);
      teleport(s, bench.node);
      const b: Battle = bench.waves > 0 ? createBattle(s, bench.node, 0, false, { waves: bench.waves, miniboss: true, boss: false }) : createBattle(s, bench.node);
      while (!b.finished && b.time < MAX_TIME) {
        useReadySkills(b);
        if (b.hero.hp < b.hero.maxHp * 0.5) botHeal(b);
        dodgeTelegraphs(b);
        stepBattle(b, LOOP.step);
      }
      total += (b.finished && b.outcome === 'won' ? b.time : MAX_TIME) + (HURT_SECONDS * b.stats.damageTaken) / s.hero.maxHp;
    }
  }
  return total / (BENCH.length * seeds);
}

export function mainBuilds(count: number, only: string, seed: number): void {
  const started = Date.now();
  console.log(`Тест різноманіття збірок: ${count} на клас, рівень ${LEVEL}, без речей і дарів; ціна = секунди бою + ${HURT_SECONDS} с за кожне макс. HP отриманої шкоди`);
  for (const classId of CLASS_ORDER) {
    if (only && only !== classId) continue;
    const results: { b: Build; time: number }[] = [];
    for (let i = 0; i < count; i++) {
      const b = randomBuild(classId, seed + i);
      results.push({ b, time: benchmark(b, SEEDS) });
    }
    const mean = results.reduce((a, r) => a + r.time, 0) / results.length;
    results.sort((a, b) => a.time - b.time);
    const worst = results[results.length - 1]!;
    // The best of many is partly luck: the top five are measured again on fresh seeds.
    const recheck = results.slice(0, 5).map((r) => ({ r, time: benchmark(r.b, SEEDS * 3, 100) }));
    recheck.sort((a, b) => a.time - b.time);
    const best = recheck[0]!;
    console.log(
      `\n${classId}: середня ціна ${mean.toFixed(1)} с, найкраща ${best.time.toFixed(1)} с після перевірки (сильніша за середню на ${((mean / best.time - 1) * 100).toFixed(0)}%; до перевірки ${results[0]!.time.toFixed(1)} с), найгірша ${worst.time.toFixed(1)} с`,
    );
    const byBranch = new Map<string, number[]>();
    for (const r of results) byBranch.set(r.b.branch ?? '—', [...(byBranch.get(r.b.branch ?? '—') ?? []), r.time]);
    for (const [br, ts] of byBranch) console.log(`  гілка ${br}: ${ts.length} збірок, середня ціна ${(ts.reduce((a, x) => a + x, 0) / ts.length).toFixed(1)} с`);
    // What a skill does to the cost: builds with it at rank 3+ (by fork, if it has one) against the rest.
    const effects: { label: string; delta: number; n: number }[] = [];
    const keys = new Set<string>();
    for (const r of results) for (const sk of r.b.state.hero.skills) if (sk.rank >= 3) keys.add(`${sk.id}${sk.forks?.[3] !== undefined ? `[${sk.forks[3]}]` : ''}`);
    for (const key of keys) {
      const has = (r: (typeof results)[number]): boolean =>
        r.b.state.hero.skills.some((sk) => sk.rank >= 3 && `${sk.id}${sk.forks?.[3] !== undefined ? `[${sk.forks[3]}]` : ''}` === key);
      const yes = results.filter(has);
      const no = results.filter((r) => !has(r));
      if (yes.length < 4 || no.length < 4) continue;
      const m = (xs: typeof results): number => xs.reduce((a2, r) => a2 + r.time, 0) / xs.length;
      effects.push({ label: key, delta: m(yes) - m(no), n: yes.length });
    }
    effects.sort((x, y) => x.delta - y.delta);
    console.log(`  вплив (ранг 3+; мінус — швидше): ${effects.map((e) => `${e.label} ${e.delta > 0 ? '+' : ''}${e.delta.toFixed(1)}`).join(' · ')}`);
    console.log('  найкращі:');
    for (const r of results.slice(0, 3)) console.log(`    ${r.time.toFixed(1)} с · ${r.b.branch} · ${r.b.skills}`);
    console.log('  найгірші:');
    for (const r of results.slice(-2)) console.log(`    ${r.time.toFixed(1)} с · ${r.b.branch} · ${r.b.skills}`);
  }
  console.log(`\nЧас: ${((Date.now() - started) / 1000).toFixed(1)} с`);
}
