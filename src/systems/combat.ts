// Damage, crits, armor, lifesteal, thorns, kills, knockback and statuses.

import { bossLegendary, maybeSetPiece } from './uniques';
import { dropSoul, stoneResist } from './souls';
import { dropTrophies } from './trophies';
import { ENEMY_COMMON, HERO, HERO_DEBUFFS } from '../data/balance';
import type { Rng } from '../core/rng';
import type { Battle } from './battle';
import type { Blast, Body, Enemy, Hero, StatusId, Vec } from './entities';
import { normalize } from './entities';
import type { HitSource } from './gameEvents';
import { getBoss } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { getClass } from '../data/classes';
import { LOOT } from '../data/items';
import { displayName, dropItemLevel, itemLevelRange, rollItem, rollRarity, stashLoot } from './items';
import { basicElement, heroAttack, heroLifesteal, heroRegen } from './hero';
import { giftHitMult } from './gifts';
import { type Element, elementMultiplier } from '../data/elements';
import { getPromotion } from '../data/promotions';
import { gainXp } from './leveling';
import { applyArmor, xpReward } from './scaling';

export interface Roll {
  amount: number;
  crit: boolean;
  /** Element of the damage (default: neutral). */
  element?: Element;
}

export function rollCrit(rng: Rng, base: number, critChance: number, critMult: number): Roll {
  const crit = rng.chance(critChance);
  return { amount: crit ? base * critMult : base, crit };
}

/** Hero damage: attack × multiplier, crit roll; skills also get the class skill multiplier. */
export function heroDamage(b: Battle, mult: number, source: HitSource): Roll {
  const s = b.hero.stats;
  const skillMult = source === 'skill' || source === 'zone' ? s.skillDamageMult * b.hero.castMult : 1;
  const roll = rollCrit(b.rng, heroAttack(b.hero) * mult * skillMult, s.critChance, s.critMult);
  // Basic attacks: the hero's own element; skills: the element of the skill being cast.
  roll.element = source === 'basic' ? basicElement(b.hero) : (b.castElement ?? 'neutral');
  return roll;
}

export interface HitOptions {
  source: HitSource;
  /** Element of the damage (overrides the roll's). */
  element?: Element;
  /** Knockback away from this point. */
  knockFrom?: Vec;
  knockback?: number;
}

export function damageEnemy(b: Battle, e: Enemy, roll: Roll, opts: HitOptions): number {
  if (e.dead) return 0;
  const vuln = e.statuses.vuln;
  const element = opts.element ?? roll.element ?? 'neutral';
  const eff = elementMultiplier(element, e.element);
  // Gifts: +damage of an element, against stunned, frozen… (not for thorns).
  const gift = opts.source === 'thorns' ? 1 : giftHitMult(b.hero, element, e);
  const amount = applyArmor(roll.amount, e.armor) * (vuln && vuln.time > 0 ? 1 + vuln.value : 1) * frozenBonus(b.hero, e) * eff * gift;
  e.hp -= amount;
  e.hitAt = b.time;
  b.stats.damageDealt += amount;
  const hero = b.hero;
  const lifesteal = heroLifesteal(hero);
  if (lifesteal > 0 && opts.source !== 'thorns' && opts.source !== 'ally') {
    // Every damage source heals, skills included; the numbers are summed for display.
    healHero(b, amount * lifesteal, 'aggregate');
  }
  if (opts.knockFrom && opts.knockback) knock(e, opts.knockFrom, opts.knockback);
  b.events.emit({
    type: 'hit',
    pos: { x: e.pos.x, y: e.pos.y },
    amount,
    crit: roll.crit,
    targetId: e.id,
    radius: e.radius,
    source: opts.source,
    element,
    eff,
  });
  if (e.hp <= 0) killEnemy(b, e);
  return amount;
}

export function killEnemy(b: Battle, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  b.stats.kills += 1;
  if (!e.boss) b.stats.killsById[e.defId] = (b.stats.killsById[e.defId] ?? 0) + 1;
  else if (getBoss(e.boss.defId).miniboss) b.stats.minibossKills += 1;
  const cdr = b.hero.stats.killCdr;
  if (cdr > 0) for (const s of b.hero.skills) s.cooldown = Math.max(0, s.cooldown - cdr);
  const isBoss = e.boss !== null;
  b.events.emit({ type: 'kill', pos: { ...e.pos }, defId: e.defId, radius: e.radius, elite: e.elite, boss: isBoss });
  // Fractions of gold add up over kills.
  b.goldFrac += e.gold;
  const gold = Math.floor(b.goldFrac);
  b.goldFrac -= gold;
  if (gold > 0) {
    b.state.gold += gold;
    b.stats.gold += gold;
    b.events.emit({ type: 'gold', pos: { ...e.pos }, amount: gold });
  }
  if (e.xp > 0) {
    const xp = xpReward(e.xp, b.level, b.hero.level);
    b.stats.xp += xp;
    gainXp(b.state, xp);
  }
  if (e.boss) dropLoot(b, e);
  dropTrophies(b, e);
  dropSoul(b, e);
  if (hasStatus(e, 'freeze')) shatter(b, e);
  manaFromKill(b, e);
  const split = ENEMIES[e.defId]?.split;
  if (split && !e.boss) onSplit(b, e, split.into, split.count);
}

/** Mage: every kill gives a little mana; sometimes the enemy leaves a mana orb. */
function manaFromKill(b: Battle, e: Enemy): void {
  const hero = b.hero;
  const mana = hero.classId ? getClass(hero.classId).traits.mana : undefined;
  if (!mana || hero.dead) return;
  hero.mana = Math.min(hero.stats.manaMax, hero.mana + mana.perKill);
  if (b.rng.chance(mana.orbChance)) b.manaOrbs.push({ id: b.nextId++, pos: { ...e.pos }, amount: mana.orbMana, time: 0, life: mana.orbLife });
}

/** Splitting enemies (scarab, slime): set by waves.ts, which owns spawning. */
let onSplit: (b: Battle, e: Enemy, into: string, count: number) => void = () => {};
export function setSplitHandler(fn: (b: Battle, e: Enemy, into: string, count: number) => void): void {
  onSplit = fn;
}

/** Cryomancer: frozen enemies take more damage. */
function frozenBonus(hero: Hero, e: Enemy): number {
  if (!hero.promotion || !hasStatus(e, 'freeze')) return 1;
  const fx = getPromotion(hero.promotion).effect;
  return fx.kind === 'shatter' ? 1 + fx.frozenBonus : 1;
}

/** Cryomancer: an enemy dying frozen bursts into ice shards flying outwards. */
function shatter(b: Battle, e: Enemy): void {
  const hero = b.hero;
  if (!hero.promotion) return;
  const fx = getPromotion(hero.promotion).effect;
  if (fx.kind !== 'shatter') return;
  for (let i = 0; i < fx.shards; i++) {
    const a = (i / fx.shards) * Math.PI * 2;
    b.projectiles.push({
      id: b.nextId++,
      pos: { ...e.pos },
      vel: { x: Math.cos(a) * fx.shardSpeed, y: Math.sin(a) * fx.shardSpeed },
      radius: 5,
      damage: heroAttack(hero) * fx.shardDamage * hero.stats.skillDamageMult,
      team: 'hero',
      life: fx.shardRange / fx.shardSpeed,
      pierce: 0,
      ricochet: 0,
      hit: [e.id],
      kind: 'shard',
      melee: false,
      source: 'skill',
      dead: false,
    });
  }
  b.events.emit({ type: 'skillTick', skillId: 'shatter', pos: { ...e.pos }, radius: e.radius + 20 });
}

/**
 * Bosses drop strong items, minibosses weak ones; the item level comes from the location
 * tier (and the wave, for minibosses). New items go straight to the hero's bag.
 */
function dropLoot(b: Battle, e: Enemy): void {
  const def = getBoss(e.boss!.defId);
  const source = def.miniboss ? 'miniboss' : 'boss';
  const table = LOOT[source];
  const st = b.state;
  const wave = (b.waves?.index ?? 0) + 1;
  for (let i = 0; i < table.count; i++) {
    const rarity = rollRarity(st.lootRng, table.weights);
    const ilvl = dropItemLevel(st.lootRng, itemLevelRange(b.level), source, wave);
    const item = rollItem(st.lootRng, rarity, st.nextItemUid++, undefined, ilvl, b.hero.classId);
    // Minibosses and the boss of a set's region drop its pieces (ROADMAP 14.5).
    maybeSetPiece(st.lootRng, item, b.node.region);
    stashLoot(b.hero, item);
    b.stats.loot.push(item);
    b.events.emit({ type: 'loot', pos: { ...e.pos }, name: displayName(item), rarity: item.rarity });
  }
  // A boss's own legendary: always at the first win over it (ROADMAP 15.3).
  const own = source === 'boss' ? bossLegendary(def.id) : undefined;
  if (own && !st.bossesDefeated.includes(b.node.id)) {
    const item = rollItem(st.lootRng, 'legendary', st.nextItemUid++, own.slot, itemLevelRange(b.level)[1], b.hero.classId);
    item.legendary = own.id;
    item.name = own.name;
    stashLoot(b.hero, item);
    b.stats.loot.push(item);
    b.events.emit({ type: 'loot', pos: { ...e.pos }, name: displayName(item), rarity: item.rarity });
  }
}

/** What dealt the hero's last blow (the doctor's story after death, battle statistics). */
export type DeathCause =
  /** A blow of an enemy or a boss (`by`: enemy or boss id). */
  | { kind: 'melee'; by: string }
  /** A projectile (`by`: the shooter, if known; `shot`: its kind). */
  | { kind: 'shot'; by: string | null; shot: string }
  /** A telegraphed strike (a red circle, a line). */
  | { kind: 'telegraph'; by: string | null; attack: string }
  /** A puddle or a ring on the ground (acid, poison, toxic wave). */
  | { kind: 'hazard'; hazard: string }
  | { kind: 'trap' }
  | { kind: 'poison' };

export interface HeroHitOptions {
  attacker?: Enemy;
  melee: boolean;
  /** What hits (default: a blow of `attacker`). */
  cause?: DeathCause;
}

export function damageHero(b: Battle, rawAmount: number, opts: HeroHitOptions): number {
  const hero = b.hero;
  if (hero.dead || hero.invulnerable > 0) return 0;
  // Archer: sometimes steps aside from a melee blow.
  if (opts.melee && hero.stats.dodgeMelee > 0 && b.rng.chance(hero.stats.dodgeMelee)) {
    b.events.emit({ type: 'heroDodged', pos: { ...hero.pos } });
    return 0;
  }
  let amount = applyArmor(rawAmount, hero.stats.armor);
  for (const buff of hero.buffs) amount *= buff.damageTakenMult;
  hero.hitAt = b.time;
  if (opts.melee && opts.attacker && !opts.attacker.dead && hero.stats.thorns > 0) {
    damageEnemy(b, opts.attacker, { amount: rawAmount * hero.stats.thorns, crit: false }, { source: 'thorns' });
  }
  amount = absorbWithShields(b, amount, opts);
  amount = absorbWithMana(b, amount);
  if (amount <= 0) return 0;
  if (hero.immortal) amount = Math.min(amount, Math.max(0, hero.hp - 1));
  hero.hp -= amount;
  b.stats.damageTaken += amount;
  b.events.emit({ type: 'heroHurt', pos: { ...hero.pos }, amount });
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.dead = true;
    b.deathCause = opts.cause ?? (opts.attacker ? { kind: 'melee', by: opts.attacker.boss?.defId ?? opts.attacker.defId } : null);
    b.events.emit({ type: 'heroDeath', pos: { ...hero.pos } });
  }
  return amount;
}

/**
 * Barriers (buffs with `shield`) take the hit first. A barrier used up ends and may
 * burst (`breakBlast`); while it holds, melee attackers may freeze. Returns what is left.
 */
function absorbWithShields(b: Battle, amount: number, opts: HeroHitOptions): number {
  const hero = b.hero;
  for (const buff of hero.buffs) {
    if (!buff.shield || buff.shield <= 0 || amount <= 0) continue;
    const absorbed = Math.min(buff.shield, amount);
    buff.shield -= absorbed;
    amount -= absorbed;
    const broken = buff.shield <= 0;
    b.events.emit({ type: 'shieldHit', pos: { ...hero.pos }, amount: absorbed, broken });
    if (!broken && buff.freezeAttackers && opts.melee && opts.attacker && !opts.attacker.dead && !opts.attacker.boss) {
      addStatus(opts.attacker, 'freeze', buff.freezeAttackers);
    }
    if (broken) {
      buff.time = 0;
      if (buff.breakBlast) blastAround(b, hero.pos, buff.breakBlast);
    }
  }
  return amount;
}

/** Mage: mana takes what the barriers left, `manaAbsorb` HP per mana point. */
function absorbWithMana(b: Battle, amount: number): number {
  const hero = b.hero;
  if (amount <= 0 || hero.mana <= 0 || hero.stats.manaAbsorb <= 0) return amount;
  const absorbed = Math.min(amount, hero.mana * hero.stats.manaAbsorb);
  hero.mana -= absorbed / hero.stats.manaAbsorb;
  b.events.emit({ type: 'manaShield', pos: { ...hero.pos }, amount: absorbed, empty: hero.mana <= 1e-6 });
  return amount - absorbed;
}

/** Hook for barrier bursts (set by effects.ts to avoid an import cycle at load time). */
let blastAround: (b: Battle, pos: Vec, spec: Blast) => void = () => {};
export function setBlastHandler(fn: (b: Battle, pos: Vec, spec: Blast) => void): void {
  blastAround = fn;
}

/** The hero ignores slows, roots and stuns (e.g. Iron Skin rank 5). */
export function heroCcImmune(hero: Hero): boolean {
  return hero.buffs.some((x) => x.ccImmune);
}

/** Slow, root or stun on the hero from enemies, traps and weather. Returns false if it did not stick. */
export function debuffHero(b: Battle, id: 'slow' | 'root' | 'stun', time: number, value = 0): boolean {
  const hero = b.hero;
  if (hero.dead || hero.invulnerable > 0 || heroCcImmune(hero)) return false;
  // Soul stones resist (ROADMAP 14.3): slows and roots, stuns last shorter.
  const resist = stoneResist(hero, id === 'stun' ? 'stun' : 'slow');
  addStatus(hero, id, time * (1 - resist), id === 'slow' ? Math.min(HERO_DEBUFFS.maxSlow, value) : value);
  return true;
}

/** `show`: number pops up now; `aggregate`: summed and shown periodically; `silent`: no number. */
export function healHero(b: Battle, amount: number, mode: 'show' | 'aggregate' | 'silent' = 'show'): void {
  const hero = b.hero;
  if (hero.dead || amount <= 0) return;
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  const healed = hero.hp - before;
  if (mode === 'aggregate') b.healAcc += healed;
  else if (mode === 'show' && healed >= 1) b.events.emit({ type: 'heroHeal', pos: { ...hero.pos }, amount: healed });
}

/** Regeneration and the periodic lifesteal popup. */
export function updateHeroHealing(b: Battle, dt: number): void {
  // Base regen pauses while the hero is being hit; buff regen (skipped card) always works.
  const base = b.time - b.hero.hitAt >= HERO.regenDelay ? b.hero.stats.hpRegen : 0;
  // Warrior: a share of max HP per second that works in the thick of a fight too.
  const always = b.hero.maxHp * b.hero.stats.combatRegenPct;
  healHero(b, (heroRegen(b.hero) - b.hero.stats.hpRegen + base + always) * dt, 'silent');
  b.healTimer -= dt;
  if (b.healTimer > 0) return;
  b.healTimer = HERO.healPopupInterval;
  if (b.healAcc >= 1) b.events.emit({ type: 'heroHeal', pos: { ...b.hero.pos }, amount: b.healAcc });
  b.healAcc = 0;
  if (b.poisonAcc >= 1) b.events.emit({ type: 'heroHurt', pos: { ...b.hero.pos }, amount: b.poisonAcc });
  b.poisonAcc = 0;
}

/** Poison on the hero: silent HP loss, summed into a popup (it does not pause regen like a hit). */
function poisonHero(b: Battle, amount: number): void {
  const hero = b.hero;
  if (hero.dead || hero.invulnerable > 0 || amount <= 0) return;
  amount *= 1 - stoneResist(hero, 'poison');
  if (hero.immortal) amount = Math.min(amount, Math.max(0, hero.hp - 1));
  hero.hp -= amount;
  b.stats.damageTaken += amount;
  b.poisonAcc += amount;
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.dead = true;
    b.deathCause = { kind: 'poison' };
    b.events.emit({ type: 'heroDeath', pos: { ...hero.pos } });
  }
}

/** Adds an impulse away from `from`; heavier bodies move less. */
export function knock(body: Body, from: Vec, strength: number): void {
  const d = normalize({ x: body.pos.x - from.x, y: body.pos.y - from.y });
  const k = strength / Math.max(1, body.mass);
  body.knockback.x += d.x * k;
  body.knockback.y += d.y * k;
}

/** Impulse towards `to` (pull). */
export function pull(body: Body, to: Vec, strength: number): void {
  const d = normalize({ x: to.x - body.pos.x, y: to.y - body.pos.y });
  const k = strength / Math.max(1, body.mass);
  body.knockback.x += d.x * k;
  body.knockback.y += d.y * k;
}

export function decayKnockback(body: Body, dt: number): void {
  const f = Math.exp(-ENEMY_COMMON.knockbackDecay * dt);
  body.knockback.x *= f;
  body.knockback.y *= f;
}

export function addStatus(body: Body, id: StatusId, time: number, value = 0): void {
  const cur = body.statuses[id];
  if (!cur || cur.time < time || cur.value < value) {
    body.statuses[id] = { time: Math.max(time, cur?.time ?? 0), value: Math.max(value, cur?.value ?? 0) };
  }
}

export function hasStatus(body: Body, id: StatusId): boolean {
  return (body.statuses[id]?.time ?? 0) > 0;
}

/** Stunned or frozen bodies cannot move or attack. */
export function isDisabled(body: Body): boolean {
  return hasStatus(body, 'stun') || hasStatus(body, 'freeze');
}

export function speedMult(body: Body): number {
  const slow = body.statuses.slow;
  return slow && slow.time > 0 ? Math.max(0, 1 - slow.value) : 1;
}

/** Ticks statuses; burn deals its value per second to enemies. */
export function updateStatuses(b: Battle, body: Body, dt: number): void {
  for (const key of Object.keys(body.statuses) as StatusId[]) {
    const st = body.statuses[key];
    if (!st) continue;
    if (key === 'poison' && body.team === 'hero' && st.time > 0) poisonHero(b, st.value * Math.min(dt, st.time));
    if (key === 'burn' && body.team === 'enemy' && st.time > 0) {
      const e = body as Enemy;
      if (!e.dead) {
        // Burning is fire damage.
        const burn = st.value * dt * elementMultiplier('fire', e.element);
        e.hp -= burn;
        b.stats.damageDealt += burn;
        if (e.hp <= 0) killEnemy(b, e);
      }
    }
    st.time -= dt;
    if (st.time <= 0) delete body.statuses[key];
  }
}
