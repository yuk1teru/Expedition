// Timed effects: zones (static or following the hero), dashes with
// invulnerability, hero buffs.

import type { Battle } from './battle';
import { addStatus, damageEnemy, pull, rollCrit } from './combat';
import type { Hero, HeroBuff, Vec, Zone } from './entities';
import { dist } from './entities';

export interface ZoneSpec {
  kind: string;
  pos: Vec;
  radius: number;
  followHero?: boolean;
  duration: number;
  tickInterval: number;
  /** Damage per tick (already includes attack and multipliers). */
  damage: number;
  pull?: number;
  stun?: number;
  /** Tick immediately on creation. */
  tickNow?: boolean;
}

export function addZone(b: Battle, spec: ZoneSpec): Zone {
  const z: Zone = {
    id: b.nextId++,
    kind: spec.kind,
    pos: { ...spec.pos },
    radius: spec.radius,
    team: 'hero',
    followHero: spec.followHero ?? false,
    time: 0,
    duration: spec.duration,
    tickInterval: spec.tickInterval,
    tickTimer: spec.tickNow ? 0 : spec.tickInterval,
    damage: spec.damage,
    pull: spec.pull ?? 0,
    stun: spec.stun ?? 0,
    dead: false,
  };
  b.zones.push(z);
  return z;
}

export function updateZones(b: Battle, dt: number): void {
  const hero = b.hero;
  for (const z of b.zones) {
    if (z.dead) continue;
    if (z.followHero) {
      z.pos.x = hero.pos.x;
      z.pos.y = hero.pos.y;
    }
    z.time += dt;
    z.tickTimer -= dt;
    while (z.tickTimer <= 0 && z.time <= z.duration + 1e-9) {
      z.tickTimer += z.tickInterval;
      tickZone(b, z);
    }
    if (z.time >= z.duration) z.dead = true;
  }
}

function tickZone(b: Battle, z: Zone): void {
  const s = b.hero.stats;
  for (const e of b.enemies) {
    if (e.dead || dist(e.pos, z.pos) > z.radius + e.radius) continue;
    if (z.damage > 0) damageEnemy(b, e, rollCrit(b.rng, z.damage, s.critChance, s.critMult), { source: 'zone' });
    if (e.dead) continue;
    if (z.pull > 0) pull(e, z.pos, z.pull);
    if (z.stun > 0) addStatus(e, 'stun', z.stun);
  }
  b.events.emit({ type: 'skillTick', skillId: z.kind, pos: { ...z.pos }, radius: z.radius });
}

/** Moves the hero along a straight dash; invulnerable during it. */
export function startDash(hero: Hero, to: Vec, speed: number, onArrive: (() => void) | null): void {
  const d = dist(hero.pos, to);
  const duration = Math.max(d / speed, 1e-3);
  hero.dash = { from: { ...hero.pos }, to: { ...to }, time: 0, duration, onArrive };
  hero.invulnerable = Math.max(hero.invulnerable, duration);
  hero.facing = Math.atan2(to.y - hero.pos.y, to.x - hero.pos.x);
}

export function updateDash(hero: Hero, dt: number): void {
  const dash = hero.dash;
  if (!dash) return;
  dash.time = Math.min(dash.duration, dash.time + dt);
  const t = dash.time / dash.duration;
  hero.pos.x = dash.from.x + (dash.to.x - dash.from.x) * t;
  hero.pos.y = dash.from.y + (dash.to.y - dash.from.y) * t;
  if (t >= 1) {
    hero.dash = null;
    dash.onArrive?.();
  }
}

export function addBuff(hero: Hero, buff: HeroBuff): void {
  const existing = hero.buffs.find((x) => x.id === buff.id);
  if (existing) Object.assign(existing, buff);
  else hero.buffs.push({ ...buff });
}

export function updateBuffs(hero: Hero, dt: number): void {
  for (const buff of hero.buffs) buff.time -= dt;
  hero.buffs = hero.buffs.filter((x) => x.time > 0);
  hero.invulnerable = Math.max(0, hero.invulnerable - dt);
}
