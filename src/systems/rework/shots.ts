// What the hero shoots (ROADMAP 20.4, 20.6): the basic bolts and arrows and the skills' shots —
// the axe that cuts through all and may come back, the fireball that bursts at its point,
// missiles that chase beasts and may jump on, the piercing arrow that grows with each one hit.

import { REWORK_CLASSES } from '../../data/rework';
import { damageEnemy } from './combat';
import { heroStats } from './hero';
import { affect, burst } from './skills';
import type { Run, RunEnemy, Shot } from './types';
import { onScreen } from './view';

function nearestFree(run: Run, s: Shot): RunEnemy | null {
  let best: RunEnemy | null = null;
  let bd = 500;
  for (const e of run.enemies) {
    if (e.dead || e.act.kind === 'ring' || s.hit.includes(e.id) || !onScreen(run, e.pos)) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.y - s.pos.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** A fireball bursts once: on the first beast or at its point; the evolved one splits in three. */
function explode(run: Run, s: Shot): void {
  const b = s.blast!;
  s.blast = undefined;
  burst(run, s.pos, b.radius, s.damage);
  if (b.burn > 0) run.zones.push({ kind: 'fire', pos: { x: s.pos.x, y: s.pos.y }, radius: b.radius * 0.8, time: b.burn, damage: s.damage * 0.12, tick: 0.25, slow: 0 });
  if (s.split) {
    const base = Math.atan2(s.vel.y, s.vel.x);
    for (let i = 0; i < 3; i++) {
      const a = base + ((i - 1) * Math.PI) / 3;
      const at = { x: s.pos.x + Math.cos(a) * 85, y: s.pos.y + Math.sin(a) * 85 };
      run.delayed.push({ time: 0.18, pos: at, radius: b.radius * 0.6, damage: s.damage * 0.6, freeze: 0, color: '#ff9d3a' });
    }
  }
  s.life = 0;
}

export function stepHeroShots(run: Run, dt: number): void {
  const st = heroStats(run);
  const h = run.hero;
  for (const s of run.shots) {
    if (!s.byHero || s.life <= 0) continue;
    // Circling the hero (the evolved axes and missiles); a missile breaks off at a beast that comes near.
    if (s.orbit) {
      const o = s.orbit;
      o.angle += o.spin * dt;
      s.pos = { x: h.pos.x + Math.cos(o.angle) * o.radius, y: h.pos.y + Math.sin(o.angle) * o.radius * 0.6 };
      if (o.launch > 0) {
        const near = run.enemies.find((e) => !e.dead && e.act.kind !== 'ring' && Math.hypot(e.pos.x - h.pos.x, e.pos.y - h.pos.y) < o.launch);
        if (near) {
          s.orbit = undefined;
          s.homing = true;
          const a = Math.atan2(near.pos.y - s.pos.y, near.pos.x - s.pos.x);
          s.vel = { x: Math.cos(a) * 420, y: Math.sin(a) * 420 };
          s.life = 1.5;
        }
      }
    }
    // Hits the same beast again after a while (the circling axes).
    if (s.rehit !== undefined) {
      s.rehit -= dt;
      if (s.rehit <= 0) {
        s.rehit = 0.4;
        s.hit = [];
      }
    }
    // A missile turns to the nearest beast it has not hit yet.
    if (s.homing) {
      const t = nearestFree(run, s);
      if (t) {
        const speed = Math.hypot(s.vel.x, s.vel.y);
        const want = Math.atan2(t.pos.y - s.pos.y, t.pos.x - s.pos.x);
        const cur = Math.atan2(s.vel.y, s.vel.x);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const a = cur + Math.max(-8 * dt, Math.min(8 * dt, diff));
        s.vel = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      }
    }
    if (!s.orbit) {
      s.pos.x += s.vel.x * dt;
      s.pos.y += s.vel.y * dt;
    }
    s.life -= dt;
    // The fireball bursts where it was sent.
    if (s.blast && s.target && Math.hypot(s.target.x - s.pos.x, s.target.y - s.pos.y) < Math.hypot(s.vel.x, s.vel.y) * dt + 4) {
      explode(run, s);
      continue;
    }
    for (const e of run.enemies) {
      if (e.dead || e.act.kind === 'ring' || s.life <= 0 || s.hit.includes(e.id)) continue;
      if (Math.hypot(e.pos.x - s.pos.x, e.pos.y - s.pos.y) > e.radius + s.radius) continue;
      if (s.blast) {
        explode(run, s);
        break;
      }
      s.hit.push(e.id);
      damageEnemy(run, e, s.damage);
      if (s.stun) affect(e, { stun: s.stun });
      if (s.grow) s.damage *= 1 + s.grow;
      const a = REWORK_CLASSES[h.classId].attack;
      if (s.kind === 'bolt' && a.kind === 'bolt') {
        const r = a.splash * st.area;
        for (const o of run.enemies) {
          if (o === e || o.dead) continue;
          if (Math.hypot(o.pos.x - s.pos.x, o.pos.y - s.pos.y) <= r + o.radius) damageEnemy(run, o, s.damage * a.splashShare);
        }
        s.life = 0;
      } else if (s.kind === 'missile') {
        if (s.orbit) continue;
        if ((s.bounce ?? 0) > 0) s.bounce! -= 1;
        else s.life = 0;
      } else if (s.pierce > 0) s.pierce -= 1;
      else s.life = 0;
    }
    // A fireball that flew its way bursts; an axe that is to come back turns around.
    if (s.life <= 0 && s.blast && s.kind === 'fireball') explode(run, s);
    if (s.life <= 0 && s.returns) {
      s.returns = false;
      s.hit = [];
      const d = Math.hypot(h.pos.x - s.pos.x, h.pos.y - s.pos.y) || 1;
      const speed = Math.hypot(s.vel.x, s.vel.y);
      s.vel = { x: ((h.pos.x - s.pos.x) / d) * speed, y: ((h.pos.y - s.pos.y) / d) * speed };
      s.life = d / speed;
    }
  }
}
