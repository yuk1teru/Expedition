// Timed effects: zones (static or following the hero), dashes with
// invulnerability, hero buffs.

import { ARENA } from '../data/balance';
import type { Battle } from './battle';
import { addStatus, damageEnemy, pull, rollCrit, setBlastHandler } from './combat';
import type { Blast, Enemy, Hero, HeroBuff, Vec, Zone } from './entities';
import { dist, distToSegment } from './entities';

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
  slow?: number;
  slowTime?: number;
  /** Burn per tick: damage per second and seconds. */
  burn?: number;
  burnTime?: number;
  /** Hero trap: fires `finale` when an enemy comes within this radius, then ends. */
  trigger?: number;
  finale?: Blast;
  /** A wall along a–b instead of a circle (`radius` = half its thickness). */
  line?: { a: Vec; b: Vec };
  freezeChance?: number;
  freezeTime?: number;
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
    slow: spec.slow ?? 0,
    slowTime: spec.slowTime ?? 0,
    burn: spec.burn ?? 0,
    burnTime: spec.burnTime ?? 0,
    trigger: spec.trigger ?? 0,
    finale: spec.finale ?? null,
    line: spec.line ? { a: { ...spec.line.a }, b: { ...spec.line.b } } : null,
    freezeChance: spec.freezeChance ?? 0,
    freezeTime: spec.freezeTime ?? 0,
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
    if (z.trigger > 0) {
      // A trap: fires when an enemy steps close, or fizzles at the end of its life.
      if (b.enemies.some((e) => !e.dead && dist(e.pos, z.pos) <= z.trigger + e.radius)) {
        z.dead = true;
        if (z.finale) blast(b, z.pos, z.finale);
      } else if (z.time >= z.duration) z.dead = true;
      continue;
    }
    z.tickTimer -= dt;
    while (z.tickTimer <= 0 && z.time <= z.duration + 1e-9) {
      z.tickTimer += z.tickInterval;
      tickZone(b, z);
    }
    if (z.time >= z.duration) {
      z.dead = true;
      if (z.finale) blast(b, z.pos, z.finale);
    }
  }
}

/**
 * Damage and effects to every enemy within the blast radius (crits rolled per target);
 * `exclude`: enemies spared (e.g. the one a projectile already hit).
 */
export function blast(b: Battle, pos: Vec, spec: Blast, exclude: readonly number[] = []): Enemy[] {
  const s = b.hero.stats;
  const hit: Enemy[] = [];
  for (const e of b.enemies) {
    if (e.dead || exclude.includes(e.id) || dist(e.pos, pos) > spec.radius + e.radius) continue;
    hit.push(e);
    if (spec.damage > 0) {
      damageEnemy(b, e, rollCrit(b.rng, spec.damage, s.critChance, s.critMult), {
        source: 'skill',
        knockFrom: spec.knockback ? pos : undefined,
        knockback: spec.knockback,
      });
    }
    if (e.dead) continue;
    applyBlastStatuses(e, spec);
  }
  if (spec.zone) {
    const z = spec.zone;
    addZone(b, { kind: z.kind, pos, radius: z.radius, duration: z.duration, tickInterval: z.tickInterval, damage: z.damage, slow: z.slow, slowTime: z.slowTime, burn: z.burn, burnTime: z.burnTime });
  }
  b.events.emit({ type: 'skillTick', skillId: spec.kind, pos: { ...pos }, radius: spec.radius });
  return hit;
}

setBlastHandler((b, pos, spec) => {
  blast(b, pos, spec);
});

/** Statuses of a blast (or a projectile / zone hit) on one enemy. */
export function applyBlastStatuses(e: Enemy, spec: Pick<Blast, 'stun' | 'slow' | 'slowTime' | 'burn' | 'burnTime' | 'vuln' | 'vulnTime' | 'freeze'>): void {
  if (spec.stun) addStatus(e, 'stun', spec.stun);
  if (spec.freeze) addStatus(e, 'freeze', spec.freeze);
  if (spec.slow && spec.slowTime) addStatus(e, 'slow', spec.slowTime, spec.slow);
  if (spec.burn && spec.burnTime) addStatus(e, 'burn', spec.burnTime, spec.burn);
  if (spec.vuln && spec.vulnTime) addStatus(e, 'vuln', spec.vulnTime, spec.vuln);
}

/** Whether a body of radius `r` at `p` touches the zone (circle or wall). */
export function inZone(z: Zone, p: Vec, r: number): boolean {
  return (z.line ? distToSegment(p, z.line.a, z.line.b) : dist(p, z.pos)) <= z.radius + r;
}

function tickZone(b: Battle, z: Zone): void {
  const s = b.hero.stats;
  for (const e of b.enemies) {
    if (e.dead || !inZone(z, e.pos, e.radius)) continue;
    if (z.damage > 0) damageEnemy(b, e, rollCrit(b.rng, z.damage, s.critChance, s.critMult), { source: 'zone' });
    if (e.dead) continue;
    if (z.pull > 0) pull(e, z.pos, z.pull);
    if (z.stun > 0) addStatus(e, 'stun', z.stun);
    if (z.slow > 0) addStatus(e, 'slow', z.slowTime, z.slow);
    if (z.burn > 0) addStatus(e, 'burn', z.burnTime, z.burn);
    if (z.freezeChance > 0 && !e.boss && b.rng.chance(z.freezeChance)) addStatus(e, 'freeze', z.freezeTime);
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

/** Instant move with a short invulnerability window. */
export function teleport(hero: Hero, to: Vec, invulnerable: number): void {
  hero.pos.x = Math.max(ARENA.x + hero.radius, Math.min(ARENA.x + ARENA.w - hero.radius, to.x));
  hero.pos.y = Math.max(ARENA.y + hero.radius, Math.min(ARENA.y + ARENA.h - hero.radius, to.y));
  hero.dash = null;
  hero.invulnerable = Math.max(hero.invulnerable, invulnerable);
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
