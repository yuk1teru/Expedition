// One combat encounter. Pure simulation: no render, no DOM.

import { ARENA, FLOW, PROJECTILES } from '../data/balance';
import { type BiomeDef, getBiome } from '../data/biomes';
import { getClass } from '../data/classes';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { updateEnemyAI, updateHeroAI } from './ai';
import { isBossDefeated, onBossDefeated, setupBossBattle, updateBoss, updateTelegraphs } from './boss';
import './bosses';
import { type Pickup, updatePickups } from './pickups';
import { clampToArena, insideArena, separateBodies } from './collision';
import { addStatus, damageEnemy, damageHero, debuffHero, decayKnockback, killEnemy, updateHeroHealing, updateStatuses, type DeathCause } from './combat';
import type { Ally, Body, Enemy, Hero, HeroCharge, Projectile, Telegraph, Vec, Zone } from './entities';
import { updateAllies } from './allies';
import { type Hazard, addPuddle, updateHazards } from './hazards';
import { startPromotionEffects, updatePromotion } from './promotion';
import { dist, normalize } from './entities';
import { nearestEnemy } from './targeting';
import { blast, updateBuffs, updateDash, updateZones } from './effects';
import type { Item } from './items';
import type { GameEvent } from './gameEvents';
import { type MapNode, effectiveTier, getNode } from './mapgen';
import { type Trap, updateTraps } from './traps';
import { type WaveState, createWaves, updateWaves } from './waves';
import { type WeatherState, updateWeather } from './weather';

export interface BattleStats {
  kills: number;
  xp: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
  /** Healing items drunk. */
  heals: number;
  /** Items dropped by bosses and minibosses. */
  loot: Item[];
}

export type BattleOutcome = 'running' | 'won' | 'lost';

/** A mana orb on the ground: the Mage picks it up by stepping on it. */
export interface ManaOrb {
  id: number;
  pos: Vec;
  amount: number;
  time: number;
  /** Seconds before it fades. */
  life: number;
}

export interface Portal {
  pos: Vec;
  radius: number;
  entered: boolean;
}

/**
 * Hero control for this step. `player`: moves only by `move`, attacks towards `aim`
 * (last direction if no aim). `bot` (simulation): AI walks to enemies unless `move` is set.
 */
export interface HeroInput {
  control: 'player' | 'bot';
  move: Vec;
  aim: Vec | null;
  /** Mouse position even outside the arena (over the HUD); null for the bot. */
  cursor: Vec | null;
}

export interface Battle {
  state: GameState;
  node: MapNode;
  tier: number;
  biome: BiomeDef;
  kind: 'waves' | 'boss';
  rng: Rng;
  events: EventBus<GameEvent>;
  input: HeroInput;
  time: number;
  nextId: number;
  hero: Hero;
  enemies: Enemy[];
  /** The hero's wolves (Beastmaster). */
  allies: Ally[];
  /** Skills being channelled by the hero (Aimed Shot). */
  charges: HeroCharge[];
  /** Boss puddles and expanding rings. */
  hazards: Hazard[];
  /** Mana orbs left by enemies for the Mage. */
  manaOrbs: ManaOrb[];
  projectiles: Projectile[];
  zones: Zone[];
  telegraphs: Telegraph[];
  /** Plants growing on the arena. */
  pickups: Pickup[];
  /** Snares on the arena. */
  traps: Trap[];
  /** Weather of the running event wave. */
  weather: WeatherState | null;
  waves: WaveState | null;
  /** Exit portal (opens after the mandatory waves). */
  portal: Portal | null;
  boss: Enemy | null;
  stats: BattleStats;
  /** Lifesteal healed since the last popup, and time to the next popup. */
  healAcc: number;
  /** What killed the hero (null while alive or when unknown). */
  deathCause: DeathCause | null;
  healTimer: number;
  /** Poison damage since the last popup (shown summed, like lifesteal). */
  poisonAcc: number;
  /** Fractional gold not paid out yet. */
  goldFrac: number;
  outcome: BattleOutcome;
  /** Counts down after the outcome is decided, then the flow moves on. */
  endTimer: number;
  /** Becomes true when endTimer runs out. */
  finished: boolean;
}

/** `startWave`: waves already cleared on earlier visits (continue from the next one). */
export function createBattle(state: GameState, nodeId: string, startWave = 0): Battle {
  const node = getNode(state.world, nodeId);
  if (!node.biome) throw new Error(`Node ${nodeId} has no biome`);
  state.battleCount += 1;
  const hero = state.hero;
  resetHeroForBattle(hero);
  const b: Battle = {
    state,
    node,
    tier: effectiveTier(node, state.bossesDefeated.length),
    biome: getBiome(node.biome),
    kind: node.isBoss ? 'boss' : 'waves',
    rng: state.rng.fork(`battle-${state.battleCount}`),
    events: state.events,
    input: { control: 'bot', move: { x: 0, y: 0 }, aim: null, cursor: null },
    time: 0,
    nextId: 1,
    hero,
    enemies: [],
    allies: [],
    charges: [],
    hazards: [],
    manaOrbs: [],
    projectiles: [],
    zones: [],
    telegraphs: [],
    pickups: [],
    traps: [],
    weather: null,
    waves: node.isBoss ? null : createWaves(startWave),
    portal: null,
    boss: null,
    stats: { kills: 0, xp: 0, gold: 0, damageDealt: 0, damageTaken: 0, heals: 0, loot: [] },
    healAcc: 0,
    deathCause: null,
    healTimer: 0,
    poisonAcc: 0,
    goldFrac: 0,
    outcome: 'running',
    endTimer: 0,
    finished: false,
  };
  if (b.kind === 'boss') setupBossBattle(b);
  startPromotionEffects(b);
  return b;
}

function resetHeroForBattle(hero: Hero): void {
  hero.pos = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
  hero.vel = { x: 0, y: 0 };
  hero.knockback = { x: 0, y: 0 };
  hero.statuses = {};
  // Buffs earned between battles (skipped cards) start now.
  hero.buffs = hero.pendingBuffs;
  hero.pendingBuffs = [];
  hero.dash = null;
  hero.invulnerable = 0;
  hero.attackTimer = 0;
  hero.dead = hero.hp <= 0;
  hero.hitAt = -Infinity;
  for (const s of hero.skills) s.cooldown = 0;
  hero.dodgeCooldown = 0;
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
  if (!hero.dead) updateHeroHealing(b, dt);
  for (const s of hero.skills) s.cooldown = Math.max(0, s.cooldown - dt);
  hero.dodgeCooldown = Math.max(0, hero.dodgeCooldown - dt);
  updateDash(hero, dt);
  updateHeroAI(b, dt);
  updatePromotion(b, dt);
  updateCharges(b, dt);
  updateAllies(b, dt);

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
  for (const e of b.enemies) {
    if (e.dead) continue;
    if (e.yank) yankStep(e, dt);
    else integrate(e, dt, false);
  }
  for (const a of b.allies) if (!a.dead) integrate(a, dt, false);

  updateZones(b, dt);
  updateTelegraphs(b, dt);
  updateHazards(b, dt);
  updateManaOrbs(b, dt);
  updatePickups(b, dt);
  updateTraps(b);
  updateWeather(b, dt);
  updateProjectiles(b, dt);

  // Collisions.
  const bodies: Body[] = [hero, ...b.allies.filter((a) => !a.dead), ...b.enemies.filter((e) => !e.dead)];
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

/** Hooked enemy flies straight to its spot next to the hero. */
function yankStep(e: Enemy, dt: number): void {
  const y = e.yank!;
  const d = dist(e.pos, y.to);
  const step = y.speed * dt;
  e.knockback.x = 0;
  e.knockback.y = 0;
  if (d <= step) {
    e.pos = { ...y.to };
    e.yank = null;
    return;
  }
  e.pos.x += ((y.to.x - e.pos.x) / d) * step;
  e.pos.y += ((y.to.y - e.pos.y) / d) * step;
}

function updateProjectiles(b: Battle, dt: number): void {
  for (const p of b.projectiles) {
    if (p.dead) continue;
    if (p.homingId !== undefined) steer(b, p);
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
    if (p.life <= 0 || !insideArena(p.pos.x, p.pos.y, p.radius)) {
      p.dead = true;
      if (p.puddle && b.outcome === 'running') addPuddle(b, p.puddle.kind, p.pos, p.puddle.radius, p.puddle.duration, p.puddle.dps);
      // An exploding projectile that hit nothing bursts where it stops.
      if (p.explode && b.outcome === 'running') blast(b, p.pos, p.explode, p.explode.excludeHit ? p.hit : []);
      continue;
    }
    if (b.outcome !== 'running') continue;
    if (p.team === 'enemy') {
      const hero = b.hero;
      if (!hero.dead && dist(p.pos, hero.pos) <= p.radius + hero.radius) {
        p.dead = true;
        if (p.puddle) addPuddle(b, p.puddle.kind, hero.pos, p.puddle.radius, p.puddle.duration, p.puddle.dps);
        // Some projectiles only slow (no damage, no hurt number).
        if (p.damage > 0) damageHero(b, p.damage, { melee: p.melee, cause: { kind: 'shot', by: p.owner ?? null, shot: p.kind } });
        if (p.slow) debuffHero(b, 'slow', p.slow.time, p.slow.value);
      }
    } else {
      for (const e of b.enemies) {
        if (e.dead || p.hit.includes(e.id)) continue;
        if (dist(p.pos, e.pos) > p.radius + e.radius) continue;
        p.hit.push(e.id);
        if (p.damage > 0) damageEnemy(b, e, { amount: p.damage, crit: p.kind.endsWith('Crit') }, { source: p.source ?? 'basic' });
        if (p.onHit && !e.dead) addStatus(e, p.onHit.id, p.onHit.time, p.onHit.value);
        if (p.explode) {
          p.dead = true;
          blast(b, p.pos, p.explode, p.explode.excludeHit ? p.hit : []);
          break;
        }
        if (p.pierce > 0) {
          p.pierce -= 1;
          if (p.pierceMult !== undefined) p.damage *= p.pierceMult;
          continue;
        }
        if (p.ricochet > 0 && ricochet(b, p)) break;
        p.dead = true;
        break;
      }
    }
  }
}

/** A homing projectile turns towards its target while the target lives. */
function steer(b: Battle, p: Projectile): void {
  const t = b.enemies.find((e) => e.id === p.homingId && !e.dead);
  if (!t) {
    p.homingId = undefined;
    return;
  }
  const speed = Math.hypot(p.vel.x, p.vel.y);
  const d = normalize({ x: t.pos.x - p.pos.x, y: t.pos.y - p.pos.y });
  p.vel = { x: d.x * speed, y: d.y * speed };
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
  if (p.homingId !== undefined) p.homingId = next.id;
  p.life = Math.max(p.life, PROJECTILES.ricochetRange / Math.max(speed, 1));
  return true;
}

function updateManaOrbs(b: Battle, dt: number): void {
  if (b.manaOrbs.length === 0) return;
  const hero = b.hero;
  const mana = hero.classId ? getClass(hero.classId).traits.mana : undefined;
  for (const o of b.manaOrbs) {
    o.time += dt;
    if (!mana || hero.dead || dist(o.pos, hero.pos) > hero.radius + mana.orbRadius) continue;
    hero.mana = Math.min(hero.stats.manaMax, hero.mana + o.amount);
    o.time = o.life;
    b.events.emit({ type: 'manaPickup', pos: { ...o.pos }, amount: o.amount });
  }
  b.manaOrbs = b.manaOrbs.filter((o) => o.time < o.life);
}

/** Channelled hero skills fire when their time is up (cancelled if the hero dies). */
function updateCharges(b: Battle, dt: number): void {
  if (b.charges.length === 0) return;
  for (const c of b.charges) c.time += dt;
  const ready = b.charges.filter((c) => c.time >= c.delay);
  b.charges = b.hero.dead ? [] : b.charges.filter((c) => c.time < c.delay);
  for (const c of ready) c.onFire();
}

function cleanup(b: Battle): void {
  if (b.enemies.some((e) => e.dead)) b.enemies = b.enemies.filter((e) => !e.dead);
  if (b.allies.some((a) => a.dead)) b.allies = b.allies.filter((a) => !a.dead);
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
  } else if (b.portal?.entered) {
    finish(b, 'won', FLOW.portalDelay);
  }
}

function finish(b: Battle, outcome: BattleOutcome, delay: number): void {
  b.outcome = outcome;
  b.endTimer = delay;
  b.zones = [];
  b.telegraphs = [];
  b.charges = [];
  b.hazards = [];
  b.events.emit({ type: 'battleEnd', won: outcome === 'won' });
}

/** Debug: kill every enemy on the field. */
export function killAll(b: Battle): void {
  for (const e of b.enemies) if (!e.dead) killEnemy(b, e);
}
