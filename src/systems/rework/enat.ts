// The Old Enat, the Forest's boss (ROADMAP 20.15, docs/BOSSES.md), and the strikes on the ground
// he makes. He walks after the hero, slow and heavy, and stops near him. Phase 1: roots burst under the hero
// one after another, he slams the ground around himself, and roots shove the ring's beasts at the
// hero; the combo — his branch always catches the hero, pulls him in and he charges a slam (a
// dodge in the charge breaks free). Phase 2 (60%): the forest turns to stone — boulders in the
// arena — and thorns run in eight lines across it with a spike under the hero. Phase 3 (25%): he
// stands, his bark cracks (he takes more damage), thorns never stop, and only the moving shade of
// his crown keeps them off.

import { REWORK_BOSS } from '../../data/rework';
import type { Vec } from '../entities';
import { outsideRing } from './boss';
import { damageHero } from './combat';
import { buildGrid, isFree, resolveBody } from './map';
import type { Hazard, Run, RunEnemy } from './types';

const E = REWORK_BOSS.enat;
const FLAT = 0.62;

function hazard(run: Run, h: Omit<Hazard, 'after' | 'struck' | 'total'>): void {
  run.hazards.push({ ...h, total: h.warn, after: 0.35, struck: false });
}

/** Whether a point is in the crown's shade (phase 3). */
export function inShade(run: Run, p: Vec): boolean {
  const s = run.shade;
  return !!s && Math.hypot(p.x - s.pos.x, (p.y - s.pos.y) / FLAT) < E.shade.radius;
}

function nearLine(p: Vec, a: Vec, dir: Vec, length: number): number {
  const k = Math.max(0, Math.min(length, (p.x - a.x) * dir.x + (p.y - a.y) * dir.y));
  return Math.hypot(p.x - (a.x + dir.x * k), p.y - (a.y + dir.y * k));
}

/** Strikes on the ground: they wait, show, strike once and linger a moment. */
export function stepHazards(run: Run, dt: number): void {
  const h = run.hero;
  for (const z of run.hazards) {
    if (z.delay > 0) {
      z.delay -= dt;
      if (z.follow) z.pos = { x: h.pos.x, y: h.pos.y };
      continue;
    }
    if (!z.struck) {
      z.warn -= dt;
      if (z.warn > 0) continue;
      z.struck = true;
      const safe = z.shadeSafe && inShade(run, h.pos);
      const hit = z.dir ? nearLine(h.pos, z.pos, z.dir, z.length ?? 0) < z.radius / 2 + h.radius : Math.hypot(h.pos.x - z.pos.x, (h.pos.y - z.pos.y) / FLAT) < z.radius + h.radius;
      if (hit && !safe) damageHero(run, z.damage);
      continue;
    }
    z.after -= dt;
  }
  run.hazards = run.hazards.filter((z) => !z.struck || z.after > 0);
  // The shade drifts to a new place inside the ring now and then.
  const s = run.shade;
  if (s) {
    const dx = s.to.x - s.pos.x;
    const dy = s.to.y - s.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 5) s.to = ringSpot(run, 60);
    else {
      s.pos.x += (dx / d) * Math.min(d, E.shade.speed * dt);
      s.pos.y += (dy / d) * Math.min(d, E.shade.speed * dt);
    }
  }
}

/** A random point inside the ring, `margin` from its edge. */
function ringSpot(run: Run, margin: number): Vec {
  const R = REWORK_BOSS.ringRadius - margin;
  for (let i = 0; i < 20; i++) {
    const a = run.rng.next() * Math.PI * 2;
    const r = Math.sqrt(run.rng.next()) * R;
    const p = { x: run.ringCenter.x + Math.cos(a) * r, y: run.ringCenter.y + Math.sin(a) * r * FLAT };
    if (!outsideRing(run, p, margin)) return p;
  }
  return { x: run.ringCenter.x, y: run.ringCenter.y };
}

/** Thorns in eight lines from him across the arena and a spike under the hero, all at once. */
function thorns(run: Run, e: RunEnemy, spike: boolean): void {
  const T = E.thorns;
  const base = run.rng.next() * (Math.PI / 4);
  for (let i = 0; i < 8; i++) {
    const a = base + (i * Math.PI) / 4;
    // Along the ground's oval: the lines are flatter up and down.
    const l = Math.hypot(Math.cos(a), Math.sin(a) * FLAT);
    hazard(run, { kind: 'thorn', pos: { x: e.pos.x, y: e.pos.y }, dir: { x: Math.cos(a) / l, y: (Math.sin(a) * FLAT) / l }, length: T.length, radius: T.width, delay: 0, warn: T.warn, damage: T.damage, shadeSafe: true });
  }
  if (spike) hazard(run, { kind: 'spike', pos: { x: run.hero.pos.x, y: run.hero.pos.y }, radius: T.spike, delay: 0, warn: T.warn, damage: T.damage, shadeSafe: true });
}

/** Phase 2 begins: the forest turns to stone — boulders rise in the arena. */
function petrify(run: Run, e: RunEnemy): void {
  for (let i = 0, tries = 0; i < E.stones && tries < 60; tries++) {
    const p = ringSpot(run, 50);
    if (Math.hypot(p.x - run.hero.pos.x, p.y - run.hero.pos.y) < 90 || Math.hypot(p.x - e.pos.x, p.y - e.pos.y) < e.radius + 70) continue;
    if (!isFree(run.grid, p, 30)) continue;
    run.obstacles.push({ kind: 'stone', pos: p, radius: 18 + run.rng.next() * 6, height: 0, seed: run.rng.next(), art: 'enat' });
    i++;
  }
  run.grid = buildGrid(run.obstacles);
  run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 130 }, text: 'Ліс кам’яніє!', color: '#c8c8c0' });
}

/** The Old Enat's own step; true — handled. */
export function stepEnat(run: Run, e: RunEnemy, dt: number): boolean {
  if (!e.boss || e.def !== 'enat') return false;
  const h = run.hero;
  e.vel = { x: 0, y: 0 };
  e.touchTimer -= dt;
  e.stun = 0;
  e.freeze = 0;
  // He stands: the hero is pushed off his trunk, not him.
  const dx = h.pos.x - e.pos.x;
  const dy = h.pos.y - e.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < e.radius + h.radius && !h.dead) {
    h.pos.x = e.pos.x + (dx / d) * (e.radius + h.radius);
    h.pos.y = e.pos.y + (dy / d) * (e.radius + h.radius);
  }
  if (h.dead || run.phase !== 'ring') return true;
  // Phases by HP.
  const phase = e.hp < e.maxHp * E.phases[1]! ? 2 : e.hp < e.maxHp * E.phases[0]! ? 1 : 0;
  if (phase > run.bossPhase) {
    run.bossPhase = phase;
    run.hazards = run.hazards.filter((z) => z.kind !== 'root');
    if (phase === 1) petrify(run, e);
    if (phase === 2) {
      run.shade = { pos: ringSpot(run, 60), to: ringSpot(run, 60) };
      e.act = { kind: 'walk' };
      h.root = 0;
      run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 130 }, text: 'Кора тріскає — ховайся в тінь крони!', color: '#ffb060' });
    }
    e.moveTimer = 1.5;
  }
  if (d < e.radius + h.radius + 6 && e.touchTimer <= 0) {
    e.touchTimer = 1;
    damageHero(run, E.touch);
  }
  // Phase 3: he only stands, cracked; the thorns never stop.
  if (run.bossPhase === 2) {
    e.moveTimer = (e.moveTimer ?? E.shade.every) - dt;
    if (e.moveTimer <= 0) {
      e.moveTimer = E.shade.every;
      thorns(run, e, false);
    }
    return true;
  }
  const act = e.act;
  if (act.kind === 'grab') {
    act.time -= dt;
    if (act.time <= 0) {
      // The branch always catches.
      h.root = E.grab.pull + E.grab.charge;
      h.dash = null;
      e.act = { kind: 'pull', time: E.grab.pull, from: { x: h.pos.x, y: h.pos.y } };
      run.events.push({ type: 'note', pos: { x: h.pos.x, y: h.pos.y - 80 }, text: 'Гілка схопила! Ухил — коли заряджає удар', color: '#ffb060' });
    }
    return true;
  }
  if (act.kind === 'pull') {
    act.time -= dt;
    // Dragged to his trunk, unless a dodge broke free.
    if (h.root > 0) {
      const k = 1 - Math.max(0, act.time) / E.grab.pull;
      const to = { x: e.pos.x, y: e.pos.y + e.radius + h.radius + 6 };
      h.pos.x = act.from.x + (to.x - act.from.x) * k;
      h.pos.y = act.from.y + (to.y - act.from.y) * k;
    }
    if (act.time <= 0) {
      e.act = { kind: 'charge', time: E.grab.charge };
      hazard(run, { kind: 'slam', pos: { x: e.pos.x, y: e.pos.y }, radius: E.grab.radius, delay: 0, warn: E.grab.charge, damage: E.grab.damage });
    }
    return true;
  }
  if (act.kind === 'charge') {
    act.time -= dt;
    if (act.time <= 0) e.act = { kind: 'walk' };
    return true;
  }
  // He walks after the hero — slow and heavy — and stops near him; never out of the ring.
  if (d > E.walk.keep) {
    const step = { x: (dx / d) * E.walk.speed * dt, y: (dy / d) * E.walk.speed * dt };
    const next = { x: e.pos.x + step.x, y: e.pos.y + step.y };
    if (!outsideRing(run, next, e.radius + 10)) {
      e.pos = next;
      resolveBody(run.grid, e.pos, e.radius, run.width, run.height);
      e.vel = { x: step.x / dt, y: step.y / dt };
    }
  }
  // Roots under the hero, one after another.
  e.moveTimer = (e.moveTimer ?? E.roots.every) - dt;
  if (e.moveTimer <= 0) {
    e.moveTimer = E.roots.every * (run.bossPhase === 1 ? 1.4 : 1);
    for (let i = 0; i < E.roots.count; i++) hazard(run, { kind: 'root', pos: { x: h.pos.x, y: h.pos.y }, radius: E.roots.radius, delay: i * E.roots.gap, follow: true, warn: E.roots.warn, damage: E.roots.damage });
  }
  // Roots shove ring beasts at the hero.
  e.howlTimer = (e.howlTimer ?? E.push.every) - dt;
  if (e.howlTimer <= 0) {
    e.howlTimer = E.push.every;
    const ring = run.enemies.filter((o) => o.act.kind === 'ring');
    ring.sort((a, b) => Math.hypot(a.pos.x - h.pos.x, a.pos.y - h.pos.y) - Math.hypot(b.pos.x - h.pos.x, b.pos.y - h.pos.y));
    for (const w of ring.slice(0, E.push.beasts)) w.act = { kind: 'walk' };
    if (ring.length > 0) run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 130 }, text: 'Коріння штовхає звірів до тебе!', color: '#ff8a6a' });
  }
  // The combo, a slam when the hero is near, thorns in phase 2.
  e.traitTimer -= dt;
  e.shots += dt;
  if (e.traitTimer <= 0) {
    if (e.shots >= E.grab.every) {
      e.shots = 0;
      e.traitTimer = E.grab.warn + E.grab.pull + E.grab.charge + 1.5;
      e.act = { kind: 'grab', time: E.grab.warn };
    } else if (run.bossPhase === 1) {
      e.traitTimer = E.thorns.every;
      thorns(run, e, true);
    } else if (d < E.slam.radius + 40) {
      e.traitTimer = E.slam.every;
      hazard(run, { kind: 'slam', pos: { x: e.pos.x, y: e.pos.y }, radius: E.slam.radius, delay: 0, warn: E.slam.warn, damage: E.slam.damage });
    } else e.traitTimer = 0.5;
  }
  return true;
}
