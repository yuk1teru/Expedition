// Skill registry (skillId → implementation) and manual skill use.

import { ARENA } from '../../data/balance';
import { BOOT_DASH_SPEED } from '../../data/items';
import { getSkill, skillParams } from '../../data/skills';
import { normalize } from '../entities';
import { startDash } from '../effects';
import { bootDash } from '../items';
import type { Battle } from '../battle';
import { hasStatus, isDisabled } from '../combat';
import { skillElement, skillInSlot } from '../hero';
import type { SkillImpl } from './types';
import { ARCHER_SKILLS } from './archer';
import { MAGE_SKILLS } from './mage';
import { WARRIOR_SKILLS } from './warrior';
import { PROMOTION_SKILLS } from './promotion';
import { skillAim } from './common';

export { skillAim };

export const SKILL_IMPLS: Record<string, SkillImpl> = {
  ...WARRIOR_SKILLS,
  ...MAGE_SKILLS,
  ...ARCHER_SKILLS,
  ...PROMOTION_SKILLS,
};

export type SkillUseResult = 'cast' | 'cooldown' | 'noTarget' | 'busy' | 'empty';

/** Uses the skill in a slot (0-based). A skill without a target does not spend its cooldown. */
export function useSkill(b: Battle, slot: number): SkillUseResult {
  const hero = b.hero;
  const s = skillInSlot(hero, slot);
  if (!s) return 'empty';
  if (b.outcome !== 'running' || hero.dead || hero.dash || isDisabled(hero)) return 'busy';
  if (s.cooldown > 0) return 'cooldown';
  const impl = SKILL_IMPLS[s.id];
  if (!impl) throw new Error(`No implementation for skill ${s.id}`);
  const p = skillParams(s.id, s.rank);
  const def = getSkill(s.id);
  if (def.moves && hasStatus(hero, 'root')) {
    b.events.emit({ type: 'noTarget', slot, reason: 'rooted' });
    return 'busy';
  }
  // Everything the skill creates while being cast takes its element (ROADMAP 12.2).
  b.castElement = skillElement(hero, def);
  const ok = impl({ b, hero, def, rank: s.rank, p, aim: def.aimable ? skillAim(b) : null });
  b.castElement = null;
  if (!ok) {
    b.events.emit({ type: 'noTarget', slot });
    return 'noTarget';
  }
  s.cooldown = (p.cooldown ?? 0) * hero.stats.cooldownMult;
  return 'cast';
}


/** Shift: a short dash in the direction of movement from the worn boots (uncommon and better). */
export function useBootDash(b: Battle): 'cast' | 'cooldown' | 'busy' | 'none' {
  const hero = b.hero;
  const dash = bootDash(hero);
  if (!dash) return 'none';
  if (b.outcome !== 'running' || hero.dead || hero.dash || isDisabled(hero) || hasStatus(hero, 'root')) return 'busy';
  if (hero.dodgeCooldown > 0) return 'cooldown';
  // Where the hero runs (WASD); standing still — where it faces.
  let dir = normalize(b.input.move);
  if (dir.x === 0 && dir.y === 0) dir = { x: Math.cos(hero.facing), y: Math.sin(hero.facing) };
  const r = hero.radius;
  const to = {
    x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, hero.pos.x + dir.x * dash.distance)),
    y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, hero.pos.y + dir.y * dash.distance)),
  };
  const from = { ...hero.pos };
  const facing = hero.facing;
  startDash(hero, to, BOOT_DASH_SPEED, null);
  // A sidestep, not a turn: keep attacking where the player aims.
  hero.facing = facing;
  hero.dodgeCooldown = dash.cooldown;
  b.events.emit({ type: 'heroDodge', from, to: { ...to } });
  return 'cast';
}

/** Cooldown of a slot's skill at its current rank (for UI). */
export function slotCooldown(b: Battle, slot: number): number {
  const s = skillInSlot(b.hero, slot);
  if (!s) return 0;
  return (skillParams(s.id, s.rank).cooldown ?? 0) * b.hero.stats.cooldownMult;
}
