// One run of a rework location (ROADMAP 20.1–20.6): the Forest map, the hero of the chosen
// class with its skills, the flood of beasts, experience and the level-up choice. The run stops
// while a card is being chosen and when the hero dies. No DOM here: it steps the same in the browser and in Node.

import { Rng } from '../../core/rng';
import { REWORK_ENEMIES, REWORK_FIELD, type ReworkClassId, type ReworkEnemyId } from '../../data/rework';
import type { Vec } from '../entities';
import { spawnBeast, stepBeastShots, stepBeasts, stepFlood } from './enemies';
import { newHero, stepHero } from './hero';
import { buildGrid, makeForest } from './map';
import { stepPickups } from './progress';
import { stepHeroShots } from './shots';
import { stepSkills } from './skills';
import type { Run } from './types';

export function createRun(seed: number, classId: ReworkClassId): Run {
  const F = REWORK_FIELD;
  const rng = new Rng(seed).fork('reworkRun');
  const start = { x: F.width / 2, y: F.height / 2 };
  const obstacles = makeForest(rng.fork('map'), F.width, F.height, start);
  return {
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
    pendingLevels: 0,
    offer: null,
    rerolls: 0,
    events: [],
  };
}

/** True while the run waits: a card to choose or the hero is dead. */
export function runPaused(run: Run): boolean {
  return run.offer !== null || run.hero.dead;
}

/** One fixed step; `move` is the normalised walk direction. */
export function stepRun(run: Run, dt: number, move: Vec): void {
  if (runPaused(run)) return;
  run.time += dt;
  stepHero(run, dt, move);
  stepSkills(run, dt);
  stepFlood(run, dt);
  stepBeasts(run, dt);
  stepHeroShots(run, dt);
  stepBeastShots(run, dt);
  run.shots = run.shots.filter((s) => s.life > 0);
  stepPickups(run, dt);
}

/** Stress test (20.1): puts `count` beasts of the Forest's mix around the hero at once. */
export function stressSpawn(run: Run, count: number): void {
  const ids = Object.keys(REWORK_ENEMIES) as ReworkEnemyId[];
  for (let i = 0; i < count; i++) spawnBeast(run, ids[i % ids.length]!);
}
