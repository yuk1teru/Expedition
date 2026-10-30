// The spinner, the boss of the deeper forest (ROADMAP 20.14, docs/BOSSES.md), and the webs of that
// location. She skitters around the hero at a distance inside the living ring and now and then
// lays a thread across the arena (shown thin first; touching it slows the hero). Every few seconds
// she rears and spits a cocoon — a hit wraps the hero (a dodge breaks free) — and the combo
// follows: she pulls every thread to the hero, a ring of web closing on him with one clear gap
// (two, if the lumberjack was saved). After the pull the threads tear and she stands open. She
// calls spiderlings unless the cocoons were destroyed. Spiders of the flood leave sticky webs on
// the ground; webs and threads slow the hero.

import { REWORK_BOSS, REWORK_WEB } from '../../data/rework';
import type { Vec } from '../entities';
import { outsideRing } from './boss';
import { damageHero } from './combat';
import { spawnBeast } from './enemies';
import type { Run, RunEnemy } from './types';

const S = REWORK_BOSS.spinner;
/** The ring's oval: the ground is seen from above at an angle. */
const FLAT = 0.62;

/** Where a line through `p` along angle `a` crosses the ring's edge (both ends). */
function chord(run: Run, p: Vec, a: number): [Vec, Vec] {
  const c = run.ringCenter;
  const rx = REWORK_BOSS.ringRadius - 12;
  const ry = rx * FLAT;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const ox = (p.x - c.x) / rx;
  const oy = (p.y - c.y) / ry;
  const vx = dx / rx;
  const vy = dy / ry;
  const A = vx * vx + vy * vy;
  const B = 2 * (ox * vx + oy * vy);
  const C = ox * ox + oy * oy - 1;
  const disc = Math.max(0, B * B - 4 * A * C);
  const t1 = (-B - Math.sqrt(disc)) / (2 * A);
  const t2 = (-B + Math.sqrt(disc)) / (2 * A);
  return [
    { x: p.x + dx * t1, y: p.y + dy * t1 },
    { x: p.x + dx * t2, y: p.y + dy * t2 },
  ];
}

/** A new thread across the arena, near the hero. */
export function layThread(run: Run): void {
  const h = run.hero.pos;
  const p = { x: h.x + (run.rng.next() - 0.5) * 120, y: h.y + (run.rng.next() - 0.5) * 80 };
  const [a, b] = chord(run, p, run.rng.next() * Math.PI);
  run.threads.push({ a, b, warn: S.threads.warn });
}

/** The pull's closing ring now: its pieces of web (the gaps left out) — or, with `gaps`, only the gaps. */
export function pullSegments(run: Run, gaps = false): [Vec, Vec][] {
  const p = run.pull;
  if (!p) return [];
  const N = S.pull.segments;
  const R = S.pull.radius * (1 - Math.max(0, p.time) / S.pull.time);
  const at = (i: number): Vec => {
    const a = p.base + (i / N) * Math.PI * 2;
    return { x: p.center.x + Math.cos(a) * R, y: p.center.y + Math.sin(a) * R * FLAT };
  };
  const out: [Vec, Vec][] = [];
  for (let i = 0; i < N; i++) if (p.gaps.includes(i) === gaps) out.push([at(i), at(i + 1)]);
  return out;
}

function nearSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
}

/** Starts the pull a moment after the cocoon: centred on the hero, one gap (two with the lumberjack's help). */
function startPull(run: Run): void {
  const N = S.pull.segments;
  const g = Math.floor(run.rng.next() * N);
  const gaps = run.rescued ? [g, (g + N / 2) % N] : [g];
  run.pull = { center: { x: run.hero.pos.x, y: run.hero.pos.y }, time: -S.pull.delay, base: run.rng.next() * Math.PI * 2, gaps, hit: false };
  if (run.rescued) run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 90 }, text: 'Лісоруб розрубав нитку!', color: '#e8d8b0' });
}

/** Webs on the ground, threads and the pull: they age, the pull closes, the hero is slowed in them. */
export function stepWebs(run: Run, dt: number): void {
  const h = run.hero;
  for (const w of run.webs) w.time -= dt;
  run.webs = run.webs.filter((w) => w.time > 0);
  for (const t of run.threads) t.warn = Math.max(0, t.warn - dt);
  const p = run.pull;
  if (p) {
    // Until it closes it follows the hero; then it closes on the spot.
    if (p.time < 0) p.center = { x: h.pos.x, y: h.pos.y };
    p.time += dt;
    if (p.time >= 0 && !p.hit && pullSegments(run).some(([a, b]) => nearSegment(h.pos, a, b) < h.radius + 3)) {
      p.hit = true;
      damageHero(run, S.pull.damage);
    }
    if (p.time >= S.pull.time) {
      // The threads tear; she stands open.
      run.pull = null;
      run.threads = [];
      const boss = run.enemies.find((e) => e.boss && e.def === 'spinner');
      if (boss) {
        boss.act = { kind: 'rest', time: S.rest };
        boss.vel = { x: 0, y: 0 };
      }
      run.events.push({ type: 'note', pos: { x: h.pos.x, y: h.pos.y - 90 }, text: 'Нитки порвано — Прядуха відкрита!', color: '#ffd27a' });
    }
  }
  // Slowed in a web on the ground or on a thread.
  h.slow = 1;
  if (run.webs.some((w) => Math.hypot(w.pos.x - h.pos.x, (w.pos.y - h.pos.y) / FLAT) < w.radius)) h.slow = REWORK_WEB.slow;
  if (!run.pull && run.threads.some((t) => t.warn <= 0 && nearSegment(h.pos, t.a, t.b) < h.radius + 2)) h.slow = Math.min(h.slow, S.threads.slow);
}

/** The spinner's own step; true — handled. */
export function stepSpinner(run: Run, e: RunEnemy, dt: number): boolean {
  if (!e.boss || e.def !== 'spinner') return false;
  const h = run.hero;
  const to = { x: h.pos.x - e.pos.x, y: h.pos.y - e.pos.y };
  const d = Math.hypot(to.x, to.y) || 1;
  const dir = { x: to.x / d, y: to.y / d };
  e.touchTimer -= dt;
  e.stun = Math.max(0, e.stun - dt);
  e.freeze = Math.max(0, e.freeze - dt);
  e.slowTime = Math.max(0, e.slowTime - dt);
  if (e.slowTime <= 0) e.slowMult = 1;
  e.vel = { x: 0, y: 0 };
  if (h.dead || run.phase !== 'ring' || e.stun > 0 || e.freeze > 0) return true;
  // Spiderlings from her cocoons, unless the cocoons were destroyed.
  e.howlTimer = (e.howlTimer ?? S.brood.every) - dt;
  if (e.howlTimer <= 0) {
    e.howlTimer = S.brood.every;
    if (!run.noBrood) {
      for (let i = 0; i < S.brood.count; i++) {
        const s = spawnBeast(run, 'spider', e.pos);
        if (s) s.pos = { x: e.pos.x + Math.cos(i * 2.1) * 40, y: e.pos.y + Math.sin(i * 2.1) * 25 };
      }
      run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 70 }, text: 'Прядуха кличе павучат!', color: '#ff8a6a' });
    }
  }
  // Threads, now and then, while no pull is on.
  e.moveTimer = (e.moveTimer ?? S.threads.every) - dt;
  if (e.moveTimer <= 0 && !run.pull && e.act.kind !== 'rest') {
    e.moveTimer = S.threads.every;
    if (run.threads.length < S.threads.max) layThread(run);
  }
  const act = e.act;
  if (act.kind === 'spitWind') {
    act.time -= dt;
    if (act.time <= 0) {
      // The cocoon, then the pull.
      run.shots.push({
        pos: { x: e.pos.x + dir.x * e.radius, y: e.pos.y + dir.y * e.radius },
        vel: { x: dir.x * S.cocoon.speed, y: dir.y * S.cocoon.speed },
        radius: S.cocoon.radius,
        damage: 0,
        life: 1.6,
        byHero: false,
        kind: 'cocoon',
        pierce: 0,
        hit: [],
      });
      startPull(run);
      e.act = { kind: 'walk' };
    }
    return true;
  }
  if (act.kind === 'rest') {
    act.time -= dt;
    if (act.time <= 0) e.act = { kind: 'walk' };
    return true;
  }
  e.traitTimer -= dt;
  if (e.traitTimer <= 0 && !run.pull) {
    e.traitTimer = S.cocoon.every;
    e.act = { kind: 'spitWind', time: S.cocoon.windup, dir };
    return true;
  }
  // Skitters around the hero at her distance; never through the ring.
  const want = d > S.keep + 40 ? 1 : d < S.keep - 40 ? -1 : 0;
  const side = Math.sin(run.time * 1.3 + e.id) > 0 ? 1 : -1;
  let mx = dir.x * want - dir.y * side * 0.9;
  let my = dir.y * want + dir.x * side * 0.9;
  if (outsideRing(run, { x: e.pos.x + mx * 30, y: e.pos.y + my * 30 }, e.radius + 20)) {
    mx = run.ringCenter.x - e.pos.x;
    my = run.ringCenter.y - e.pos.y;
  }
  const l = Math.hypot(mx, my) || 1;
  e.vel = { x: (mx / l) * S.speed * e.slowMult, y: (my / l) * S.speed * e.slowMult };
  e.pos.x += e.vel.x * dt;
  e.pos.y += e.vel.y * dt;
  if (d < e.radius + h.radius + 4 && e.touchTimer <= 0) {
    e.touchTimer = 0.8;
    damageHero(run, S.touch);
  }
  return true;
}
