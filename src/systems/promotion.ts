// Class promotion (levels 12 and 22): branch choice, the branch skills and the branch
// effects that run during battle (Paladin barrier, Pyromancer burn, Beastmaster wolf).

import { PROGRESSION } from '../data/balance';
import { type PromotionDef, classPromotions, getPromotion } from '../data/promotions';
import type { Battle } from './battle';
import type { Blast, Hero } from './entities';
import { addBuff } from './effects';
import { heroAttack, recomputeHeroStats } from './hero';
import { spawnCompanion } from './allies';

/** The branch of the hero, if promoted. */
export function heroPromotion(hero: Hero): PromotionDef | null {
  return hero.promotion ? getPromotion(hero.promotion) : null;
}

/** Branches the hero can choose now (its class, not promoted yet). */
export function promotionChoices(hero: Hero): PromotionDef[] {
  if (!hero.classId || hero.promotion) return [];
  return classPromotions(hero.classId);
}

/** Picks a branch: the title and colour change, the signature skill takes the R slot. */
export function promote(hero: Hero, branchId: string): void {
  const p = getPromotion(branchId);
  if (hero.classId !== p.classId) throw new Error(`Branch ${branchId} is not for ${hero.classId}`);
  if (hero.promotion) throw new Error('Already promoted');
  hero.promotion = p.id;
  hero.skills.push({ id: p.signature, rank: 1, cooldown: 0, slot: PROGRESSION.signatureSlot });
  hero.promoTimer = 0;
  hero.companionTimer = 0;
  recomputeHeroStats(hero);
}

/** Level 22: the second branch skill on F and the branch's stat bonus. */
export function promote2(hero: Hero): void {
  const p = heroPromotion(hero);
  if (!p || hero.promotion2) return;
  hero.promotion2 = true;
  if (!hero.skills.some((s) => s.id === p.signature2)) hero.skills.push({ id: p.signature2, rank: 1, cooldown: 0, slot: PROGRESSION.branchSlot2 });
  recomputeHeroStats(hero);
}

/** Called when a battle starts: the companion wolf joins at once, the barrier starts ticking. */
export function startPromotionEffects(b: Battle): void {
  const p = heroPromotion(b.hero);
  if (!p) return;
  b.hero.promoTimer = 0;
  if (p.effect.kind === 'companion') spawnCompanion(b);
}

/** Periodic branch effects in battle. */
export function updatePromotion(b: Battle, dt: number): void {
  const hero = b.hero;
  const p = heroPromotion(hero);
  if (!p || hero.dead) return;
  const fx = p.effect;
  if (fx.kind === 'aegis') {
    hero.promoTimer -= dt;
    if (hero.promoTimer <= 0) {
      hero.promoTimer = fx.interval;
      addBuff(hero, { id: 'aegis', time: fx.interval, attackSpeedMult: 1, damageTakenMult: 1, shield: hero.maxHp * fx.shield });
      b.events.emit({ type: 'skillTick', skillId: 'aegis', pos: { ...hero.pos }, radius: hero.radius + 16 });
    }
  } else if (fx.kind === 'companion') {
    if (b.allies.some((a) => a.companion && !a.dead)) return;
    hero.companionTimer -= dt;
    if (hero.companionTimer <= 0) spawnCompanion(b);
  }
}

/** Pyromancer: burn added to the hits of fire skills (and the basic bolt). */
export function igniteFor(hero: Hero, skillId: string): Pick<Blast, 'burn' | 'burnTime'> {
  const p = heroPromotion(hero);
  if (!p || p.effect.kind !== 'ignite' || !(p.effect.skills.includes(skillId) || skillId === 'bolt')) return {};
  return { burn: heroAttack(hero) * p.effect.dps, burnTime: p.effect.time };
}
