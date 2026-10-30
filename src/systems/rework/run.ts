// One run of a rework location (ROADMAP 20.1–20.13): the Forest map with its herbs, shrines and
// altars, the hero of the chosen class with skills and passives, the flood of beasts and elites,
// the weather spirit, the task, and at 6:30 the boss in the living ring. The run stops while a
// card is being chosen and when the hero dies. No DOM here: it steps the same in the browser and
// in Node.

import { Rng } from '../../core/rng';
import { FLOOD_BEASTS, REWORK_FIELD, type ReworkClassId } from '../../data/rework';
import type { Vec } from '../entities';
import { stepAlpha, stepBossPhase, stepRingBeast } from './boss';
import { spawnBeast, stepBeastShots, stepBeasts, stepFlood } from './enemies';
import { newHero, stepHero } from './hero';
import { buildGrid, makeForest } from './map';
import { placePickups, stepPickupsOnMap } from './pickups';
import { stepPickups } from './progress';
import { stepHeroShots } from './shots';
import { stepSkills } from './skills';
import { stepSpirit, stepWeather } from './spirit';
import { stepNest, stepTask } from './task';
import type { Run, RunEnemy } from './types';

export function createRun(seed: number, classId: ReworkClassId): Run {
  const F = REWORK_FIELD;
  const rng = new Rng(seed).fork('reworkRun');
  const start = { x: F.width / 2, y: F.height / 2 };
  const obstacles = makeForest(rng.fork('map'), F.width, F.height, start);
  const run: Run = {
    width: F.width,
    height: F.height,
    rng,
    time: 0,
    hero: newHero(classId, start, F.hero.radius),
    obstacles,
    grid: buildGrid(obstacles),
    enemies: [],
    shots: [],
    gems: [],
    coins: [],
    nextId: 1,
    spawnTimer: 1,
    level: 1,
    xp: 0,
    gold: 0,
    kills: 0,
    cards: {},
    skills: [],
    buff: null,
    spin: null,
    zones: [],
    traps: [],
    delayed: [],
    volleys: [],
    chests: [],
    herbs: [],
    herbTimer: 0,
    shrines: [],
    altars: [],
    altarUses: 0,
    elitesSent: 0,
    blasts: [],
    fog: 0,
    fogTarget: 0,
    spiritCame: false,
    task: null,
    phase: 'flood',
    ringCenter: { x: start.x, y: start.y },
    noHowl: false,
    wallTimer: 0,
    pendingLevels: 0,
    offer: null,
    rerolls: 0,
    events: [],
  };
  placePickups(run);
  return run;
}

/** True while the run waits: a card to choose or the hero is dead. */
export function runPaused(run: Run): boolean {
  return run.offer !== null || run.hero.dead;
}

/** Beasts with their own code: the spirit, dens, the boss, the beasts standing in the ring. */
function special(run: Run, dt: number): (e: RunEnemy) => boolean {
  return (e) => stepSpirit(run, e, dt) || stepNest(run, e, dt) || stepAlpha(run, e, dt) || stepRingBeast(run, e, dt);
}

/** One fixed step; `move` is the normalised walk direction. */
export function stepRun(run: Run, dt: number, move: Vec): void {
  if (runPaused(run)) return;
  if (run.phase !== 'won') run.time += dt;
  else run.hero.invuln = 1;
  stepHero(run, dt, move);
  stepSkills(run, dt);
  if (run.phase === 'flood' || run.phase === 'warning') stepFlood(run, dt);
  stepWeather(run, dt);
  stepTask(run, dt);
  stepBossPhase(run, dt);
  stepBeasts(run, dt, special(run, dt));
  stepHeroShots(run, dt);
  stepBeastShots(run, dt);
  run.shots = run.shots.filter((s) => s.life > 0);
  // The location is won: nothing more to pick up or choose.
  if (run.phase === 'won') return;
  stepPickups(run, dt);
  stepPickupsOnMap(run, dt);
}

/** Stress test (20.1): puts `count` beasts of the Forest's mix around the hero at once. */
export function stressSpawn(run: Run, count: number): void {
  for (let i = 0; i < count; i++) spawnBeast(run, FLOOD_BEASTS[i % FLOOD_BEASTS.length]!);
}
