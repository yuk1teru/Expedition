// Wiki: the Endless tower (ROADMAP 18) — floors, bosses, modifiers, records.

import { BOSSES } from '../data/bosses';
import { TOWER } from '../data/tower';
import { type Section, esc, t, table, v } from './html';

export function towerSection(): Section {
  const bosses = [...TOWER.bosses.map((id, i) => [`${(i + 1) * TOWER.bossEvery}`, t(BOSSES[id]?.name ?? id)]), [`${TOWER.floors}`, t(BOSSES[TOWER.finalBoss]?.name ?? TOWER.finalBoss)]];
  const mods = Object.entries(TOWER.modifiers).map(([id, m]) => [
    esc(m.name),
    [m.hp ? `HP ×${v(m.hp, ['TOWER', 'modifiers', id, 'hp'])}` : '', m.damage ? `шкода ×${v(m.damage, ['TOWER', 'modifiers', id, 'damage'])}` : '', m.speed ? `швидкість ×${v(m.speed, ['TOWER', 'modifiers', id, 'speed'])}` : ''].filter(Boolean).join(', '),
  ]);
  return {
    id: 'tower',
    title: 'Нескінченна вежа',
    html: `<p>Вежа виростає над столицею після облоги. Сходження починається з поверху після останнього переможеного боса вежі й іде поверх за поверхом: звірі країв по черзі (${TOWER.lands.length} краї), на арені свого краю, ${v(TOWER.waves, ['TOWER', 'waves'])} хвилі. Рівень поверху — ${v(TOWER.level0, ['TOWER', 'level0'])} + ${v(TOWER.levelPerFloor, ['TOWER', 'levelPerFloor'])} × поверх. HP між поверхами не відновлюється; після кожного — «вище» чи «в місто». Поверх дає ${v(TOWER.goldPerFloor, ['TOWER', 'goldPerFloor'])} зол. × поверх.</p>
<p>Кожен ${v(TOWER.bossEvery, ['TOWER', 'bossEvery'])}-й поверх — бос із модифікаторами: один, і ще один кожні ${v(TOWER.modifierEvery, ['TOWER', 'modifierEvery'])} поверхів. Переможений бос вежі — нова точка старту й рідкісний дар. На ${TOWER.floors}-му чекає ${t('{name:lord}')} — справжній фінал. Найвищий поверх кожного героя записується на його надгробку й у рекордах; ті, хто дійшов до ${TOWER.floors}-го, — у залі слави.</p>
${table(['Поверх', 'Бос'], bosses)}
${table(['Модифікатор', 'Дія'], mods)}`,
  };
}
