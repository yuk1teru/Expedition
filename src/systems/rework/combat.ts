// Damage in the rework's run (ROADMAP 20.4): hurting the hero (dodge and debug immortality
// stop it) and hurting a beast (it dies, drops its gem and maybe a coin).

import { REWORK_ENEMIES, REWORK_PROGRESS } from '../../data/rework';
import type { Run, RunEnemy } from './types';

export function damageHero(run: Run, amount: number): void {
  const h = run.hero;
  if (h.dead || h.invuln > 0 || h.immortal || amount <= 0) return;
  h.hp -= amount;
  h.hitAt = run.time;
  run.events.push({ type: 'hit', pos: { x: h.pos.x, y: h.pos.y }, amount, byHero: false });
  if (h.hp <= 0) {
    h.hp = 0;
    h.dead = true;
  }
}

export function damageEnemy(run: Run, e: RunEnemy, amount: number): void {
  if (e.dead) return;
  e.hp -= amount;
  e.hitAt = run.time;
  run.events.push({ type: 'hit', pos: { x: e.pos.x, y: e.pos.y }, amount, byHero: true });
  if (e.hp > 0) return;
  e.dead = true;
  run.kills += 1;
  run.events.push({ type: 'kill', pos: { x: e.pos.x, y: e.pos.y }, def: e.def });
  run.gems.push({ pos: { x: e.pos.x, y: e.pos.y }, xp: REWORK_ENEMIES[e.def].xp, pulled: false });
  if (run.rng.next() < REWORK_PROGRESS.goldChance) {
    const a = run.rng.next() * Math.PI * 2;
    run.coins.push({ pos: { x: e.pos.x + Math.cos(a) * 10, y: e.pos.y + Math.sin(a) * 10 }, pulled: false });
  }
}
