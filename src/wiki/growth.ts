// Wiki: town growth (ROADMAP 15.4) — the levels of each town, what they give and cost.

import { TOWN_GROWTH } from '../data/growth';
import { type Section, nodeLink, npcLink, t, table, v } from './html';

export function growthSection(): Section {
  const parts = Object.entries(TOWN_GROWTH).map(([town, g]) => {
    const rows = g.levels.map((l, i) => [
      `<b>${t(l.name, ['TOWN_GROWTH', town, 'levels', i, 'name'])}</b>`,
      v(l.cost, ['TOWN_GROWTH', town, 'levels', i, 'cost']),
      t(l.text, ['TOWN_GROWTH', town, 'levels', i, 'text']),
    ]);
    return `<h3>${nodeLink(town)}</h3><p>Золото приймає ${npcLink(g.steward)}.</p>${table(['Рівень', 'Ціна', 'Що дає'], rows)}`;
  });
  return {
    id: 'growth',
    title: 'Розвиток міст',
    html: `<p>Золото, вкладене в місто, піднімає його рівень: місто захищеніше від навали, дешевше торгує, отримує нові сервіси — і видимо росте. Вкладене — частина контрольної точки (як і золото).</p>${parts.join('')}`,
  };
}
