// Souls and rune stones (ROADMAP 14.3): a killed beast may leave its soul hovering on the
// arena for a while; walking into it with an empty rune stone asks to catch it. A caught soul
// is a stone in the bag; set into an item (one per item) it gives its property, in a weapon —
// its element. Minibosses and treasure chests give empty stones now and then.

import type { GameState } from '../core/state';
import type { GiftStat } from '../data/gifts';
import type { Element } from '../data/elements';
import { RESIST_NAMES, SOULS, SOUL_RULES, type SoulDef, type SoulResist, type StoneEffect } from '../data/souls';
import type { Battle } from './battle';
import { type Enemy, type Hero, type Vec, dist } from './entities';
import type { ItemSlot } from '../data/items';
import { recomputeHeroStats } from './hero';
import { getBoss } from '../data/bosses';

export interface LooseSoul {
  id: number;
  soul: string;
  pos: Vec;
  time: number;
  dead: boolean;
}

const BY_MONSTER = new Map<string, SoulDef>();
for (const s of Object.values(SOULS)) for (const m of s.from) BY_MONSTER.set(m, s);

export function soulOf(monsterId: string): SoulDef | undefined {
  return BY_MONSTER.get(monsterId);
}

/** On a kill: a regular beast may leave its soul; a miniboss may drop an empty stone. */
export function dropSoul(b: Battle, e: Enemy): void {
  const rng = b.state.lootRng;
  if (e.boss) {
    if (getBoss(e.boss.defId).miniboss && rng.chance(SOUL_RULES.minibossStone)) giveStone(b, e.pos);
    return;
  }
  if (e.summoned) return;
  const soul = soulOf(e.defId);
  if (!soul || !rng.chance(SOUL_RULES.chance)) return;
  b.souls.push({ id: b.nextId++, soul: soul.id, pos: { ...e.pos }, time: 0, dead: false });
  b.events.emit({ type: 'soulAppear', pos: { ...e.pos }, soul: soul.id });
}

export function giveStone(b: Battle, pos: Vec): void {
  b.state.runeStones += 1;
  b.events.emit({ type: 'runeStone', pos: { ...pos } });
}

/** Souls fade; the hero walking into one catches it (with a stone) or sees it go. */
export function updateSouls(b: Battle, dt: number): void {
  if (b.souls.length === 0) return;
  const hero = b.hero;
  for (const s of b.souls) {
    s.time += dt;
    if (s.time >= SOUL_RULES.life) {
      s.dead = true;
      continue;
    }
    if (hero.dead || dist(hero.pos, s.pos) > hero.radius + SOUL_RULES.radius) continue;
    s.dead = true;
    // The first soul seen opens the wanderer's tale (the quest about the stones).
    b.state.soulSeen = true;
    if (b.state.runeStones > 0) b.state.modalQueue.push({ kind: 'soulCatch', soul: s.soul });
    else b.events.emit({ type: 'soulLost', pos: { ...s.pos }, soul: s.soul });
  }
  b.souls = b.souls.filter((s) => !s.dead);
}

/** "Yes" to the question: an empty stone holds the soul now. */
export function catchSoul(state: GameState, soul: string): boolean {
  if (state.runeStones <= 0 || !SOULS[soul]) return false;
  state.runeStones -= 1;
  state.hero.soulStones.push(soul);
  return true;
}

/** Sets the stone `index` (of the bag's stones) into the worn item of `slot`; one per item. */
export function socketStone(hero: Hero, index: number, slot: ItemSlot): boolean {
  const item = hero.equipment[slot];
  const soul = hero.soulStones[index];
  if (!item || !soul || item.stone) return false;
  item.stone = soul;
  hero.soulStones.splice(index, 1);
  recomputeHeroStats(hero);
  return true;
}

/** Stones in worn items other than the weapon: their bonus to a stat. */
export function stoneStat(hero: Hero, stat: GiftStat): number {
  let sum = 0;
  for (const [slot, item] of Object.entries(hero.equipment)) {
    if (slot === 'weapon' || !item?.stone) continue;
    const fx = SOULS[item.stone]?.effect;
    if (fx?.kind === 'stat' && fx.stat === stat) sum += fx.value;
  }
  return sum;
}

/** Resistance from the stones (0..0.8): cuts the time of slows / stuns, the damage of poison. */
export function stoneResist(hero: Hero, against: SoulResist): number {
  let sum = 0;
  for (const [slot, item] of Object.entries(hero.equipment)) {
    if (slot === 'weapon' || !item?.stone) continue;
    const fx = SOULS[item.stone]?.effect;
    if (fx?.kind === 'resist' && fx.against === against) sum += fx.value;
  }
  return Math.min(0.8, sum);
}

/** The element a stone in the weapon gives (null: none). */
export function weaponElement(hero: Hero): Element | null {
  const stone = hero.equipment.weapon?.stone;
  return stone ? (SOULS[stone]?.element ?? null) : null;
}

/** "+5% швидкості руху", "опір отруті 40%" — a stone's property in words. */
export function stoneEffectText(fx: StoneEffect): string {
  if (fx.kind === 'resist') return `опір ${RESIST_NAMES[fx.against]} ${Math.round(fx.value * 100)}%`;
  const names: Record<string, string> = {
    moveSpeedPct: 'швидкості руху',
    attackSpeedPct: 'швидкості атаки',
    hpPct: 'макс. HP',
    critChance: 'шансу криту',
    armor: 'броні',
    lifesteal: 'вампіризму',
    skillDamagePct: 'шкоди скілів',
    cooldownPct: 'швидшої перезарядки',
  };
  const pct = fx.stat !== 'armor';
  return `+${pct ? `${Math.round(fx.value * 100)}%` : fx.value} ${names[fx.stat] ?? fx.stat}`;
}
