// The task of a location (ROADMAP 20.11, VISION §3): given at 1:30, a line on the screen, an
// arrow to the goal and a timer. In the Forest: destroy three wolf dens (each sends wolves while
// the hero is near) or lead a lumberjack to the forest's edge. Not doing it costs nothing; doing
// it gives a chest and weakens the boss — no dens, no howling wolves; the lumberjack saved —
// HP back when the boss comes.

import { REWORK_TASKS, type TaskKind } from '../../data/rework';
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

/** Which task the location gives (fixed by the run's seed). */
export function taskKind(run: Run): TaskKind {
  return (run.rng.seed & 1) === 0 ? 'nests' : 'rescue';
}

export function startTask(run: Run, kind: TaskKind): Task {
  const task: Task = { kind, time: T.duration, state: 'active', dens: [], denCount: 0, man: { x: 0, y: 0 }, following: false, exit: { x: 0, y: 0 } };
  if (kind === 'nests') {
    for (let i = 0; i < T.nests.count; i++) {
      const p = spotAround(run, T.nests.distance, T.nests.radius + 10);
      const e = spawnBeast(run, 'nest', p);
      if (!e) continue;
      e.pos = p;
      e.moveTimer = T.nests.spawnEvery * (0.3 + i * 0.25);
      task.dens.push(e.id);
    }
    task.denCount = task.dens.length;
  } else {
    task.man = spotAround(run, T.rescue.distance, 20);
    // The way out: the field's edge nearest to the man.
    const m = task.man;
    const edges = [
      { x: 60, y: m.y, d: m.x },
      { x: run.width - 60, y: m.y, d: run.width - m.x },
      { x: m.x, y: 60, d: m.y },
      { x: m.x, y: run.height - 60, d: run.height - m.y },
    ].sort((a, b) => a.d - b.d);
    task.exit = { x: edges[0]!.x, y: edges[0]!.y };
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
  if (!run.task && run.time >= T.startAt && run.phase === 'flood') startTask(run, taskKind(run));
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
  run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 90 }, text: t.kind === 'nests' ? 'Лігва знищено: Ватажок не скличе вовків' : 'Лісоруба врятовано: він допоможе в бою', color: '#ffd27a' });
}

/** A den's own step: it stands and sends a wolf now and then while the hero is near. */
export function stepNest(run: Run, e: RunEnemy, dt: number): boolean {
  if (e.def !== 'nest') return false;
  e.vel = { x: 0, y: 0 };
  const h = run.hero.pos;
  if (Math.hypot(e.pos.x - h.x, e.pos.y - h.y) > T.nests.near) return true;
  e.moveTimer = (e.moveTimer ?? T.nests.spawnEvery) - dt;
  if (e.moveTimer <= 0) {
    e.moveTimer = T.nests.spawnEvery;
    const w = spawnBeast(run, 'wolf', e.pos);
    if (w) w.pos = { x: e.pos.x + e.radius + 14, y: e.pos.y + 6 };
  }
  return true;
}
