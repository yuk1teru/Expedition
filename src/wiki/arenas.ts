// Wiki: arenas (ROADMAP 13.1) — size, obstacles and terrain of every location's battlefield.

import { ARENAS, TERRAIN } from '../data/arenas';
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
  return {
    id: 'arenas',
    title: 'Арени',
    html: `<p>Поле бою локації: розмір (більша за екран арена прокручується за героєм), перешкоди, що зупиняють і тіла, і снаряди, та рельєф. Вода сповільнює всіх на ${v(TERRAIN.waterSlow, ['TERRAIN', 'waterSlow'], 'pct')}; колючки забирають у героя ${v(TERRAIN.thornsDps, ['TERRAIN', 'thornsDps'], 'pct')} макс. HP за секунду; у високій траві стрільці бачать героя лише ближче за ${v(TERRAIN.grassSight, ['TERRAIN', 'grassSight'])} px і підходять замість стрільби. Локації без своєї арени б’ються на рівному полі розміром з екран.</p>
${table(['Локація', 'Розмір', 'Перешкоди', 'Рельєф', 'Особливість'], rows, 'wide')}`,
  };
}
