// The hero in the rework's run (ROADMAP 20.4): walks around obstacles, attacks the nearest beast
// on its own (the warrior's arc, the mage's fire bolt, the archer's piercing arrow) and dodges on
// Space towards the cursor — the warrior's shield dash, the mage's blink, the archer's vault — with a short
// invulnerability and no damage. The cards (20.5) change the numbers through `heroStats`; the
// hero's shots fly in shots.ts.

import { REWORK_CARDS, REWORK_CLASSES, REWORK_PROGRESS, type ReworkClassId } from '../../data/rework';
import type { Vec } from '../entities';
import { damageEnemy } from './combat';
import { isFree, resolveBody } from './map';
import type { Run, RunEnemy, RunHero } from './types';

/** The hero's numbers with the cards taken. */
export function heroStats(run: Run): { maxHp: number; speed: number; dodgeDistance: number; magnet: number; area: number } {
  const c = REWORK_CLASSES[run.hero.classId];
  const rank = (id: keyof typeof REWORK_CARDS): number => (run.cards[id] ?? 0) * REWORK_CARDS[id].value / 100;
  return {
    maxHp: Math.round(c.hp * (1 + rank('health'))),
    speed: c.speed * (1 + rank('swiftness')),
    dodgeDistance: c.dodge.distance * (1 + rank('swiftness') * 1.25),
    magnet: REWORK_PROGRESS.magnet * (1 + rank('magnet')),
    area: 1 + rank('area'),
  };
}

export function newHero(classId: ReworkClassId, pos: Vec, radius: number): RunHero {
  const c = REWORK_CLASSES[classId];
  return {
    classId,
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    facing: 0,
    radius,
    hp: c.hp,
    maxHp: c.hp,
    attackTimer: 0.5,
    dodgeTimer: 0,
    invuln: 0,
    dash: null,
    dead: false,
    hitAt: -Infinity,
    immortal: false,
  };
}

function nearest(run: Run, from: Vec, range: number): RunEnemy | null {
  let best: RunEnemy | null = null;
  let bestD = range;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.y - from.y) - e.radius;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** One step of the hero: the dodge in flight, walking, the automatic attack. */
export function stepHero(run: Run, dt: number, move: Vec): void {
  const h = run.hero;
  if (h.dead) return;
  const st = heroStats(run);
  h.invuln = Math.max(0, h.invuln - dt);
  h.dodgeTimer = Math.max(0, h.dodgeTimer - dt);
  h.attackTimer -= dt;
  if (h.dash) {
    const d = h.dash;
    d.time += dt;
    const k = Math.min(1, d.time / d.duration);
    const prev = { x: h.pos.x, y: h.pos.y };
    h.pos.x = d.from.x + (d.to.x - d.from.x) * k;
    h.pos.y = d.from.y + (d.to.y - d.from.y) * k;
    h.vel = { x: (h.pos.x - prev.x) / dt, y: (h.pos.y - prev.y) / dt };
    // A dash stops at the first obstacle; a blink flies through and is settled on landing.
    if (d.through) {
      if (k >= 1) {
        resolveBody(run.grid, h.pos, h.radius, run.width, run.height);
        h.dash = null;
      }
    } else if (resolveBody(run.grid, h.pos, h.radius, run.width, run.height) || k >= 1) h.dash = null;
  } else {
    h.vel = { x: move.x * st.speed, y: move.y * st.speed };
    h.pos.x += h.vel.x * dt;
    h.pos.y += h.vel.y * dt;
    resolveBody(run.grid, h.pos, h.radius, run.width, run.height);
    if (move.x !== 0 || move.y !== 0) h.facing = Math.atan2(move.y, move.x);
  }
  if (h.attackTimer <= 0) attack(run);
}

function attack(run: Run): void {
  const h = run.hero;
  const a = REWORK_CLASSES[h.classId].attack;
  const st = heroStats(run);
  const range = a.kind === 'arc' ? a.reach * st.area : a.range;
  const target = nearest(run, h.pos, range);
  if (!target) return;
  h.attackTimer = a.every / (1 + (run.buff?.attackSpeed ?? 0));
  const angle = Math.atan2(target.pos.y - h.pos.y, target.pos.x - h.pos.x);
  h.facing = angle;
  run.events.push({ type: 'attack', angle });
  if (a.kind === 'arc') {
    const reach = a.reach * st.area;
    const half = (a.arcDeg * Math.PI) / 360;
    run.events.push({ type: 'swing', pos: { x: h.pos.x, y: h.pos.y }, angle, reach, arc: half * 2 });
    for (const e of run.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - h.pos.x;
      const dy = e.pos.y - h.pos.y;
      if (Math.hypot(dx, dy) - e.radius > reach) continue;
      let diff = Math.atan2(dy, dx) - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= half) damageEnemy(run, e, a.damage);
    }
    return;
  }
  run.shots.push({
    pos: { x: h.pos.x + Math.cos(angle) * h.radius, y: h.pos.y + Math.sin(angle) * h.radius },
    vel: { x: Math.cos(angle) * a.speed, y: Math.sin(angle) * a.speed },
    radius: a.kind === 'bolt' ? 7 : 4 * st.area,
    damage: a.damage,
    life: a.range / a.speed,
    byHero: true,
    kind: a.kind,
    pierce: a.kind === 'arrow' ? a.pierce : 0,
    hit: [],
  });
}

/** Space: the class's dodge towards `aim` (the cursor) if given, else along the walk, else ahead. */
export function dodge(run: Run, move: Vec, aim: Vec | null = null): boolean {
  const h = run.hero;
  if (h.dead || h.dash || h.dodgeTimer > 0) return false;
  const d = REWORK_CLASSES[h.classId].dodge;
  const st = heroStats(run);
  let dir = move.x !== 0 || move.y !== 0 ? move : { x: Math.cos(h.facing), y: Math.sin(h.facing) };
  const toAim = aim ? Math.hypot(aim.x - h.pos.x, aim.y - h.pos.y) : 0;
  if (aim && toAim > 1) dir = { x: (aim.x - h.pos.x) / toAim, y: (aim.y - h.pos.y) / toAim };
  const from = { x: h.pos.x, y: h.pos.y };
  let to = { x: from.x + dir.x * st.dodgeDistance, y: from.y + dir.y * st.dodgeDistance };
  h.dodgeTimer = d.cooldown;
  h.invuln = Math.max(h.invuln, d.invuln);
  run.events.push({ type: 'dodge', from, to });
  if (d.kind === 'blink') {
    // A blink flies fast to the farthest free point along the way, through what stands between.
    for (let k = 1; k >= 0; k -= 0.1) {
      to = { x: from.x + dir.x * st.dodgeDistance * k, y: from.y + dir.y * st.dodgeDistance * k };
      if (isFree(run.grid, to, h.radius)) break;
    }
    to.x = Math.max(h.radius, Math.min(run.width - h.radius, to.x));
    to.y = Math.max(h.radius, Math.min(run.height - h.radius, to.y));
    h.dash = { from, to, time: 0, duration: d.time, through: true };
    return true;
  }
  h.dash = { from, to, time: 0, duration: d.time };
  return true;
}
