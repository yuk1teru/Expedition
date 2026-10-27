// Wiki: souls and rune stones (ROADMAP 14.3) — every soul: whose it is, the element it gives
// a weapon, the property it gives other items; and the rules of catching.

import { ELEMENTS } from '../data/elements';
import { SOULS, SOUL_RULES } from '../data/souls';
import { stoneEffectText } from '../systems/souls';
import { type Section, esc, monsterLink, t, table, v } from './html';

export function soulsSection(): Section {
  const rows = Object.values(SOULS).map((s) => [
    `<b style="color:${s.color}">${t(s.name, ['SOULS', s.id, 'name'])}</b>`,
    s.from.map(monsterLink).join(', '),
    esc(ELEMENTS[s.element].name),
    esc(stoneEffectText(s.effect)),
  ]);
  return {
    id: 'souls',
    title: 'Душі й рунічні камені',
    html: `<p>Відколи печатка тріснула, душі звірів не йдуть у світ мертвих. З шансом ${v(SOUL_RULES.chance, ['SOUL_RULES', 'chance'], 'pct')} убитий звір лишає над собою душу — вона висить ${v(SOUL_RULES.life, ['SOUL_RULES', 'life'], 's')}, а потім розвіюється (виведені й викликані звірі душ не лишають). Торкніться душі з порожнім <b>рунічним каменем</b> у сумці — гра спитає, чи зберегти її. Перша побачена душа відкриває квест мандрівника в таверні: він дає три камені. Ще камені — у мінібосів (${v(SOUL_RULES.minibossStone, ['SOUL_RULES', 'minibossStone'], 'pct')}) і в скринях скарбу (${v(SOUL_RULES.treasureStone, ['SOUL_RULES', 'treasureStone'], 'pct')}).</p>
<p>Камінь із душею вставляється в одягнену річ (вкладка «Трофеї» в сумці → клік по каменю), <b>по одному на річ</b>. У зброї він дає атакам стихію душі — так воїн і чарівник отримують стихійну шкоду; лучник — коли стріляє звичайними стрілами. У капелюсі, броні чи черевиках — властивість душі; опори вкорочують сповільнення, коріння й оглушення чи послаблюють отруту (разом не більше 80%). Дістати камінь може лише коваль.</p>
${table(['Душа', 'Чия', 'У зброї', 'В іншій речі'], rows)}`,
  };
}
