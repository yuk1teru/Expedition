// Arena objectives (ROADMAP 13.3): nests that hatch monsters until broken, and a captive to
// stand by while monsters come in groups. An objective arena has no waves; its monsters
// grow like the next wave of the location would.

import { OBJECTIVES, type ObjectiveKind } from '../data/objectives';
import { ARENA, WAVES } from '../data/balance';
import { getEnemyDef } from '../data/enemies';
import { pushOutOfObstacles } from './arena';
import type { Battle } from './battle';
import { dist, type Enemy, type Vec } from './entities';
import { enemyStats, threatMultiplier } from './scaling';
import { BASE_WAVE_MULT, edgePoint, spawnEnemy, type WaveMult, waveMult } from './waves';

export interface ObjectiveState {
  kind: ObjectiveKind;
  /** Growth of its monsters: as the next wave of the location. */
  mult: WaveMult;
  /** Next group (rescue). */
  timer: number;
  /** Rescue: the captive and the seconds held next to them. */
  spot: Vec;
  held: number;
  /** Nests placed. */
  nests: number;
  done: boolean;
}

/** `wavesDone`: waves of the location already behind. */
export function setupObjective(b: Battle, kind: ObjectiveKind, wavesDone: number): void {
  const o: ObjectiveState = { kind, mult: waveMult(wavesDone), timer: OBJECTIVES.rescue.groupEvery * 0.5, spot: { x: 0, y: 0 }, held: 0, nests: 0, done: false };
  b.objective = o;
  const cx = ARENA.x + ARENA.w / 2;
  const cy = ARENA.y + ARENA.h / 2;
  if (kind === 'nests') {
    const n = OBJECTIVES.nests.count;
    const rx = ARENA.w * 0.34;
    const ry = ARENA.h * 0.32;
    const turn = b.rng.float(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2;
      spawnNest(b, { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }, i);
    }
    o.nests = n;
  } else {
    // The captive stands away from the hero's start, towards a side.
    const side = b.rng.chance(0.5) ? -1 : 1;
    o.spot = { x: cx + side * ARENA.w * 0.28, y: cy + b.rng.float(-0.15, 0.15) * ARENA.h };
    // Most of the circle stays free of trees and rocks.
    const body = { pos: o.spot, radius: OBJECTIVES.rescue.radius * 0.6 };
    pushOutOfObstacles(b.arena, body);
    o.spot = body.pos;
  }
}

function spawnNest(b: Battle, pos: Vec, i: number): void {
  const cfg = OBJECTIVES.nests;
  const roster = b.node.enemies;
  // Built from a regular monster, then turned into a nest: it stands, never attacks.
  const e = spawnEnemy(b, roster[0] ?? 'wolf', pos, false, true, BASE_WAVE_MULT);
  const hp = enemyStats({ hp: cfg.hp, damage: 0 }, b.tier, threatMultiplier(b.state)).hp * b.objective!.mult.hp;
  Object.assign(e, {
    nest: { timer: cfg.firstHatch + i * 1.2 },
    defId: 'nest',
    name: 'Гніздо',
    archetype: 'tank',
    element: undefined,
    radius: cfg.radius,
    hp,
    maxHp: hp,
    damage: 0,
    speed: 0,
    armor: 0,
    mass: 1e6,
    xp: cfg.xp * b.objective!.mult.reward,
    gold: 0,
  } satisfies Partial<Enemy>);
  pushOutOfObstacles(b.arena, e);
}

export function updateObjective(b: Battle, dt: number): void {
  const o = b.objective;
  if (!o || o.done) return;
  const alive = b.enemies.filter((e) => !e.dead);
  if (o.kind === 'nests') {
    const cfg = OBJECTIVES.nests;
    const nests = alive.filter((e) => e.nest);
    if (nests.length === 0) {
      // Every nest is broken: what they hatched still has to be beaten.
      if (alive.length === 0) o.done = true;
      return;
    }
    for (const n of nests) {
      n.nest!.timer -= dt;
      if (n.nest!.timer > 0) continue;
      n.nest!.timer = cfg.hatchEvery;
      if (alive.length >= cfg.maxAlive) continue;
      const a = b.rng.float(0, Math.PI * 2);
      const r = n.radius + 14;
      const id = pickMonster(b);
      const e = spawnEnemy(b, id, { x: n.pos.x + Math.cos(a) * r, y: n.pos.y + Math.sin(a) * r }, false, true, o.mult);
      e.xp *= cfg.hatchXp;
      alive.push(e);
    }
    return;
  }
  const cfg = OBJECTIVES.rescue;
  if (!b.hero.dead && dist(b.hero.pos, o.spot) <= cfg.radius) o.held += dt;
  if (o.held >= cfg.time) {
    o.held = cfg.time;
    o.done = true;
    b.events.emit({ type: 'objective', text: 'Полоненого врятовано!', pos: { ...o.spot } });
    return;
  }
  o.timer -= dt;
  if (o.timer > 0) return;
  o.timer = cfg.groupEvery;
  if (alive.length >= cfg.maxAlive) return;
  const anchor = edgePoint(b.rng);
  for (let i = 0; i < cfg.groupSize; i++) {
    const pos = { x: anchor.x + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread), y: anchor.y + b.rng.float(-WAVES.groupSpread, WAVES.groupSpread) };
    spawnEnemy(b, pickMonster(b), pos, false, false, o.mult);
  }
}

/** A monster of the location roster (an id listed twice is twice as likely). */
function pickMonster(b: Battle): string {
  return b.rng.weighted(b.node.enemies.map((id) => ({ item: id, weight: getEnemyDef(id).spawnWeight })));
}

/** How far along the objective is, 0..1, and a short line for the HUD. */
export function objectiveStatus(b: Battle): { progress: number; line: string } | null {
  const o = b.objective;
  if (!o) return null;
  if (o.kind === 'nests') {
    const left = b.enemies.filter((e) => !e.dead && e.nest).length;
    const broken = o.nests - left;
    return { progress: o.nests > 0 ? broken / o.nests : 1, line: left > 0 ? `Гнізд зруйновано: ${broken} з ${o.nests}` : 'Гнізда зруйновано — добийте звірів' };
  }
  const p = o.held / OBJECTIVES.rescue.time;
  return { progress: p, line: `Звільнення: ${Math.floor(p * 100)}%` };
}
