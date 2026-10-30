// Skills in the rework's run (ROADMAP 20.6): pressed on keys 1–4, aimed at the cursor, each with
// its own cooldown. Here: casting, and what goes on after a cast — the whirlwind, burning ground
// and rains of arrows, traps, the second frost wave, the battle cry.

import { REWORK_SKILLS, type ReworkSkillId, type SkillParams, skillParams } from '../../data/reworkSkills';
import type { Vec } from '../entities';
import { damageEnemy } from './combat';
import type { Run, RunEnemy } from './types';

const SHOT_SPEED = { axe: 520, fireball: 480, missile: 420, arrow: 640, pierceArrow: 900 } as const;

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

function nearestTo(run: Run, p: Vec, range: number, skip: number[] = []): RunEnemy | null {
  let best: RunEnemy | null = null;
  let bd = range;
  for (const e of run.enemies) {
    if (e.dead || skip.includes(e.id)) continue;
    const d = dist(e.pos, p) - e.radius;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Stuns, freezes, slows or scares a beast (the stronger one wins). */
export function affect(e: RunEnemy, p: { stun?: number; freeze?: number; slow?: number; slowTime?: number; fear?: number }): void {
  if (p.stun) e.stun = Math.max(e.stun, p.stun);
  if (p.freeze) e.freeze = Math.max(e.freeze, p.freeze);
  if (p.fear) e.fear = Math.max(e.fear, p.fear);
  if (p.slow && p.slowTime) {
    e.slowMult = Math.min(e.slowMult, 1 - p.slow);
    e.slowTime = Math.max(e.slowTime, p.slowTime);
  }
}

/** Hurts every beast within `radius` of a point; returns how many. */
export function burst(run: Run, pos: Vec, radius: number, damage: number, effect: Parameters<typeof affect>[1] = {}, color = '#ff9d3a'): number {
  let n = 0;
  for (const e of run.enemies) {
    if (e.dead || dist(e.pos, pos) > radius + e.radius) continue;
    damageEnemy(run, e, damage);
    affect(e, effect);
    n += 1;
  }
  run.events.push({ type: 'blast', pos: { x: pos.x, y: pos.y }, radius, color });
  return n;
}

/** Where an aimed skill goes: the cursor, else the nearest beast, else straight ahead. */
function aimPoint(run: Run, aim: Vec | null, range: number): Vec {
  const h = run.hero;
  let to = aim;
  if (!to) to = nearestTo(run, h.pos, range * 1.5)?.pos ?? { x: h.pos.x + Math.cos(h.facing) * range, y: h.pos.y + Math.sin(h.facing) * range };
  const d = dist(to, h.pos);
  if (range > 0 && d > range) to = { x: h.pos.x + ((to.x - h.pos.x) / d) * range, y: h.pos.y + ((to.y - h.pos.y) / d) * range };
  return { x: to.x, y: to.y };
}

function fan(count: number, spreadDeg: number, base: number): number[] {
  if (count <= 1) return [base];
  const step = (spreadDeg * Math.PI) / 180 / (count - 1);
  return Array.from({ length: count }, (_, i) => base - ((count - 1) / 2) * step + i * step);
}

function shoot(run: Run, kind: keyof typeof SHOT_SPEED, angle: number, range: number, damage: number, extra: Partial<Run['shots'][number]> = {}): void {
  const h = run.hero;
  const speed = SHOT_SPEED[kind];
  run.shots.push({
    pos: { x: h.pos.x + Math.cos(angle) * h.radius, y: h.pos.y + Math.sin(angle) * h.radius },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: kind === 'axe' ? 12 : kind === 'fireball' ? 9 : 5,
    damage,
    life: range / speed,
    byHero: true,
    kind,
    pierce: 0,
    hit: [],
    ...extra,
  });
}

/** Presses the skill in `slot`; false if there is none or it is not ready. */
export function castSkill(run: Run, slot: number, aim: Vec | null): boolean {
  const sk = run.skills[slot];
  const h = run.hero;
  if (!sk || sk.cooldown > 0 || h.dead) return false;
  const p = skillParams(sk.id, sk.rank);
  sk.cooldown = Math.max(0.5, p.cooldown);
  const def = REWORK_SKILLS[sk.id];
  const to = def.aimed ? aimPoint(run, aim, p.range) : h.pos;
  const angle = Math.atan2(to.y - h.pos.y, to.x - h.pos.x);
  if (def.aimed) h.facing = angle;
  run.events.push({ type: 'cast', skill: sk.id });
  CASTS[sk.id](run, p, to, angle);
  return true;
}

const CASTS: Record<ReworkSkillId, (run: Run, p: SkillParams, to: Vec, angle: number) => void> = {
  whirlwind: (run, p) => {
    run.spin = { time: p.duration, tick: 0, radius: p.radius, damage: p.damage, pull: p.pull > 0 };
  },
  groundSlam: (run, p, _to, angle) => {
    const h = run.hero;
    const half = (p.angle * Math.PI) / 360;
    run.events.push({ type: 'swing', pos: { x: h.pos.x, y: h.pos.y }, angle, reach: p.range, arc: half * 2 });
    for (const e of run.enemies) {
      if (e.dead || dist(e.pos, h.pos) - e.radius > p.range) continue;
      let diff = Math.atan2(e.pos.y - h.pos.y, e.pos.x - h.pos.x) - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > half) continue;
      damageEnemy(run, e, p.damage);
      affect(e, { stun: p.stun });
    }
  },
  axeThrow: (run, p, _to, angle) => {
    for (const a of fan(p.count, p.angle * (p.count - 1), angle)) shoot(run, 'axe', a, p.range, p.damage, { pierce: 999, returns: p.returns > 0 });
  },
  battleCry: (run, p) => {
    const h = run.hero;
    run.buff = { attackSpeed: p.attackSpeed, guard: p.guard, time: p.duration };
    if (p.heal > 0) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * p.heal);
    if (p.fear > 0) for (const e of run.enemies) if (!e.dead && dist(e.pos, h.pos) <= p.radius) affect(e, { fear: p.fear });
    run.events.push({ type: 'blast', pos: { x: h.pos.x, y: h.pos.y }, radius: p.radius, color: '#ffcf5a' });
  },
  fireball: (run, p, to, angle) => {
    const d = dist(to, run.hero.pos);
    for (const a of fan(p.count, p.angle * (p.count - 1), angle)) {
      const target = { x: run.hero.pos.x + Math.cos(a) * d, y: run.hero.pos.y + Math.sin(a) * d };
      shoot(run, 'fireball', a, d + 10, p.damage, { blast: { radius: p.radius, burn: p.burn }, target });
    }
  },
  frostRing: (run, p) => {
    const h = run.hero;
    burst(run, h.pos, p.radius, p.damage, { freeze: p.freeze }, '#9fd8ff');
    if (p.echo > 0) run.delayed.push({ time: 0.5, pos: { x: h.pos.x, y: h.pos.y }, radius: p.radius, damage: p.damage, freeze: p.freeze });
  },
  magicMissiles: (run, p) => {
    const h = run.hero;
    const taken: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const t = nearestTo(run, h.pos, p.range, taken) ?? nearestTo(run, h.pos, p.range);
      if (t) taken.push(t.id);
      const a = t ? Math.atan2(t.pos.y - h.pos.y, t.pos.x - h.pos.x) : h.facing + (i - p.count / 2) * 0.3;
      shoot(run, 'missile', a + (i - (p.count - 1) / 2) * 0.25, p.range * 1.6, p.damage, { homing: true, bounce: p.bounce });
    }
  },
  chainLightning: (run, p, to) => {
    let cur = nearestTo(run, to, 160) ?? nearestTo(run, run.hero.pos, 320);
    if (!cur) return;
    const points: Vec[] = [{ x: run.hero.pos.x, y: run.hero.pos.y - 20 }];
    const hit: number[] = [];
    for (let i = 0; i < p.count && cur; i++) {
      hit.push(cur.id);
      points.push({ x: cur.pos.x, y: cur.pos.y - 12 });
      damageEnemy(run, cur, p.damage);
      affect(cur, { stun: p.stun });
      cur = nearestTo(run, cur.pos, p.range, hit);
    }
    run.events.push({ type: 'chain', points });
  },
  multishot: (run, p, _to, angle) => {
    for (const a of fan(p.count, p.angle, angle)) shoot(run, 'arrow', a, p.range, p.damage, { pierce: p.pierce });
  },
  arrowRain: (run, p, to) => {
    run.zones.push({ kind: 'rain', pos: to, radius: p.radius, time: p.duration, damage: p.damage, tick: 0, slow: p.slow });
  },
  piercingShot: (run, p, _to, angle) => {
    shoot(run, 'pierceArrow', angle, p.range, p.damage, { pierce: 999, radius: p.width / 2, grow: p.grow });
  },
  hunterTrap: (run, p, to) => {
    run.traps.push({ pos: to, radius: p.radius, damage: p.damage, stun: p.stun });
    while (run.traps.length > p.max) run.traps.shift();
  },
};

/** Cooldowns and everything that lasts after a cast. */
export function stepSkills(run: Run, dt: number): void {
  const h = run.hero;
  for (const sk of run.skills) sk.cooldown = Math.max(0, sk.cooldown - dt);
  if (run.buff) {
    run.buff.time -= dt;
    if (run.buff.time <= 0) run.buff = null;
  }
  const spin = run.spin;
  if (spin) {
    spin.time -= dt;
    spin.tick -= dt;
    if (spin.pull) {
      for (const e of run.enemies) {
        const d = dist(e.pos, h.pos);
        if (e.dead || d > spin.radius * 1.8 || d < h.radius + e.radius + 4) continue;
        e.pos.x += ((h.pos.x - e.pos.x) / d) * 90 * dt;
        e.pos.y += ((h.pos.y - e.pos.y) / d) * 90 * dt;
      }
    }
    if (spin.tick <= 0) {
      spin.tick = 0.3;
      for (const e of run.enemies) if (!e.dead && dist(e.pos, h.pos) <= spin.radius + e.radius) damageEnemy(run, e, spin.damage);
    }
    if (spin.time <= 0) run.spin = null;
  }
  for (const z of run.zones) {
    z.time -= dt;
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = 0.25;
    for (const e of run.enemies) {
      if (e.dead || dist(e.pos, z.pos) > z.radius + e.radius) continue;
      damageEnemy(run, e, z.damage);
      if (z.slow > 0) affect(e, { slow: z.slow, slowTime: 0.5 });
    }
  }
  run.zones = run.zones.filter((z) => z.time > 0);
  run.traps = run.traps.filter((t) => {
    const victim = run.enemies.find((e) => !e.dead && dist(e.pos, t.pos) <= e.radius + 16);
    if (!victim) return true;
    burst(run, t.pos, t.radius, t.damage, { stun: t.stun }, '#e8b04a');
    return false;
  });
  for (const d of run.delayed) {
    d.time -= dt;
    if (d.time <= 0) burst(run, d.pos, d.radius, d.damage, { freeze: d.freeze }, '#9fd8ff');
  }
  run.delayed = run.delayed.filter((d) => d.time > 0);
}
