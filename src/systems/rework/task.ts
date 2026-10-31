// The tasks of a location (ROADMAP 20.11, 20.14, VISION §3): a line on the screen, arrows to the
// goals and a timer. The first location gives one at 1:30, the deeper forest two (1:30 and 5:00).
// Destroy three wolf dens (each sends wolves while the hero is near) or three cocoons (spiders),
// or lead a lumberjack to the forest's edge. Not doing it costs nothing; doing it gives a chest
// and weakens the boss: no dens — no howling wolves; no cocoons — no spiderlings; the lumberjack
// saved — HP back when the pack leader comes, a second clear gap in the spinner's pull.

import { REWORK_LOCATIONS, REWORK_TASKS, type TaskKind } from '../../data/rework';
import type { Vec } from '../entities';
import { spawnBeast } from './enemies';
import { isFree } from './map';
import type { Run, RunEnemy, Task } from './types';

const T = REWORK_TASKS;

function spotAround(run: Run, range: [number, number], radius: number): Vec {
  const h = run.hero.pos;
  for (let tries = 0; tries < 60; tries++) {
    const a = run.rng.next() * Math.PI * 2;
    const d = range[0] + run.rng.next() * (range[1] - range[0]);
    const p = { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d };
    if (p.x < 120 || p.y < 120 || p.x > run.width - 120 || p.y > run.height - 120) continue;
    if (isFree(run.grid, p, radius)) return p;
  }
  return { x: Math.min(run.width - 150, h.x + range[0]), y: h.y };
}

/**
 * The way out for the lumberjack: a free spot on the field's edge, far enough from him that
 * leading him there is a walk (not the edge nearest to him); the farthest one if none fits.
 */
function exitFor(run: Run, man: Vec): Vec {
  const m = 60;
  const spots: Vec[] = [];
  for (let x = m; x <= run.width - m; x += 120) spots.push({ x, y: m }, { x, y: run.height - m });
  for (let y = m; y <= run.height - m; y += 120) spots.push({ x: m, y }, { x: run.width - m, y });
  const far = (p: Vec): number => Math.hypot(p.x - man.x, p.y - man.y);
  const [lo, hi] = T.rescue.exitDistance;
  const fit = spots.filter((p) => far(p) >= lo && far(p) <= hi && isFree(run.grid, p, 30));
  if (fit.length > 0) return fit[Math.floor(run.rng.next() * fit.length)]!;
  return spots.reduce((a, b) => (far(b) > far(a) ? b : a));
}

/** Which task comes next: the first by the run's seed, a later one — one not given yet. */
export function taskKind(run: Run): TaskKind {
  const kinds = REWORK_LOCATIONS[run.location]!.tasks[run.tasksGiven]?.kinds ?? REWORK_LOCATIONS[0]!.tasks[0]!.kinds;
  const last = run.task?.kind;
  return kinds.find((k) => last && k !== last) ?? kinds[run.rng.seed & 1]!;
}

/** Destroy-tasks: the den each kind is made of and the beast it sends. */
const DENS = { nests: { def: 'nest', sends: 'wolf' }, webs: { def: 'cocoon', sends: 'spider' } } as const;

export function startTask(run: Run, kind: TaskKind): Task {
  const task: Task = { kind, time: T.duration, state: 'active', dens: [], denCount: 0, man: { x: 0, y: 0 }, following: false, exit: { x: 0, y: 0 } };
  if (kind !== 'rescue') {
    const D = T[kind];
    for (let i = 0; i < D.count; i++) {
      const p = spotAround(run, D.distance, 36);
      const e = spawnBeast(run, DENS[kind].def, p);
      if (!e) continue;
      e.pos = p;
      e.moveTimer = D.spawnEvery * (0.3 + i * 0.25);
      task.dens.push(e.id);
    }
    task.denCount = task.dens.length;
  } else {
    task.man = spotAround(run, T.rescue.distance, 20);
    task.exit = exitFor(run, task.man);
  }
  run.task = task;
  run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 90 }, text: `Завдання: ${T[kind].text}`, color: '#ffd27a' });
  return task;
}

/** Where the arrow points: the nearest den, the man, or the way out once he follows. */
export function taskGoal(run: Run): Vec | null {
  const t = run.task;
  if (!t || t.state !== 'active') return null;
  if (t.kind === 'nests') {
    const h = run.hero.pos;
    let best: Vec | null = null;
    let bd = Infinity;
    for (const e of run.enemies) {
      if (!t.dens.includes(e.id)) continue;
      const d = Math.hypot(e.pos.x - h.x, e.pos.y - h.y);
      if (d < bd) {
        bd = d;
        best = e.pos;
      }
    }
    return best;
  }
  return t.following ? t.exit : t.man;
}

/** The line on the screen: «Знищте вовчі лігва: 1/3 · 0:52». */
export function taskLine(t: Task): string {
  const left = `${Math.floor(t.time / 60)}:${String(Math.floor(t.time % 60)).padStart(2, '0')}`;
  if (t.state === 'done') return 'Завдання виконано!';
  if (t.state === 'failed') return 'Завдання провалено';
  if (t.kind === 'nests') return `${T.nests.text}: ${t.denCount - t.dens.length}/${t.denCount} · ${left}`;
  return `${t.following ? 'Ведіть лісоруба до краю лісу' : 'Знайдіть лісоруба'} · ${left}`;
}

export function stepTask(run: Run, dt: number): void {
  const next = REWORK_LOCATIONS[run.location]!.tasks[run.tasksGiven];
  if (next && run.time >= next.at && run.phase === 'flood' && run.task?.state !== 'active') {
    const kind = taskKind(run);
    run.tasksGiven += 1;
    startTask(run, kind);
  }
  const t = run.task;
  if (!t || t.state !== 'active') return;
  t.time -= dt;
  const h = run.hero.pos;
  if (t.kind === 'rescue') {
    if (!t.following && Math.hypot(t.man.x - h.x, t.man.y - h.y) < T.rescue.follow) {
      t.following = true;
      run.events.push({ type: 'note', pos: { x: t.man.x, y: t.man.y - 50 }, text: 'Лісоруб: «Веди, я за тобою!»', color: '#e8d8b0' });
    }
    if (t.following) {
      const dx = h.x - t.man.x;
      const dy = h.y - t.man.y;
      const d = Math.hypot(dx, dy);
      // He walks while the hero is a few steps ahead, and a moment more to catch up.
      t.walking = d > 50;
      if (d > 50) {
        const step = Math.min(d - 50, T.rescue.speed * dt);
        t.man.x += (dx / d) * step;
        t.man.y += (dy / d) * step;
      }
      if (Math.hypot(t.exit.x - t.man.x, t.exit.y - t.man.y) < T.rescue.exitRadius) finish(run, true);
    }
  } else if (t.dens.length === 0) finish(run, true);
  if (t.state === 'active' && t.time <= 0) finish(run, false);
}

function finish(run: Run, ok: boolean): void {
  const t = run.task!;
  t.state = ok ? 'done' : 'failed';
  if (!ok) {
    // Dens left standing go quiet.
    for (const e of run.enemies) if (t.dens.includes(e.id)) e.dead = true;
    return;
  }
  run.chests.push({ pos: { x: run.hero.pos.x + 70, y: run.hero.pos.y } });
  if (t.kind === 'nests') run.noHowl = true;
  if (t.kind === 'webs') run.noBrood = true;
  if (t.kind === 'rescue') run.rescued = true;
  const spinner = REWORK_LOCATIONS[run.location]!.boss === 'spinner';
  const text = {
    nests: 'Лігва знищено: Ватажок не скличе вовків',
    webs: 'Павутиння знищено: Прядуха не скличе павучат',
    rescue: spinner ? 'Лісоруба врятовано: у бою він розрубає нитку' : 'Лісоруба врятовано: він допоможе в бою',
  }[t.kind];
  run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 90 }, text, color: '#ffd27a' });
}

/** A den's own step (a wolf den or a cocoon): it stands and sends its beast now and then while the hero is near. */
export function stepNest(run: Run, e: RunEnemy, dt: number): boolean {
  if (e.def !== 'nest' && e.def !== 'cocoon') return false;
  const kind = e.def === 'nest' ? 'nests' : 'webs';
  const D = T[kind];
  e.vel = { x: 0, y: 0 };
  const h = run.hero.pos;
  if (Math.hypot(e.pos.x - h.x, e.pos.y - h.y) > D.near) return true;
  e.moveTimer = (e.moveTimer ?? D.spawnEvery) - dt;
  if (e.moveTimer <= 0) {
    e.moveTimer = D.spawnEvery;
    const w = spawnBeast(run, DENS[kind].sends, e.pos);
    if (w) w.pos = { x: e.pos.x + e.radius + 14, y: e.pos.y + 6 };
  }
  return true;
}
