// Skill tooltips with every rank: what the skill does now and what each upgrade brings.

import { RANKS } from '../data/balance';
import { describeSkill, getSkill, isSpecialRank, rankChanges, skillParams } from '../data/skills';
import { THEME } from './theme';

export interface TooltipText {
  lines: string[];
  colors: (string | undefined)[];
}

export function wrapPlain(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (`${line} ${w}`.trim().length > max && line) {
      out.push(line);
      line = w;
    } else line = `${line} ${w}`.trim();
  }
  if (line) out.push(line);
  return out;
}

const WRAP = 62;

/**
 * Tooltip for a skill at `rank` (0 = not learned yet): current effect, cooldown,
 * then every rank — taken (✓), next (▸) and later ones (dimmed).
 */
export function skillTooltip(id: string, rank: number, extra: string[] = [], cooldownMult = 1, forks?: Record<number, number>): TooltipText {
  const def = getSkill(id);
  const shown = Math.max(1, rank);
  const lines: string[] = [];
  const colors: (string | undefined)[] = [];
  const add = (text: string, color?: string): void => {
    for (const l of wrapPlain(text, WRAP)) {
      lines.push(l);
      colors.push(color);
    }
  };
  add(rank > 0 ? `${def.name} — ранг ${rank}/${RANKS.max}` : def.name, THEME.accent);
  add(describeSkill(id, shown, forks));
  add(`Перезарядка: ${((skillParams(id, shown, forks).cooldown ?? 0) * cooldownMult).toFixed(1)} с`, THEME.textDim);
  for (let r = 2; r <= RANKS.max; r++) {
    const taken = r <= rank;
    const next = r === rank + 1;
    const mark = taken ? '✓' : next ? '▸' : '·';
    // A fork: the two variants (the chosen one marked).
    const fork = def.forks?.find((f) => f.rank === r);
    if (fork) {
      add(`${mark} Ранг ${r} — на вибір:`, taken ? THEME.good : next ? '#e8c48a' : '#a8916a');
      fork.options.forEach((o, i) => {
        const chosen = taken && (forks?.[r] ?? 0) === i;
        add(`   ${chosen ? '●' : '○'} «${o.name}»: ${o.text}`, chosen ? THEME.good : taken ? THEME.textMuted : THEME.textDim);
      });
      continue;
    }
    const color = taken ? THEME.good : next ? (isSpecialRank(id, r) ? '#e8c48a' : THEME.text) : isSpecialRank(id, r) ? '#a8916a' : THEME.textMuted;
    add(`${mark} Ранг ${r}: ${rankChanges(id, r)}`, color);
  }
  for (const e of extra) add(e, THEME.textDim);
  return { lines, colors };
}
