import type { SkillDef, SkillParams } from '../../data/skills';
import type { Battle } from '../battle';
import type { Hero, Vec } from '../entities';

export interface SkillContext {
  b: Battle;
  hero: Hero;
  def: SkillDef;
  rank: number;
  /** Parameters of the current rank. */
  p: SkillParams;
  /** Player aim point (mouse in the arena), or null for automatic targeting. */
  aim: Vec | null;
}

/** Returns false when there is no valid target (cooldown is not spent). */
export type SkillImpl = (ctx: SkillContext) => boolean;
