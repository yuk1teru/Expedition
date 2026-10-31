// The flood and the Forest's beasts (ROADMAP 20.3, 20.9). Beasts come without a break from just
// outside the view: few at first, ever more often, each a bit stronger than the one before.
// The wolf crouches and leaps along a shown line — each wolf in its own way (bold, hesitant,
// timid), never the whole pack at once, coming from the sides — the mushroom keeps away and spits spores
// (every third time a fan), the stump stomps a ring around itself, the spider (the deeper forest)
// spits webs that stick the ground. Elites come on a timer, larger and with a trait. The special beasts (the spirit, dens, the boss) and the beasts standing in
// the living ring are stepped by their own code, passed in as `special`.

import { type EliteTrait, REWORK_BOSS, REWORK_ELITES, REWORK_ENEMIES, REWORK_FLOOD, REWORK_LOCATIONS, REWORK_WEB, type ReworkEnemyId } from '../../data/rework';
import type { Vec } from '../entities';
import { damageHero } from './combat';
import { blocksShot, isFree, obstaclesNear, resolveBody } from './map';
import type { Obstacle, Run, RunEnemy } from './types';

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

/** How many beasts of a kind are alive (shooters are capped, so a melee hero is not buried in spores). */
const alive = (run: Run, id: ReworkEnemyId): number => run.enemies.reduce((n, e) => n + (e.def === id ? 1 : 0), 0);

export function pickBeast(run: Run): ReworkEnemyId {
  const from = REWORK_LOCATIONS[run.location]!.from;
  const pool: ReworkEnemyId[] = ['wolf'];
  const room = (id: ReworkEnemyId): boolean => alive(run, id) < (REWORK_ENEMIES[id].maxAlive ?? Infinity);
  if (run.time >= from.mushroom && room('mushroom')) pool.push('mushroom');
  if (run.time >= from.stump) pool.push('stump');
  if (run.time >= from.spider && room('spider')) pool.push('spider');
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
    const more = REWORK_LOCATIONS[run.location]!.power;
    p.hp *= more;
    p.damage *= more;
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
      stun: 0,
      freeze: 0,
      slowMult: 1,
      slowTime: 0,
      fear: 0,
    };
    if (d.leap) {
      e.temper = run.rng.next();
      e.flank = run.rng.next() * 2 - 1;
      e.traitTimer = 1 + run.rng.next() * d.leap.every;
    }
    run.enemies.push(e);
    return e;
  }
  return null;
}

/** An elite: a beast of the mix, larger and stronger, with a trait and a glow. */
export function spawnElite(run: Run): RunEnemy | null {
  const e = spawnBeast(run, pickBeast(run));
  if (!e) return null;
  const traits = Object.keys(REWORK_ELITES.traits) as EliteTrait[];
  e.elite = traits[Math.floor(run.rng.next() * traits.length)]!;
  e.hp *= REWORK_ELITES.hpMult;
  e.maxHp = e.hp;
  e.power *= REWORK_ELITES.damageMult;
  e.radius *= REWORK_ELITES.sizeMult;
  e.moveTimer = REWORK_ELITES.callEvery;
  return e;
}

/** The flood: spawns on its timer, a few at once later on; elites come on theirs. */
export function stepFlood(run: Run, dt: number): void {
  const E = REWORK_ELITES;
  if (run.elitesSent < E.times.length && run.time >= E.times[run.elitesSent]!) {
    run.elitesSent += 1;
    spawnElite(run);
  }
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  run.spawnTimer += spawnInterval(run.time);
  const group = 1 + Math.floor(Math.min(1, run.time / F.rampTime) * (F.groupEnd - 1) + run.rng.next() * 0.5);
  for (let i = 0; i < group && run.enemies.length < F.maxAlive; i++) spawnBeast(run, pickBeast(run));
}

/**
 * Turns a beast's way around an obstacle ahead: looking `look` px along its way, the nearest tree,
 * bush or stone that its body would hit makes it go round — along the obstacle's edge, on the side
 * nearer to its way, keeping that side while it passes (so it does not dither when the hero stands
 * right behind the obstacle). The closer the obstacle, the harder the turn.
 */
const AVOID = { look: 80, margin: 6 };

function steer(run: Run, e: RunEnemy, move: Vec): Vec {
  const ahead = { x: e.pos.x + move.x * AVOID.look, y: e.pos.y + move.y * AVOID.look };
  let best: { o: Obstacle; t: number } | null = null;
  for (const list of [obstaclesNear(run.grid, e.pos), obstaclesNear(run.grid, ahead)]) {
    for (const o of list) {
      const cx = o.pos.x - e.pos.x;
      const cy = o.pos.y - e.pos.y;
      const t = cx * move.x + cy * move.y;
      if (t < -o.radius || t > AVOID.look + o.radius) continue;
      const side = Math.abs(cx * move.y - cy * move.x);
      if (side >= o.radius + e.radius + AVOID.margin) continue;
      if (!best || t < best.t) best = { o, t };
    }
  }
  if (!best) {
    e.avoid = undefined;
    return move;
  }
  const o = best.o;
  const cx = o.pos.x - e.pos.x;
  const cy = o.pos.y - e.pos.y;
  const d = Math.hypot(cx, cy) || 1;
  // The side to pass on: kept while passing the same obstacle, else the one nearer the way.
  let side = e.avoid?.obstacle === o ? e.avoid.side : cx * move.y - cy * move.x > 0 ? 1 : -1;
  e.avoid = { obstacle: o, side };
  const tangent = { x: (-cy / d) * side, y: (cx / d) * side };
  const k = Math.min(1, Math.max(0.35, 1 - best.t / (AVOID.look + o.radius)));
  return norm({ x: move.x * (1 - k) + tangent.x * k, y: move.y * (1 - k) + tangent.y * k });
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
  // Skill effects: stunned or frozen — stands; scared — runs; slowed — walks slower.
  e.stun = Math.max(0, e.stun - dt);
  e.freeze = Math.max(0, e.freeze - dt);
  e.fear = Math.max(0, e.fear - dt);
  e.slowTime = Math.max(0, e.slowTime - dt);
  if (e.slowTime <= 0) e.slowMult = 1;
  if (e.stun > 0 || e.freeze > 0) {
    e.vel = { x: 0, y: 0 };
    return;
  }
  if (e.fear > 0) {
    e.act = { kind: 'walk' };
    e.vel = { x: -dir.x * d.speed * e.slowMult, y: -dir.y * d.speed * e.slowMult };
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;
    return;
  }
  // An elite that calls the pack: two wolves by it now and then.
  if (e.elite === 'caller') {
    e.moveTimer = (e.moveTimer ?? 0) - dt;
    if (e.moveTimer <= 0) {
      e.moveTimer = REWORK_ELITES.callEvery;
      for (let i = 0; i < 2; i++) {
        const w = spawnBeast(run, 'wolf', e.pos);
        if (w) w.pos = { x: e.pos.x + (i ? 30 : -30), y: e.pos.y + 10 };
      }
    }
  }
  let speed = d.speed * (e.elite === 'swift' ? 1.5 : 1);
  let move = dir;
  // A wolf away from the hero comes from its own side, so the pack spreads around him.
  if (d.leap && e.flank && dist > d.leap.flankFrom && e.act.kind === 'walk') {
    const a = Math.atan2(dir.y, dir.x) + ((e.flank * d.leap.flank * Math.PI) / 180) * Math.min(1, (dist - d.leap.flankFrom) / 200);
    move = { x: Math.cos(a), y: Math.sin(a) };
  }
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
  } else if (act.kind === 'weave') {
    act.time -= dt;
    speed = 0;
    if (act.time <= 0) {
      spitWeb(run, e, act.to);
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
    if (d.leap && e.traitTimer <= 0 && dist < d.leap.trigger && (e.temper ?? 1) >= d.leap.timid) {
      const L = d.leap;
      const t = e.temper ?? 1;
      const busy = run.enemies.filter((o) => o.act.kind === 'crouch' || o.act.kind === 'leap').length;
      const between = (r: [number, number]): number => r[0] + run.rng.next() * (r[1] - r[0]);
      if (busy >= L.atOnce || run.leapGap > 0 || run.rng.next() > L.chance[0] + (L.chance[1] - L.chance[0]) * t) {
        // Not now: the pack is busy or it hesitates — tries again a little later.
        e.traitTimer = between(L.retry);
      } else {
        e.traitTimer = L.every * (1 + (run.rng.next() * 2 - 1) * L.jitter);
        run.leapGap = L.gap;
        // A bold wolf aims where the hero is going.
        const lead = L.lead * t;
        const aim = norm({ x: to.x + h.vel.x * lead, y: to.y + h.vel.y * lead });
        e.act = { kind: 'crouch', time: L.windup, dir: aim };
        speed = 0;
      }
    } else if (d.spit && e.traitTimer <= 0 && dist < d.spit.range) {
      e.traitTimer = d.spit.every;
      e.shots += 1;
      // Only an elite mushroom spits a fan now and then; a plain one spits single spores.
      e.act = { kind: 'aim', time: d.spit.windup, dir, fan: !!e.elite && e.shots % d.spit.fanEvery === 0 };
      speed = 0;
    } else if (d.web && e.traitTimer <= 0 && dist < d.web.trigger) {
      e.traitTimer = d.web.every;
      e.act = { kind: 'weave', time: d.web.windup, to: { x: h.pos.x, y: h.pos.y } };
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
  // Around a tree or a stone in the way, not into it (a leap flies straight).
  if (speed > 0 && e.act.kind !== 'leap') move = steer(run, e, move);
  e.vel = { x: move.x * speed * e.slowMult, y: move.y * speed * e.slowMult };
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

/** A spider's web flies to where the hero stood and sticks there (or on him, if it hits). */
function spitWeb(run: Run, e: RunEnemy, to: Vec): void {
  const w = REWORK_ENEMIES[e.def].web!;
  const dx = to.x - e.pos.x;
  const dy = to.y - e.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  run.shots.push({
    pos: { x: e.pos.x, y: e.pos.y },
    vel: { x: (dx / d) * w.speed, y: (dy / d) * w.speed },
    radius: 7,
    damage: 0,
    life: Math.min(d, w.range) / w.speed,
    byHero: false,
    kind: 'web',
    pierce: 0,
    hit: [],
  });
}

/** Puts a sticky web patch on the ground. */
export function layWeb(run: Run, pos: Vec): void {
  run.webs.push({ pos: { x: pos.x, y: pos.y }, radius: REWORK_WEB.patchRadius, time: REWORK_WEB.patchTime });
}

const cellKey = (cx: number, cy: number): number => cx * 100003 + cy;

export function stepBeasts(run: Run, dt: number, special: (e: RunEnemy) => boolean = () => false): void {
  run.leapGap = Math.max(0, run.leapGap - dt);
  for (const e of run.enemies) if (!e.dead && !special(e)) stepBeast(run, e, dt);
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
          // A den stands where it is; the boss is barely moved by the crowd.
          // A den and the Old Enat stand where they are; the other bosses are barely moved by the crowd.
          const we = e.def === 'nest' || e.def === 'cocoon' || e.def === 'enat' ? 0 : e.boss ? 0.1 : 1;
          const wo = o.def === 'nest' || o.def === 'cocoon' || o.def === 'enat' ? 0 : o.boss ? 0.1 : 1;
          if (we + wo === 0) continue;
          const push = (min - dist) / dist;
          e.pos.x += dx * push * (we / (we + wo));
          e.pos.y += dy * push * (we / (we + wo));
          o.pos.x -= dx * push * (wo / (we + wo));
          o.pos.y -= dy * push * (wo / (we + wo));
        }
      }
    }
    const dx = e.pos.x - h.pos.x;
    const dy = e.pos.y - h.pos.y;
    const dist = Math.hypot(dx, dy);
    const reach = e.radius + h.radius;
    if (dist < reach && dist > 0 && !h.dead && e.def !== 'enat') {
      if (e.def === 'nest' || e.def === 'cocoon') {
        // A den or a cocoon stands where it is: the hero is pushed off it instead.
        h.pos.x = e.pos.x - (dx / dist) * reach;
        h.pos.y = e.pos.y - (dy / dist) * reach;
      } else {
        e.pos.x = h.pos.x + (dx / dist) * reach;
        e.pos.y = h.pos.y + (dy / dist) * reach;
      }
    }
    resolveBody(run.grid, e.pos, e.radius, run.width, run.height);
  }
  run.enemies = run.enemies.filter((e) => !e.dead);
}

/**
 * Beast shots fly until they hit the hero, a tree or run out: a spore hurts; a web sticks to the
 * ground where it stops (on the hero, if it hits him); the spinner's cocoon wraps the hero.
 */
export function stepBeastShots(run: Run, dt: number): void {
  const h = run.hero;
  for (const s of run.shots) {
    if (s.byHero) continue;
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.life -= dt;
    const hit = !h.dead && Math.hypot(s.pos.x - h.pos.x, s.pos.y - h.pos.y) < s.radius + h.radius;
    if (blocksShot(run.grid, s.pos)) s.life = 0;
    else if (hit && s.kind === 'cocoon') {
      if (h.invuln <= 0) {
        h.root = REWORK_BOSS.spinner.cocoon.root;
        run.events.push({ type: 'note', pos: { x: h.pos.x, y: h.pos.y - 70 }, text: 'Кокон! Пробіл — вирватись', color: '#e8e8f0' });
      }
      s.life = 0;
    } else if (hit && s.kind !== 'web') {
      damageHero(run, s.damage);
      s.life = 0;
    } else if (hit) s.life = 0;
    if (s.kind === 'web' && s.life <= 0) layWeb(run, hit ? h.pos : s.pos);
  }
}
