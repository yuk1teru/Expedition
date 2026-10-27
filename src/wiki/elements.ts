// Wiki: elements (ROADMAP 12.2) — the damage table, the level and shell rules, the defence
// of every enemy and boss, the element of every skill.

import { BOSSES } from '../data/bosses';
import { ELEMENTS, ELEMENT_LEVEL_STEP, ELEMENT_MAX, ELEMENT_ORDER, ELEMENT_TABLE, ENEMY_ELEMENTS, type Element } from '../data/elements';
import { ENEMIES } from '../data/enemies';
import { SKILLS } from '../data/skills';
import { type Section, esc, link, monsterLink, t, table, v } from './html';

/** An element name in its colour. */
export function elementTag(e: Element | 'arrows'): string {
  if (e === 'arrows') return '<span class="small">стихія стріл</span>';
  const d = ELEMENTS[e];
  return `<span style="color:${d.color}">${esc(d.name)}</span>`;
}

export function elementsSection(): Section {
  const head = ['Атака ↓ / Захист →', ...ELEMENT_ORDER.map((d) => elementTag(d))];
  const rows = ELEMENT_ORDER.map((a) => [
    `<b>${t(ELEMENTS[a].name, ['ELEMENTS', a, 'name'])}</b>`,
    ...ELEMENT_ORDER.map((d) => {
      const m = ELEMENT_TABLE[a][d];
      const cls = m > 1 ? 'good' : m < 1 ? 'dim' : '';
      return `<span class="${cls}">${v(m, ['ELEMENT_TABLE', a, d], 'pct')}</span>`;
    }),
  ]);
  const ids = Object.keys(ENEMY_ELEMENTS);
  const profiles = ids.map((id) => {
    const p = ENEMY_ELEMENTS[id]!;
    const strong = ELEMENT_ORDER.filter((a) => a !== 'neutral' && ELEMENT_TABLE[a][p.type] > 1).map(elementTag).join(', ') || '—';
    return [
      ENEMIES[id] || BOSSES[id] ? monsterLink(id) : esc(id),
      `${elementTag(p.type)} ${v(p.level, ['ENEMY_ELEMENTS', id, 'level'])}`,
      p.shell !== undefined ? `панцир: нейтральна шкода ${v(p.shell, ['ENEMY_ELEMENTS', id, 'shell'], 'pct')}` : '—',
      strong,
    ];
  });
  const skills = Object.values(SKILLS)
    .filter((s) => s.element && s.element !== 'neutral')
    .map((s) => [link('skill', s.id, s.name), elementTag(s.element!)]);
  return {
    id: 'elements',
    title: 'Стихії',
    html: `<p>Кожна атака має стихію, кожен ворог — стихію захисту рівня 1–3. Шкода множиться за таблицею (захист рівня 1). Кожен рівень захисту понад 1 підсилює слабкість на +${v(ELEMENT_LEVEL_STEP, ['ELEMENT_LEVEL_STEP'], 'pct')} і опір на стільки ж (не нижче 0, не вище ${v(ELEMENT_MAX, ['ELEMENT_MAX'], 'pct')}). Нейтральна шкода — завжди 100%, крім панцирних ворогів: панцир пропускає лише частину нейтральної шкоди, а стихії — повністю. Підпал — це шкода Вогнем.</p>
<p class="dim small">Коло стихій: Вода б’є Вогонь, Вогонь — Землю, Земля — Вітер, Вітер — Воду (і лід). Святе й Темрява — одне проти одного. У бою удар по слабкості — помаранчеве число, по опору — сіре.</p>
${table(head, rows, 'wide')}
<h3 class="group">Захист ворогів і босів</h3>
<p class="dim small">Вороги, яких тут немає, — нейтральні рівня 1 без панцира.</p>
${table(['Хто', 'Захист', 'Панцир', 'Що добре б’є'], profiles, 'wide')}
<h3 class="group">Стихії скілів</h3>
<p class="dim small">Решта скілів — нейтральні. Скіли зі стрілами беруть стихію стріл лучника.</p>
${table(['Скіл', 'Стихія'], skills)}`,
  };
}
