// Wiki: items with effects (ROADMAP 14.5) — the legendaries, skill affixes and the sets.

import { CLASSES } from '../data/classes';
import { BLIND_BUYER, ITEM_SLOTS, UNIDENTIFIED_SELL_MULT } from '../data/items';
import { AFFIXES, ITEM_SETS, LEGENDARIES } from '../data/uniques';
import { type Section, esc, npcLink, t, table, v } from './html';

const slotName = (id: string): string => ITEM_SLOTS.find((s) => s.id === id)?.name ?? id;

export function uniquesSection(): Section {
  const legend = Object.values(LEGENDARIES).map((l) => [
    `<b style="color:#ff9f1c">${t(l.name, ['LEGENDARIES', l.id, 'name'])}</b>`,
    esc(slotName(l.slot)),
    esc(CLASSES[l.classId]?.name ?? l.classId),
    t(l.text, ['LEGENDARIES', l.id, 'text']),
  ]);
  const sets = Object.values(ITEM_SETS).map((s) => [
    `<b>${t(s.name, ['ITEM_SETS', s.id, 'name'])}</b>`,
    ITEM_SLOTS.map((sl) => `${esc(sl.name)}: ${t(s.pieces[sl.id], ['ITEM_SETS', s.id, 'pieces', sl.id])}`).join('<br>'),
    `${v(s.chance, ['ITEM_SETS', s.id, 'chance'], 'pct')} речей мінібосів і боса регіону`,
    `2: ${t(s.bonus2.text, ['ITEM_SETS', s.id, 'bonus2', 'text'])}<br>4: ${t(s.bonus4.text, ['ITEM_SETS', s.id, 'bonus4', 'text'])}`,
  ]);
  return {
    id: 'uniques',
    title: 'Особливі речі',
    html: `<p><b>Легендарні речі</b> мають силу, що змінює скіл класу (діє, якщо скіл вивчено). Легендарка — найчастіше (${v(AFFIXES.legendaryOwnClass, ['AFFIXES', 'legendaryOwnClass'], 'pct')}) для класу героя.</p>
${table(['Річ', 'Слот', 'Клас', 'Сила'], legend)}
<p><b>Афікси скілів</b> трапляються на звичайних (${v(AFFIXES.chance.common ?? 0, ['AFFIXES', 'chance', 'common'], 'pct')}), незвичайних (${v(AFFIXES.chance.uncommon ?? 0, ['AFFIXES', 'chance', 'uncommon'], 'pct')}), рідкісних (${v(AFFIXES.chance.rare ?? 0, ['AFFIXES', 'chance', 'rare'], 'pct')}) і епічних (${v(AFFIXES.chance.epic ?? 0, ['AFFIXES', 'chance', 'epic'], 'pct')}) речах — для скіла класу героя: «+1 до рангу» (не вище за найвищий ранг) або «−${v(AFFIXES.cooldown[0], ['AFFIXES', 'cooldown', 0], 'pct')}…${v(AFFIXES.cooldown[1], ['AFFIXES', 'cooldown', 1], 'pct')} перезарядки».</p>
<p><b>Лупа як ставка.</b> Що є в речі, видно лише після розпізнавання. Торговець дає за нерозпізнану річ ${v(UNIDENTIFIED_SELL_MULT, ['UNIDENTIFIED_SELL_MULT'], 'pct')} ціни, а скупник ${BLIND_BUYER.at.map(npcLink).join(', ')} купує нерозпізнане навмання за ${v(BLIND_BUYER.mult, ['BLIND_BUYER', 'mult'], 'pct')} — більше, але афікс чи легендарна сила, якщо були, дістануться йому.</p>
<p><b>Комплекти</b> падають з мінібосів і боса свого регіону; бонус дають 2 і 4 одягнені речі комплекту.</p>
${table(['Комплект', 'Речі', 'Звідки', 'Бонус'], sets, 'wide')}`,
  };
}
