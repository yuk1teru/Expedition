// One combat encounter. Pure simulation: no render, no DOM.

import { ARENA, FLOW, PROJECTILES } from '../data/balance';
import { type BiomeDef, getBiome } from '../data/biomes';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { updateEnemyAI, updateHeroAI } from './ai';
import { isBossDefeated, onBossDefeated, setupBossBattle, updateBoss, updateTelegraphs } from './boss';
import './bosses';
import { clampToArena, insideArena, separateBodies } from './collision';
import { damageEnemy, damageHero, decayKnockback, killEnemy, updateStatuses } from './combat';
import type { Body, Enemy, Hero, Projectile, Telegraph, Zone } from './entities';
import { dist, normalize } from './entities';
import { nearestEnemy } from './targeting';
import { updateBuffs, updateDash, updateZones } from './effects';
import type { GameEvent } from './gameEvents';
import { type MapNode, getNode } from './mapgen';
import { type WaveState, createWaves, updateWaves } from './waves';

export interface BattleStats {
  kills: number;
  xp: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
}

export type BattleOutcome = 'running' | 'won' | 'lost';

export interface Battle {
  state: GameState;
  node: MapNode;
  tier: number;
  biome: BiomeDef;
  kind: 'waves' | 'boss';
  rng: Rng;
  events: EventBus<GameEvent>;
  time: number;
  nextId: number;
  hero: Hero;
  enemies: Enemy[];
  projectiles: Projectile[];
  zones: Zone[];
  telegraphs: Telegraph[];
  waves: WaveState | null;
  boss: Enemy | null;
  stats: BattleStats;
  outcome: BattleOutcome;
  /** Counts down after the outcome is decided, then the flow moves on. */
  endTimer: number;
  /** Becomes true when endTimer runs out. */
  finished: boolean;
}

export function createBattle(state: GameState, nodeId: string): Battle {
  const node = getNode(state.world, nodeId);
  if (!node.biome) throw new Error(`Node ${nodeId} has no biome`);
  state.battleCount += 1;
  const hero = state.hero;
  resetHeroForBattle(hero);
  const b: Battle = {
    state,
    node,
    tier: node.tier,
    biome: getBiome(node.biome),
    kind: node.isBoss ? 'boss' : 'waves',
    rng: state.rng.fork(`battle-${state.battleCount}`),
    events: state.events,
    time: 0,
    nextId: 1,
    hero,
    enemies: [],
    projectiles: [],
    zones: [],
    telegraphs: [],
    waves: node.isBoss ? null : createWaves(),
    boss: null,
    stats: { kills: 0, xp: 0, gold: 0, damageDealt: 0, damageTaken: 0 },
    outcome: 'running',
    endTimer: 0,
    finished: false,
  };
  if (b.kind === 'boss') setupBossBattle(b);
  return b;
}

function resetHeroForBattle(hero: Hero): void {
  hero.pos = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
  hero.vel = { x: 0, y: 0 };
  hero.knockback = { x: 0, y: 0 };
  hero.statuses = {};
  hero.buffs = [];
  hero.dash = null;
  hero.invulnerable = 0;
  hero.attackTimer = 0;
  hero.dead = hero.hp <= 0;
  hero.hitAt = -Infinity;
  for (const s of hero.skills) s.cooldown = 0;
}

export function stepBattle(b: Battle, dt: number): void {
  if (b.outcome !== 'running') {
    b.endTimer -= dt;
    if (b.endTimer <= 0) b.finished = true;
    // Let projectiles and effects settle visually.
    updateProjectiles(b, dt);
    return;
  }
  b.time += dt;
  const hero = b.hero;

  // Hero.
  updateStatuses(b, hero, dt);
  updateBuffs(hero, dt);
  for (const s of hero.skills) s.cooldown = Math.max(0, s.cooldown - dt);
  updateDash(hero, dt);
  updateHeroAI(b, dt);

  // Spawning and boss logic.
  updateWaves(b, dt);
  updateBoss(b, dt);

  // Enemies.
  for (const e of b.enemies) {
    if (e.dead) continue;
    updateStatuses(b, e, dt);
    if (!e.dead) updateEnemyAI(b, e, dt);
  }

  // Integrate movement.
  integrate(hero, dt, hero.dash !== null);
  for (const e of b.enemies) if (!e.dead) integrate(e, dt, false);

  updateZones(b, dt);
  updateTelegraphs(b, dt);
  updateProjectiles(b, dt);

  // Collisions.
  const bodies: Body[] = [hero, ...b.enemies.filter((e) => !e.dead)];
  if (!hero.dash) separateBodies(bodies);
  else separateBodies(bodies.slice(1));
  for (const body of bodies) clampToArena(body);

  cleanup(b);
  checkOutcome(b);
}

function integrate(body: Body, dt: number, dashing: boolean): void {
  if (!dashing) {
    body.pos.x += (body.vel.x + body.knockback.x) * dt;
    body.pos.y += (body.vel.y + body.knockback.y) * dt;
  }
  decayKnockback(body, dt);
}

function updateProjectiles(b: Battle, dt: number): void {
  for (const p of b.projectiles) {
    if (p.dead) continue;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
    if (p.life <= 0 || !insideArena(p.pos.x, p.pos.y, p.radius)) {
      p.dead = true;
      continue;
    }
    if (b.outcome !== 'running') continue;
    if (p.team === 'enemy') {
      const hero = b.hero;
      if (!hero.dead && dist(p.pos, hero.pos) <= p.radius + hero.radius) {
        p.dead = true;
        damageHero(b, p.damage, { melee: p.melee });
      }
    } else {
      for (const e of b.enemies) {
        if (e.dead || p.hit.includes(e.id)) continue;
        if (dist(p.pos, e.pos) > p.radius + e.radius) continue;
        p.hit.push(e.id);
        damageEnemy(b, e, { amount: p.damage, crit: p.kind.endsWith('Crit') }, { source: 'basic' });
        if (p.pierce > 0) {
          p.pierce -= 1;
          continue;
        }
        if (p.ricochet > 0 && ricochet(b, p)) break;
        p.dead = true;
        break;
      }
    }
  }
}

/** Redirects a projectile to the nearest enemy it has not hit yet. */
function ricochet(b: Battle, p: Projectile): boolean {
  const next = nearestEnemy(
    b.enemies.filter((e) => !p.hit.includes(e.id)),
    p.pos,
    PROJECTILES.ricochetRange,
  );
  if (!next) return false;
  const speed = Math.hypot(p.vel.x, p.vel.y);
  const d = normalize({ x: next.pos.x - p.pos.x, y: next.pos.y - p.pos.y });
  p.vel = { x: d.x * speed, y: d.y * speed };
  p.ricochet -= 1;
  p.life = Math.max(p.life, PROJECTILES.ricochetRange / Math.max(speed, 1));
  return true;
}

function cleanup(b: Battle): void {
  if (b.enemies.some((e) => e.dead)) b.enemies = b.enemies.filter((e) => !e.dead);
  if (b.projectiles.some((p) => p.dead)) b.projectiles = b.projectiles.filter((p) => !p.dead);
  if (b.zones.some((z) => z.dead)) b.zones = b.zones.filter((z) => !z.dead);
  if (b.telegraphs.some((t) => t.dead)) b.telegraphs = b.telegraphs.filter((t) => !t.dead);
}

function checkOutcome(b: Battle): void {
  if (b.hero.dead) {
    finish(b, 'lost', FLOW.loseDelay);
    return;
  }
  if (b.kind === 'boss' && isBossDefeated(b)) {
    onBossDefeated(b);
    finish(b, 'won', FLOW.bossWinDelay);
  } else if (b.waves !== null && b.waves.finished) {
    finish(b, 'won', FLOW.winDelay);
  }
}

function finish(b: Battle, outcome: BattleOutcome, delay: number): void {
  b.outcome = outcome;
  b.endTimer = delay;
  b.zones = [];
  b.telegraphs = [];
  b.events.emit({ type: 'battleEnd', won: outcome === 'won' });
}

/** Debug: kill every enemy on the field. */
export function killAll(b: Battle): void {
  for (const e of b.enemies) if (!e.dead) killEnemy(b, e);
}
