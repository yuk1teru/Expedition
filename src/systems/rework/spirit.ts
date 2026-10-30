// The weather monster of the Forest (ROADMAP 20.10, VISION §3): the spirit of decay. It comes
// at 3:30, keeps its distance, and now and then gathers itself (a warning) and thickens the fog
// over the field — the hero sees less and less around him. Low on HP it runs, but not far, so it
// can be caught; it never leaves the field. Killed, it takes the fog with it.

import { REWORK_SPIRIT } from '../../data/rework';
import { damageHero } from './combat';
import { spawnBeast } from './enemies';
import type { Run, RunEnemy } from './types';

const S = REWORK_SPIRIT;

/** The radius the hero sees at the fog's thickness (0 — clear). */
export function sightRadius(fog: number): number {
  return S.sightClear + (S.sightThick - S.sightClear) * Math.min(1, fog / S.fogMax);
}

/** It comes once, at its time, and the fog eases towards its target. */
export function stepWeather(run: Run, dt: number): void {
  if (!run.spiritCame && run.time >= S.appearAt && run.phase === 'flood') {
    run.spiritCame = true;
    const e = spawnBeast(run, 'spirit');
    if (e) {
      e.moveTimer = 2;
      run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 90 }, text: 'Ліс затягує туманом…', color: '#c8d6c0' });
    }
  }
  const rate = run.fogTarget < run.fog ? S.clearRate : 0.6;
  run.fog += Math.max(-rate * dt, Math.min(rate * dt, run.fogTarget - run.fog));
}

/** The spirit's own step; true — handled (the beasts' code leaves it alone). */
export function stepSpirit(run: Run, e: RunEnemy, dt: number): boolean {
  if (e.def !== 'spirit') return false;
  const h = run.hero;
  const dx = h.pos.x - e.pos.x;
  const dy = h.pos.y - e.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  e.stun = Math.max(0, e.stun - dt);
  e.freeze = Math.max(0, e.freeze - dt);
  e.touchTimer -= dt;
  if (e.stun > 0 || e.freeze > 0) return true;
  const fleeing = e.hp < e.maxHp * S.fleeAt;
  if (e.act.kind === 'cast') {
    // Gathering the fog: it stands; then the fog thickens.
    e.act.time -= dt;
    e.vel = { x: 0, y: 0 };
    if (e.act.time <= 0) {
      run.fogTarget = Math.min(S.fogMax, run.fogTarget + S.fogStep);
      run.events.push({ type: 'blast', pos: { x: e.pos.x, y: e.pos.y }, radius: 120, color: '#b8c8b0' });
      e.act = { kind: 'walk' };
    }
    return true;
  }
  e.moveTimer = (e.moveTimer ?? S.castEvery) - dt;
  if (!fleeing && e.moveTimer <= 0) {
    e.moveTimer = S.castEvery;
    e.act = { kind: 'cast', time: S.windup };
    return true;
  }
  // Keeps its distance — or runs, low on HP, but not far — drifting sideways so it is not a
  // straight chase; it never leaves the field.
  const keep = fleeing ? S.fleeKeep : S.keep;
  const want = d > keep + 40 ? 1 : d < keep - 40 ? -1 : 0;
  const speed = fleeing ? S.fleeSpeed : S.speed;
  const side = Math.sin(run.time * 0.7 + e.id) * 0.6;
  e.vel = { x: ((dx / d) * want - (dy / d) * side) * speed, y: ((dy / d) * want + (dx / d) * side) * speed };
  e.pos.x = Math.max(S.edge, Math.min(run.width - S.edge, e.pos.x + e.vel.x * dt));
  e.pos.y = Math.max(S.edge, Math.min(run.height - S.edge, e.pos.y + e.vel.y * dt));
  if (d < e.radius + h.radius + 2 && e.touchTimer <= 0) {
    e.touchTimer = 1;
    damageHero(run, 4);
  }
  return true;
}
