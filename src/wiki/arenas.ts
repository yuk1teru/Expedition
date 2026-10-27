// Wiki: arenas (ROADMAP 13.1) — size, obstacles and terrain of every location's battlefield;
// the trip through a location's arenas (13.2).

import { ARENAS, TERRAIN } from '../data/arenas';
import { EXPEDITION, STEP_INFO, type ArenaStepKind } from '../data/expedition';
import { OBJECTIVES, OBJECTIVE_INFO } from '../data/objectives';
import { type Section, esc, nodeLink, t, table, v } from './html';

const OBSTACLE_NAMES: Record<string, string> = { tree: 'дерев', rock: 'каменів', stump: 'пнів', pillar: 'колон' };
const TERRAIN_NAMES: Record<string, string> = { water: 'вода', thorns: 'колючки', grass: 'висока трава' };

export function arenasSection(): Section {
  const rows = Object.values(ARENAS).map((a) => {
    const counts = new Map<string, number>();
    for (const o of a.obstacles) counts.set(o.kind, (counts.get(o.kind) ?? 0) + 1);
    const obstacles = [...counts].map(([k, n]) => `${n} ${esc(OBSTACLE_NAMES[k] ?? k)}`).join(', ') || '—';
    const terrain = [...new Set(a.terrain.map((x) => TERRAIN_NAMES[x.kind] ?? x.kind))].map(esc).join(', ') || '—';
    return [nodeLink(a.id), `${a.w}×${a.h}`, obstacles, terrain, t(a.note, ['ARENAS', a.id, 'note'])];
  });
  const steps = (Object.keys(STEP_INFO) as ArenaStepKind[]).map((k) => [
    esc(STEP_INFO[k].name),
    k === 'boss' ? 'бій з босом' : v(EXPEDITION.waves[k], ['EXPEDITION', 'waves', k]),
    t(STEP_INFO[k].text, ['STEP_INFO', k, 'text']),
  ]);
  const fork = EXPEDITION.forkKinds.map((k) => esc(STEP_INFO[k].name)).join(' / ');
  return {
    id: 'arenas',
    title: 'Арени',
    html: `<h3>Похід у локацію</h3>
<p>Локація — це кілька арен поспіль: <b>вхід</b>, потім <b>розвилка</b> з двох (${fork}), потім <b>лігво</b> з мінібосом. Короткі локації (перехідні зони, дорога прологу) — лише вхід і лігво; лігво боса — передпокій і сам бос. Між аренами HP не відновлюється (лише зілля), хвилі ростуть далі, а повернутися на карту можна будь-коли — але локацію тоді не пройдено. Вівтар дає дар лише раз на локацію; скриня скарбу — ${v(EXPEDITION.treasureGold, ['EXPEDITION', 'treasureGold'], 'x')} бонусу за зачистку золотом і річ, зате її засідка більша (${v(EXPEDITION.treasureWaveMult, ['EXPEDITION', 'treasureWaveMult'], 'x')} ворогів); скриня лігва — ${v(EXPEDITION.lairGold, ['EXPEDITION', 'lairGold'], 'x')} бонусу.</p>
${table(['Арена', 'Хвиль', 'Опис'], steps)}
<p><b>Завдання</b> — арена без хвиль, зі своєю ціллю; її звірі сильні, як наступна хвиля локації, а перемога дає ${v(OBJECTIVES.gold, ['OBJECTIVES', 'gold'], 'x')} бонусу за зачистку золотом.</p>
${table(['Завдання', 'Ціль', 'Як це працює'], [
  [esc(OBJECTIVE_INFO.nests.name), t(OBJECTIVE_INFO.nests.text, ['OBJECTIVE_INFO', 'nests', 'text']), `${v(OBJECTIVES.nests.count, ['OBJECTIVES', 'nests', 'count'])} гнізда (HP ${v(OBJECTIVES.nests.hp, ['OBJECTIVES', 'nests', 'hp'])} на 1-му рівні загрози, росте як у звірів) кожні ${v(OBJECTIVES.nests.hatchEvery, ['OBJECTIVES', 'nests', 'hatchEvery'], 's')} виводять звіра — поки живих менше за ${v(OBJECTIVES.nests.maxAlive, ['OBJECTIVES', 'nests', 'maxAlive'])}. Виведені дають ${v(OBJECTIVES.nests.hatchXp, ['OBJECTIVES', 'nests', 'hatchXp'], 'pct')} досвіду й без золота. Перемога — гнізда зруйновано й звірів добито.`],
  [esc(OBJECTIVE_INFO.rescue.name), t(OBJECTIVE_INFO.rescue.text, ['OBJECTIVE_INFO', 'rescue', 'text']), `Стійте в колі ${v(OBJECTIVES.rescue.radius, ['OBJECTIVES', 'rescue', 'radius'], 'px')} навколо полоненого разом ${v(OBJECTIVES.rescue.time, ['OBJECTIVES', 'rescue', 'time'], 's')}; поза колом звільнення стоїть. Кожні ${v(OBJECTIVES.rescue.groupEvery, ['OBJECTIVES', 'rescue', 'groupEvery'], 's')} з краю приходять ${v(OBJECTIVES.rescue.groupSize, ['OBJECTIVES', 'rescue', 'groupSize'])} звірі (поки живих менше за ${v(OBJECTIVES.rescue.maxAlive, ['OBJECTIVES', 'rescue', 'maxAlive'])}).`],
])}
<h3>Поля бою</h3>
<p>Поле бою локації: розмір (більша за екран арена прокручується за героєм), перешкоди, що зупиняють і тіла, і снаряди, та рельєф. Вода сповільнює всіх на ${v(TERRAIN.waterSlow, ['TERRAIN', 'waterSlow'], 'pct')}; колючки забирають у героя ${v(TERRAIN.thornsDps, ['TERRAIN', 'thornsDps'], 'pct')} макс. HP за секунду; у високій траві стрільці бачать героя лише ближче за ${v(TERRAIN.grassSight, ['TERRAIN', 'grassSight'])} px і підходять замість стрільби. Локації без своєї арени б’ються на рівному полі розміром з екран.</p>
${table(['Локація', 'Розмір', 'Перешкоди', 'Рельєф', 'Особливість'], rows, 'wide')}`,
  };
}
