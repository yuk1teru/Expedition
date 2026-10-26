// Skill registry (skillId → implementation) and manual skill use.

import { getSkill, skillParams } from '../../data/skills';
import type { Battle } from '../battle';
import { hasStatus, isDisabled } from '../combat';
import { skillInSlot } from '../hero';
import type { SkillImpl } from './types';
import { WARRIOR_SKILLS } from './warrior';

export const SKILL_IMPLS: Record<string, SkillImpl> = {
  ...WARRIOR_SKILLS,
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
  const ok = impl({ b, hero, def, rank: s.rank, p, aim: def.aimable ? b.input.aim : null });
  if (!ok) {
    b.events.emit({ type: 'noTarget', slot });
    return 'noTarget';
  }
  s.cooldown = (p.cooldown ?? 0) * hero.stats.cooldownMult;
  return 'cast';
}

/** Cooldown of a slot's skill at its current rank (for UI). */
export function slotCooldown(b: Battle, slot: number): number {
  const s = skillInSlot(b.hero, slot);
  if (!s) return 0;
  return (skillParams(s.id, s.rank).cooldown ?? 0) * b.hero.stats.cooldownMult;
}
