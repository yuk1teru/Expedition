// Damage in the rework's run (ROADMAP 20.4–20.13): hurting the hero (a dodge, a shrine's shield
// and debug immortality stop it) and hurting a beast — it dies, drops its gem and maybe a coin;
// an elite drops a chest (and may blow up), a den counts for the task, the spirit's death clears
// the fog, the boss's death wins the location.

import { REWORK_BOSS, REWORK_ELITES, REWORK_ENEMIES, REWORK_LOCATIONS, REWORK_PROGRESS } from '../../data/rework';
import type { Run, RunEnemy } from './types';

export function damageHero(run: Run, amount: number): void {
  const h = run.hero;
  if (h.dead || h.invuln > 0 || h.immortal || amount <= 0) return;
  // The battle cry takes a share off; a shrine's shield takes the rest first.
  amount *= 1 - (run.buff?.guard ?? 0);
  if (h.shield > 0) {
    const taken = Math.min(h.shield, amount);
    h.shield -= taken;
    amount -= taken;
    if (amount <= 0) return;
  }
  h.hp -= amount;
  h.hitAt = run.time;
  run.events.push({ type: 'hit', pos: { x: h.pos.x, y: h.pos.y }, amount, byHero: false });
  if (h.hp <= 0) {
    h.hp = 0;
    h.dead = true;
  }
}

export function damageEnemy(run: Run, e: RunEnemy, amount: number): void {
  // The living ring is a wall: its beasts are not hurt.
  if (e.dead || e.act.kind === 'ring') return;
  // An elite's shield takes half; the boss resting after a leap takes more.
  if (e.elite === 'shield') amount *= REWORK_ELITES.shieldTake;
  if (e.boss && e.act.kind === 'rest') amount *= e.def === 'spinner' ? REWORK_BOSS.spinner.restTake : REWORK_BOSS.alpha.restTake;
  // The Old Enat's cracked bark in his last phase.
  if (e.def === 'enat' && run.bossPhase === 2) amount *= REWORK_BOSS.enat.sapTake;
  e.hp -= amount;
  e.hitAt = run.time;
  run.events.push({ type: 'hit', pos: { x: e.pos.x, y: e.pos.y }, amount, byHero: true });
  if (e.hp > 0) return;
  e.dead = true;
  run.kills += 1;
  run.events.push({ type: 'kill', pos: { x: e.pos.x, y: e.pos.y }, def: e.def, id: e.id, radius: e.radius, boss: !!e.boss });
  run.gems.push({ pos: { x: e.pos.x, y: e.pos.y }, xp: e.elite ? REWORK_ELITES.xp : REWORK_ENEMIES[e.def].xp, pulled: false });
  if (e.elite) {
    run.chests.push({ pos: { x: e.pos.x, y: e.pos.y } });
    if (e.elite === 'explosive') run.blasts.push({ time: REWORK_ELITES.blast.delay, pos: { x: e.pos.x, y: e.pos.y }, radius: REWORK_ELITES.blast.radius, damage: REWORK_ELITES.blast.damage });
  }
  if (e.def === 'spirit') {
    run.fogTarget = 0;
    run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 40 }, text: 'Туман розсіюється', color: '#d8f0d0' });
  }
  if ((e.def === 'nest' || e.def === 'cocoon') && run.task) {
    run.task.dens = run.task.dens.filter((id) => id !== e.id);
  }
  if (e.boss) {
    run.phase = 'won';
    run.hazards = [];
    run.shade = null;
    run.threads = [];
    run.pull = null;
    run.hero.root = 0;
    run.offer = null;
    run.pendingLevels = 0;
    const L = REWORK_LOCATIONS[run.location]!;
    run.events.push({ type: 'note', pos: { x: e.pos.x, y: e.pos.y - 60 }, text: REWORK_BOSS[L.boss].defeated + (L.path ? ` ${L.path.note}` : ''), color: '#ffd27a' });
  }
  if (run.rng.next() < REWORK_PROGRESS.goldChance) {
    const a = run.rng.next() * Math.PI * 2;
    run.coins.push({ pos: { x: e.pos.x + Math.cos(a) * 10, y: e.pos.y + Math.sin(a) * 10 }, pulled: false });
  }
}
