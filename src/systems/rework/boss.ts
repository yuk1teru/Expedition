// The boss of a location (ROADMAP 20.12–20.13, VISION §3, docs/BOSSES.md). At 6:30 a warning;
// five seconds later the beasts stop and stand in a living ring around the hero — a wall that
// pushes back and hurts — the hero is untouchable for a moment, and the pack leader comes out.
// He dashes along a shown line, leaps at the hero (the landing circle shows first) and, often,
// leaps right after a dash to where the hero dodged — the combo. After a leap he stands, winded:
// the window to hit. Now and then he howls and wolves from the ring rush the hero (not if the
// dens were destroyed). His death wins the location: the ring scatters and, if the biome goes on,
// a path to the next location opens at the field's edge. In the deeper forest the spinner comes
// out instead (spinner.ts), and her ring is sticky: touching it holds the hero.

import { REWORK_BOSS, REWORK_ENEMIES, REWORK_LOCATIONS, REWORK_PATH, REWORK_TASKS } from '../../data/rework';
import type { Vec } from '../entities';
import { damageHero } from './combat';
import { spawnBeast } from './enemies';
import { buildGrid, isFree } from './map';
import type { Run, RunEnemy } from './types';

const B = REWORK_BOSS;
const A = B.alpha;
/** The ring is an oval on the ground: its height to its width. */
const FLAT_RING = 0.62;

/** Seconds of the run left until the boss (negative — he is here). */
export function bossIn(run: Run): number {
  return REWORK_LOCATIONS[run.location]!.bossAt + B.warnTime - run.time;
}

export function stepBossPhase(run: Run, dt: number): void {
  if (run.phase === 'flood' && run.time >= REWORK_LOCATIONS[run.location]!.bossAt) {
    run.phase = 'warning';
    run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 100 }, text: 'Земля тремтить…', color: '#ff8a6a' });
  }
  if (run.phase === 'warning' && bossIn(run) <= 0) formRing(run);
  if (run.phase === 'ring') stepRingWall(run, dt);
  if (run.phase === 'won') {
    // The ring scatters and is gone.
    for (const e of run.enemies) {
      if (e.boss) continue;
      if (e.act.kind === 'ring') e.act = { kind: 'walk' };
      e.fear = 99;
      if (Math.hypot(e.pos.x - run.ringCenter.x, e.pos.y - run.ringCenter.y) > B.ringRadius + 500) e.dead = true;
    }
    if (!run.path && run.location < REWORK_LOCATIONS.length - 1) run.path = pathSpot(run);
  }
}

/** The path on: a free spot at the field's edge nearest to the arena. */
function pathSpot(run: Run): { x: number; y: number } {
  const c = run.ringCenter;
  const m = 90;
  const edges = [
    { x: m, y: c.y, d: c.x },
    { x: run.width - m, y: c.y, d: run.width - c.x },
    { x: c.x, y: m, d: c.y },
    { x: c.x, y: run.height - m, d: run.height - c.y },
  ].sort((a, b) => a.d - b.d);
  const e = edges[0]!;
  const along = e.x === m || e.x === run.width - m ? { x: 0, y: 1 } : { x: 1, y: 0 };
  for (let k = 0; k < 40; k++) {
    const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 40;
    const p = { x: e.x + along.x * off, y: e.y + along.y * off };
    if (p.x < m || p.y < m || p.x > run.width - m || p.y > run.height - m) continue;
    if (isFree(run.grid, p, REWORK_PATH.radius * 0.6)) return p;
  }
  return { x: e.x, y: e.y };
}

/** The beasts stop and stand in a ring around the hero; the boss comes out. */
export function formRing(run: Run): void {
  const h = run.hero;
  run.phase = 'ring';
  run.ringCenter = { x: h.pos.x, y: h.pos.y };
  h.invuln = Math.max(h.invuln, B.invuln);
  // The arena is cleared: trees, bushes and stones inside the ring (and under it) give way; the
  // screen fades them out.
  const inside = run.obstacles.filter((o) => !outsideRing(run, o.pos, -(o.radius + 40)));
  if (inside.length > 0) {
    run.obstacles = run.obstacles.filter((o) => !inside.includes(o));
    run.grid = buildGrid(run.obstacles);
    run.cleared = inside;
  }
  // The spirit, the dens, cocoons, webs and spores have no place in the duel.
  run.shots = run.shots.filter((s) => s.byHero);
  for (const e of run.enemies) if (e.def === 'spirit' || e.def === 'nest' || e.def === 'cocoon') e.dead = true;
  run.webs = [];
  run.fogTarget = 0;
  let ring = run.enemies.filter((e) => !e.dead && !e.boss);
  // Too few to close the ring: wolves come to fill it; too many: the farthest go away.
  while (ring.length < B.ringMin) {
    const w = spawnBeast(run, 'wolf');
    if (!w) break;
    ring.push(w);
  }
  ring.sort((a, b) => Math.hypot(a.pos.x - h.pos.x, a.pos.y - h.pos.y) - Math.hypot(b.pos.x - h.pos.x, b.pos.y - h.pos.y));
  for (const e of ring.slice(B.ringMax)) e.dead = true;
  ring = ring.slice(0, B.ringMax);
  // Places on the circle, in the order of their angle (nobody crosses the arena to get there).
  ring.sort((a, b) => Math.atan2(a.pos.y - h.pos.y, a.pos.x - h.pos.x) - Math.atan2(b.pos.y - h.pos.y, b.pos.x - h.pos.x));
  // Not in a neat line: each a little off its even place along the ring, some a step further out.
  const step = (Math.PI * 2) / Math.max(1, ring.length);
  ring.forEach((e, i) => {
    const a = i * step + Math.PI + (run.rng.next() - 0.5) * step * B.ringScatter.along;
    const out = B.ringRadius + e.radius + run.rng.next() ** 2 * B.ringScatter.out;
    e.act = { kind: 'ring', slot: { x: run.ringCenter.x + Math.cos(a) * out, y: run.ringCenter.y + Math.sin(a) * out * 0.62 } };
    e.stun = 0;
    e.freeze = 0;
    e.fear = 0;
  });
  // The location's boss comes out of the ring.
  const id = REWORK_LOCATIONS[run.location]!.boss;
  const boss = spawnBeast(run, id, run.ringCenter);
  if (boss) {
    const def = B[id];
    // The pack leader and the spinner come out at the side; the Old Enat rises at the back of the ring.
    boss.pos = id === 'enat' ? { x: run.ringCenter.x, y: run.ringCenter.y - B.ringRadius * FLAT_RING * 0.25 } : { x: run.ringCenter.x + B.ringRadius * 0.6, y: run.ringCenter.y };
    boss.radius = def.radius;
    boss.boss = true;
    boss.hp = def.hp;
    boss.maxHp = def.hp;
    boss.power = 1;
    boss.moveTimer = 2.5;
    boss.traitTimer = id === 'spinner' ? B.spinner.cocoon.every * 0.6 : id === 'enat' ? 3 : boss.traitTimer;
    boss.howlTimer = id === 'spinner' ? B.spinner.brood.every : id === 'enat' ? B.enat.push.every : A.howl.every;
    // The Old Enat's first grab comes some seconds in.
    if (id === 'enat') boss.shots = B.enat.grab.every - 7;
  }
  // The saved lumberjack throws the hero a potion (the spinner's fight he helps in by cutting a thread).
  if (id === 'alpha' && run.rescued) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * REWORK_TASKS.rescueHeal);
}

/** The ring is an ellipse on the ground; true if the point is outside its inner edge. */
export function outsideRing(run: Run, p: Vec, margin = 0): boolean {
  const dx = (p.x - run.ringCenter.x) / (B.ringRadius - margin);
  const dy = (p.y - run.ringCenter.y) / ((B.ringRadius - margin) * 0.62);
  return dx * dx + dy * dy > 1;
}

/** The wall: the hero is pushed back inside (the beasts there bite — stepRingBeast); the spinner's ring holds him. */
function stepRingWall(run: Run, dt: number): void {
  const h = run.hero;
  run.wallTimer = Math.max(0, run.wallTimer - dt);
  if (!outsideRing(run, h.pos, 18)) return;
  const dx = h.pos.x - run.ringCenter.x;
  const dy = (h.pos.y - run.ringCenter.y) / 0.62;
  const a = Math.atan2(dy, dx);
  const r = B.ringRadius - 20;
  h.pos.x = run.ringCenter.x + Math.cos(a) * r;
  h.pos.y = run.ringCenter.y + Math.sin(a) * r * 0.62;
  if (h.dash && !h.dash.through) h.dash = null;
  if (run.wallTimer > 0) return;
  run.wallTimer = 1;
  // The spinner's ring is sticky: it holds the hero.
  if (REWORK_LOCATIONS[run.location]!.boss === 'spinner') h.root = Math.max(h.root, B.spinner.stick);
}

/** A beast in the ring walks to its place and stands there, facing in. */
export function stepRingBeast(run: Run, e: RunEnemy, dt: number): boolean {
  const act = e.act;
  if (act.kind !== 'ring' || e.boss) return false;
  const h = run.hero;
  const R = B.ringBite;
  const toH = { x: h.pos.x - e.pos.x, y: h.pos.y - e.pos.y };
  const dh = Math.hypot(toH.x, toH.y) || 1;
  e.touchTimer -= dt;
  act.bite = Math.max(0, (act.bite ?? 0) - dt);
  act.face = toH.x >= 0 ? 1 : -1;
  // The hero came close: it bites (and leans in for the bite).
  if (!h.dead && dh < e.radius + h.radius + R.reach && e.touchTimer <= 0 && run.phase === 'ring') {
    e.touchTimer = REWORK_ENEMIES[e.def].touchEvery;
    act.bite = R.time;
    damageHero(run, REWORK_ENEMIES[e.def].damage * e.power);
  }
  // Its place: shifting along the ring now and then; leaning towards the hero while it bites.
  // Its place; leaning towards the hero while it bites.
  const lean = (act.bite / R.time) * R.lunge;
  const to = { x: act.slot.x + (toH.x / dh) * lean, y: act.slot.y + (toH.y / dh) * lean };
  const dx = to.x - e.pos.x;
  const dy = to.y - e.pos.y;
  const d = Math.hypot(dx, dy);
  const speed = d > 30 ? 220 : 60 + 400 * (act.bite / R.time);
  const step = Math.min(d, speed * dt);
  e.vel = d > 0.5 ? { x: (dx / d) * Math.min(speed, d / dt), y: (dy / d) * Math.min(speed, d / dt) } : { x: 0, y: 0 };
  if (d > 0.5) {
    e.pos.x += (dx / d) * step;
    e.pos.y += (dy / d) * step;
  }
  return true;
}

/** The pack leader's own step; true — handled. */
export function stepAlpha(run: Run, e: RunEnemy, dt: number): boolean {
  if (!e.boss || e.def !== 'alpha') return false;
  const h = run.hero;
  const to = { x: h.pos.x - e.pos.x, y: h.pos.y - e.pos.y };
  const d = Math.hypot(to.x, to.y) || 1;
  const dir = { x: to.x / d, y: to.y / d };
  e.touchTimer -= dt;
  e.stun = Math.max(0, e.stun - dt);
  e.freeze = Math.max(0, e.freeze - dt);
  e.slowTime = Math.max(0, e.slowTime - dt);
  if (e.slowTime <= 0) e.slowMult = 1;
  if (h.dead || run.phase !== 'ring') {
    e.vel = { x: 0, y: 0 };
    return true;
  }
  if (e.stun > 0 || e.freeze > 0) {
    e.vel = { x: 0, y: 0 };
    return true;
  }
  // The howl: wolves of the ring rush the hero.
  e.howlTimer = (e.howlTimer ?? A.howl.every) - dt;
  if (e.howlTimer <= 0 && e.act.kind !== 'leapAir' && e.act.kind !== 'dash') {
    e.howlTimer = A.howl.every;
    if (!run.noHowl) {
      const ring = run.enemies.filter((o) => o.act.kind === 'ring' && o.def === 'wolf');
      ring.sort((a, b) => Math.hypot(a.pos.x - h.pos.x, a.pos.y - h.pos.y) - Math.hypot(b.pos.x - h.pos.x, b.pos.y - h.pos.y));
      for (const w of ring.slice(0, A.howl.wolves)) w.act = { kind: 'walk' };
      run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 70 }, text: 'Ватажок виє — зграя кидається!', color: '#ff8a6a' });
    }
  }
  const act = e.act;
  let speed = 0;
  let move = dir;
  if (act.kind === 'dashWind') {
    act.time -= dt;
    if (act.time <= 0) e.act = { kind: 'dash', time: A.dash.length / A.dash.speed, dir: act.dir };
  } else if (act.kind === 'dash') {
    act.time -= dt;
    speed = A.dash.speed;
    move = act.dir;
    // The dash hits once if the hero is in its way.
    if (e.touchTimer <= 0 && d < e.radius + h.radius + 6) {
      e.touchTimer = 0.6;
      damageHero(run, A.dash.damage);
    }
    if (act.time <= 0 || outsideRing(run, { x: e.pos.x + act.dir.x * 20, y: e.pos.y + act.dir.y * 20 }, 30)) {
      // The combo: a leap right away, to where the hero went.
      if (run.rng.next() < A.combo) e.act = { kind: 'leapWind', time: A.leap.windup * 0.7, to: { x: h.pos.x, y: h.pos.y }, from: { x: e.pos.x, y: e.pos.y } };
      else e.act = { kind: 'walk' };
    }
  } else if (act.kind === 'leapWind') {
    act.time -= dt;
    if (act.time <= 0) e.act = { kind: 'leapAir', time: A.leap.time, to: act.to, from: { x: e.pos.x, y: e.pos.y } };
  } else if (act.kind === 'leapAir') {
    act.time -= dt;
    const k = 1 - Math.max(0, act.time) / A.leap.time;
    e.pos.x = act.from.x + (act.to.x - act.from.x) * k;
    e.pos.y = act.from.y + (act.to.y - act.from.y) * k;
    if (act.time <= 0) {
      if (Math.hypot(h.pos.x - act.to.x, h.pos.y - act.to.y) < A.leap.radius + h.radius) damageHero(run, A.leap.damage);
      run.events.push({ type: 'blast', pos: act.to, radius: A.leap.radius, color: '#c9a36b' });
      e.act = { kind: 'rest', time: A.rest };
    }
    e.vel = { x: act.to.x - act.from.x, y: 0 };
    return true;
  } else if (act.kind === 'rest') {
    act.time -= dt;
    if (act.time <= 0) e.act = { kind: 'walk' };
  } else {
    // Walking at the hero; a dash or a leap when ready.
    e.moveTimer = (e.moveTimer ?? A.dash.every) - dt;
    speed = d > 140 ? A.speed : A.speed * A.nearSpeed;
    if (e.moveTimer <= 0) {
      e.moveTimer = A.dash.every;
      if (d > 170 || run.rng.next() < 0.5) e.act = { kind: 'dashWind', time: A.dash.windup, dir };
      else e.act = { kind: 'leapWind', time: A.leap.windup, to: { x: h.pos.x, y: h.pos.y }, from: { x: e.pos.x, y: e.pos.y } };
    }
    if (d < e.radius + h.radius + 4 && e.touchTimer <= 0) {
      e.touchTimer = 0.8;
      damageHero(run, A.touch);
    }
  }
  e.vel = { x: move.x * speed * e.slowMult, y: move.y * speed * e.slowMult };
  e.pos.x += e.vel.x * dt;
  e.pos.y += e.vel.y * dt;
  return true;
}
