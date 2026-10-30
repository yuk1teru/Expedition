// The flood and the Forest's beasts (ROADMAP 20.3). Beasts come without a break from just
// outside the view: few at first, ever more often, each a bit stronger than the one before.
// The wolf crouches and leaps along a shown line, the mushroom keeps away and spits spores
// (every third time a fan), the stump stomps a ring around itself.

import { REWORK_ENEMIES, REWORK_FLOOD, type ReworkEnemyId } from '../../data/rework';
import type { Vec } from '../entities';
import { damageHero } from './combat';
import { blocksShot, isFree, resolveBody } from './map';
import type { Run, RunEnemy } from './types';

const F = REWORK_FLOOD;

/** Seconds between spawns at run time `t`: eased from the start value to the end value. */
export function spawnInterval(t: number): number {
  const k = Math.min(1, t / F.rampTime);
  const eased = k * k * (3 - 2 * k);
  return F.intervalStart + (F.intervalEnd - F.intervalStart) * eased;
}

/** How much stronger a beast that comes at run time `t` is (HP and damage). */
export function powerAt(t: number): { hp: number; damage: number } {
  const min = t / 60;
  return { hp: 1 + F.hpPerMinute * min, damage: 1 + F.damagePerMinute * min };
}

function pickBeast(run: Run): ReworkEnemyId {
  const pool: ReworkEnemyId[] = ['wolf'];
  if (run.time >= F.mushroomFrom) pool.push('mushroom');
  if (run.time >= F.stumpFrom) pool.push('stump');
  const total = pool.reduce((s, id) => s + REWORK_ENEMIES[id].weight, 0);
  let r = run.rng.next() * total;
  for (const id of pool) {
    r -= REWORK_ENEMIES[id].weight;
    if (r <= 0) return id;
  }
  return pool[0]!;
}

export function spawnBeast(run: Run, def: ReworkEnemyId, near?: Vec): RunEnemy | null {
  const d = REWORK_ENEMIES[def];
  const h = run.hero;
  for (let tries = 0; tries < 12; tries++) {
    const a = run.rng.next() * Math.PI * 2;
    const dist = F.spawnDistance[0] + run.rng.next() * (F.spawnDistance[1] - F.spawnDistance[0]);
    const c = near ?? h.pos;
    const pos = { x: c.x + Math.cos(a) * dist, y: c.y + Math.sin(a) * dist };
    if (pos.x < d.radius || pos.y < d.radius || pos.x > run.width - d.radius || pos.y > run.height - d.radius) continue;
    if (!isFree(run.grid, pos, d.radius)) continue;
    const p = powerAt(run.time);
    const e: RunEnemy = {
      id: run.nextId++,
      def,
      pos,
      vel: { x: 0, y: 0 },
      radius: d.radius,
      hp: d.hp * p.hp,
      maxHp: d.hp * p.hp,
      power: p.damage,
      act: { kind: 'walk' },
      traitTimer: 1 + run.rng.next() * 2,
      touchTimer: 0,
      shots: 0,
      hitAt: -Infinity,
      dead: false,
    };
    run.enemies.push(e);
    return e;
  }
  return null;
}

/** The flood: spawns on its timer, a few at once later on. */
export function stepFlood(run: Run, dt: number): void {
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  run.spawnTimer += spawnInterval(run.time);
  const group = 1 + Math.floor(Math.min(1, run.time / F.rampTime) * (F.groupEnd - 1) + run.rng.next() * 0.5);
  for (let i = 0; i < group && run.enemies.length < F.maxAlive; i++) spawnBeast(run, pickBeast(run));
}

const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

function stepBeast(run: Run, e: RunEnemy, dt: number): void {
  const d = REWORK_ENEMIES[e.def];
  const h = run.hero;
  const to = { x: h.pos.x - e.pos.x, y: h.pos.y - e.pos.y };
  const dist = Math.hypot(to.x, to.y);
  const dir = norm(to);
  e.traitTimer -= dt;
  e.touchTimer -= dt;
  let speed = d.speed;
  let move = dir;
  const act = e.act;
  if (act.kind === 'crouch') {
    act.time -= dt;
    speed = 0;
    if (act.time <= 0) e.act = { kind: 'leap', time: d.leap!.time, dir: act.dir };
  } else if (act.kind === 'leap') {
    act.time -= dt;
    speed = d.speed * d.leap!.speedMult;
    move = act.dir;
    if (act.time <= 0) e.act = { kind: 'walk' };
  } else if (act.kind === 'aim') {
    act.time -= dt;
    speed = 0;
    if (act.time <= 0) {
      spit(run, e, act.dir, act.fan);
      e.act = { kind: 'walk' };
    }
  } else if (act.kind === 'stomp') {
    act.time -= dt;
    speed = 0;
    if (act.time <= 0) {
      const s = d.stomp!;
      if (Math.hypot(h.pos.x - e.pos.x, h.pos.y - e.pos.y) <= s.reach + e.radius + h.radius) damageHero(run, s.damage * e.power);
      e.act = { kind: 'walk' };
    }
  } else {
    // Walking: start a trait when it is ready and the hero is in reach.
    if (d.leap && e.traitTimer <= 0 && dist < d.leap.trigger) {
      e.traitTimer = d.leap.every;
      e.act = { kind: 'crouch', time: d.leap.windup, dir };
      speed = 0;
    } else if (d.spit && e.traitTimer <= 0 && dist < d.spit.range) {
      e.traitTimer = d.spit.every;
      e.shots += 1;
      e.act = { kind: 'aim', time: d.spit.windup, dir, fan: e.shots % d.spit.fanEvery === 0 };
      speed = 0;
    } else if (d.stomp && e.traitTimer <= 0 && dist < d.stomp.trigger + e.radius) {
      e.traitTimer = d.stomp.every;
      e.act = { kind: 'stomp', time: d.stomp.delay };
      speed = 0;
    } else if (d.spit && dist < d.spit.keep) {
      // The mushroom backs away to keep its distance.
      move = { x: -dir.x, y: -dir.y };
      speed = d.speed * 0.6;
    }
  }
  e.vel = { x: move.x * speed, y: move.y * speed };
  e.pos.x += e.vel.x * dt;
  e.pos.y += e.vel.y * dt;
  // A bite on touch.
  if (dist <= e.radius + h.radius + 2 && e.touchTimer <= 0) {
    e.touchTimer = d.touchEvery;
    damageHero(run, d.damage * e.power);
  }
}

function spit(run: Run, e: RunEnemy, dir: Vec, fan: boolean): void {
  const s = REWORK_ENEMIES[e.def].spit!;
  const base = Math.atan2(dir.y, dir.x);
  const count = fan ? s.fanCount : 1;
  for (let i = 0; i < count; i++) {
    const a = base + (count === 1 ? 0 : ((i - (count - 1) / 2) * s.fanDeg * Math.PI) / 180);
    run.shots.push({
      pos: { x: e.pos.x + Math.cos(a) * e.radius, y: e.pos.y + Math.sin(a) * e.radius },
      vel: { x: Math.cos(a) * s.speed, y: Math.sin(a) * s.speed },
      radius: 6,
      damage: s.damage * e.power,
      life: s.range / s.speed,
      byHero: false,
      kind: 'spore',
      pierce: 0,
      hit: [],
    });
  }
}

const cellKey = (cx: number, cy: number): number => cx * 100003 + cy;

export function stepBeasts(run: Run, dt: number): void {
  for (const e of run.enemies) if (!e.dead) stepBeast(run, e, dt);
  // Push apart through a grid of cells, then out of obstacles and the hero.
  const C = 32;
  const cells = new Map<number, RunEnemy[]>();
  for (const e of run.enemies) {
    if (e.dead) continue;
    const k = cellKey(Math.floor(e.pos.x / C), Math.floor(e.pos.y / C));
    const list = cells.get(k);
    if (list) list.push(e);
    else cells.set(k, [e]);
  }
  const h = run.hero;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const cx = Math.floor(e.pos.x / C);
    const cy = Math.floor(e.pos.y / C);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = cells.get(cellKey(cx + ox, cy + oy));
        if (!list) continue;
        for (const o of list) {
          if (o === e) continue;
          const dx = e.pos.x - o.pos.x;
          const dy = e.pos.y - o.pos.y;
          const dist = Math.hypot(dx, dy);
          const min = e.radius + o.radius;
          if (dist >= min || dist === 0) continue;
          const push = (min - dist) / 2 / dist;
          e.pos.x += dx * push;
          e.pos.y += dy * push;
          o.pos.x -= dx * push;
          o.pos.y -= dy * push;
        }
      }
    }
    const dx = e.pos.x - h.pos.x;
    const dy = e.pos.y - h.pos.y;
    const dist = Math.hypot(dx, dy);
    const reach = e.radius + h.radius;
    if (dist < reach && dist > 0 && !h.dead) {
      e.pos.x = h.pos.x + (dx / dist) * reach;
      e.pos.y = h.pos.y + (dy / dist) * reach;
    }
    resolveBody(run.grid, e.pos, e.radius, run.width, run.height);
  }
  run.enemies = run.enemies.filter((e) => !e.dead);
}

/** Beast spores fly until they hit the hero, a tree or run out. */
export function stepBeastShots(run: Run, dt: number): void {
  const h = run.hero;
  for (const s of run.shots) {
    if (s.byHero) continue;
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.life -= dt;
    if (blocksShot(run.grid, s.pos)) s.life = 0;
    else if (!h.dead && Math.hypot(s.pos.x - h.pos.x, s.pos.y - h.pos.y) < s.radius + h.radius) {
      damageHero(run, s.damage);
      s.life = 0;
    }
  }
}
