// Wiki: alchemy (ROADMAP 14.2) — every recipe: who brews it, the parts, the gold, what it gives.

import { RECIPES } from '../data/alchemy';
import { QUESTS } from '../data/quests';
import { type Ref, type Section, link, npcLink, t, table, trophyLink, v } from './html';

const STAT_NAMES: Record<string, string> = {
  attackSpeedPct: 'швидкість атаки',
  hpPct: 'макс. HP',
  skillDamagePct: 'шкода скілів',
  moveSpeedPct: 'швидкість руху',
  critChance: 'шанс криту',
  armor: 'броня',
  lifesteal: 'вампіризм',
  cooldownPct: 'перезарядка',
};

export function alchemySection(): Section {
  const rows = RECIPES.map((r, i) => {
    const R = (...p: (string | number)[]): Ref => ['RECIPES', i, ...p];
    const res = r.result;
    const gives =
      res.kind === 'consumable'
        ? 'зілля в сумку'
        : res.kind === 'life'
          ? '+1 життя'
          : `+${v(res.value, R('result', 'value'), 'pct')} ${STAT_NAMES[res.stat] ?? res.stat} на ${v(res.arenas, R('result', 'arenas'))} арен`;
    return [
      `<b>${t(r.name, R('name'))}</b><div class="dim small">${t(r.text, R('text'))}</div>`,
      r.at.map(npcLink).join(', '),
      r.needs.map((n, k) => `${trophyLink(n.trophy)} × ${v(n.count, R('needs', k, 'count'))}`).join('<br>'),
      v(r.gold, R('gold')),
      gives + (r.quest ? `<div class="small dim">після квесту ${QUESTS[r.quest] ? link('quest', r.quest, QUESTS[r.quest]!.name) : r.quest}</div>` : ''),
    ];
  });
  return {
    id: 'alchemy',
    title: 'Алхімія',
    html: `<p>Травниці варять із трофеїв зілля й еліксири, лікарка — Еліксир повернення (рецепт відкриває її квест). Еліксир випивається одразу й діє кілька арен (кожна арена — і перехід — мінус одна); одночасно діє лише один, новий замінює старий.</p>
${table(['Рецепт', 'Хто варить', 'Частини', 'Золото', 'Дає'], rows, 'wide')}`,
  };
}
