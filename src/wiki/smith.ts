// Wiki: the smith (ROADMAP 14.4) — what he does and what it costs.

import { RARITIES, RARITY_ORDER } from '../data/items';
import { SMITH } from '../data/smith';
import { type Section, esc, npcLink, table, v } from './html';

export function smithSection(): Section {
  const rows = RARITY_ORDER.map((r) => [esc(RARITIES[r].name), v(SMITH.rarityMult[r], ['SMITH', 'rarityMult', r], 'x')]);
  return {
    id: 'smith',
    title: 'Коваль',
    html: `<p>Ковалі (${SMITH.at.map(npcLink).join(', ')}) працюють з одягненими речами й розпізнаними речами з сумки:</p>
<ul>
<li><b>Перекинути характеристику</b> — ${v(SMITH.reroll, ['SMITH', 'reroll'])} зол. × рідкість × рівень предмета. Головна характеристика отримує нове значення; додаткова стає іншою характеристикою слота (не тією, що вже є на речі).</li>
<li><b>Підняти рівень речі</b> — до верху діапазону найважчої пройденої локації; ${v(SMITH.upgradePerLevel, ['SMITH', 'upgradePerLevel'])} зол. за кожен рівень × рідкість. Характеристики ростуть так само, як у речі цього рівня.</li>
<li><b>Дістати рунічний камінь</b> — ${v(SMITH.removeStone, ['SMITH', 'removeStone'])} зол. × рідкість; камінь з душею повертається в сумку. Вставити камінь можна й самому — з сумки.</li>
</ul>
${table(['Рідкість', 'Множник ціни'], rows)}`,
  };
}
