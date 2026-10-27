// Test helpers: a hero of a class with exactly these skills (bypasses the talent tree).

import type { Hero } from '../src/systems/entities';
import { recomputeHeroStats } from '../src/systems/hero';

export function withSkills(hero: Hero, classId: string, skills: string[]): void {
  hero.classId = classId;
  hero.skills = skills.map((id, slot) => ({ id, rank: 1, cooldown: 0, slot }));
  recomputeHeroStats(hero);
}
