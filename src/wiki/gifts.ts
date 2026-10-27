// Wiki: gifts (ROADMAP 12.8) — every gift with its rarity and what it does, the sources and
// the skill tags.

import { ELEMENTS } from '../data/elements';
import { GIFTS, GIFT_RARITY_NAMES, GIFT_RULES, type GiftDef, type GiftEffect, type GiftRarity, SKILL_TAGS, TAG_NAMES } from '../data/gifts';
import { SKILLS } from '../data/skills';
import { type Ref, type Section, esc, link, t, table, v } from './html';

const STAT_NAMES: Record<string, string> = {
  attackSpeedPct: 'швидкість атаки',
  hpPct: 'макс. HP',
  critChance: 'шанс криту',
  armor: 'броня',
  lifesteal: 'вампіризм',
  moveSpeedPct: 'швидкість руху',
  cooldownPct: 'перезарядка (менше)',
  skillDamagePct: 'шкода скілів',
};
const STATUS_NAMES: Record<string, string> = { stun: 'оглушених', freeze: 'заморожених', burn: 'палаючих', slow: 'сповільнених' };

function effectText(g: GiftDef, e: GiftEffect, i: number): string {
  const R: Ref = ['GIFTS', g.id, 'effects', i, 'value'];
  switch (e.kind) {
    case 'stat':
      return `${esc(STAT_NAMES[e.stat] ?? e.stat)} ${v(e.value, R, e.stat === 'armor' ? 'n' : 'pct')}`;
    case 'tag':
      return `шкода скілів «${esc(TAG_NAMES[e.tag])}» +${v(e.value, R, 'pct')}`;
    case 'element':
      return `шкода ${e.element === 'any' ? 'усіх стихій' : esc(ELEMENTS[e.element].name)} +${v(e.value, R, 'pct')}`;
    case 'status':
      return `шкода по ${esc(STATUS_NAMES[e.status] ?? e.status)} +${v(e.value, R, 'pct')}`;
    case 'skill':
      return `${link('skill', e.skill, SKILLS[e.skill]?.name ?? e.skill)}: <code>${esc(e.param)}</code> = ${v(e.value, R)} з 1-го рангу`;
  }
}

export function giftsSection(): Section {
  const order: GiftRarity[] = ['common', 'rare', 'legendary'];
  const groups = order
    .map((r) => {
      const rows = Object.values(GIFTS)
        .filter((g) => g.rarity === r)
        .map((g) => [
          `<b>${t(g.name, ['GIFTS', g.id, 'name'])}</b>${g.cursed ? ' <span class="small" style="color:#e5534b">проклятий</span>' : ''}<div class="dim small">${t(g.text, ['GIFTS', g.id, 'text'])}</div>`,
          g.effects.map((e, i) => effectText(g, e, i)).join('<br>'),
        ]);
      return `<h3 class="group">${esc(GIFT_RARITY_NAMES[r])} <small class="dim">(${rows.length})</small></h3>${table(['Дар', 'Що робить'], rows, 'wide')}`;
    })
    .join('');
  const tags = Object.entries(SKILL_TAGS).map(([id, ts]) => [link('skill', id, SKILLS[id]?.name ?? id), ts.map((x) => esc(TAG_NAMES[x])).join(', ')]);
  return {
    id: 'gifts',
    title: 'Дари',
    html: `<p>Дар — постійний бонус: з’являється вікно з ${v(GIFT_RULES.offerSize, ['GIFT_RULES', 'offerSize'])} варіантів, герой бере один до кінця гри. Варіанти можна перекинути за золото або пропустити вибір (золото й короткий баф). Смерть дарів не забирає.</p>
<ul>
<li>Кожен ${v(GIFT_RULES.levelEvery, ['GIFT_RULES', 'levelEvery'])}-й рівень — звичайний дар (з шансом ${v(GIFT_RULES.levelRareChance, ['GIFT_RULES', 'levelRareChance'], 'pct')} — рідкісний).</li>
<li>Бос — легендарний.</li>
<li>Перша перемога над мінібосом локації — рідкісний з шансом ${v(GIFT_RULES.minibossChance, ['GIFT_RULES', 'minibossChance'], 'pct')}.</li>
<li>Деякі квести; вівтарі в локаціях — етап 13.</li>
</ul>
<p class="dim small">Рідкісні дари з певним скілом пропонуються лише тому, хто цей скіл уже вивчив. Проклятий дар трапляється з шансом ${v(GIFT_RULES.cursedChance, ['GIFT_RULES', 'cursedChance'], 'pct')}, не більше одного у вікні.</p>
${groups}
<h3 class="group">Мітки скілів</h3>
${table(['Скіл', 'Мітки'], tags)}`,
  };
}
