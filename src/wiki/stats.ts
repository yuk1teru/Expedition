// Dev wiki: battle statistics (ROADMAP 9.7). The records of this browser's game (the meta
// save in localStorage) plus statistics files sent by friends, summed up by location.

import { WORLD_NODES } from '../data/world';
import { type BattleRecord, summarize } from '../systems/battleLog';
import { readMeta } from '../systems/meta';
import { esc } from './html';

const META_KEY = 'expedition.meta';

function localBattles(): BattleRecord[] {
  try {
    return readMeta(window.localStorage.getItem(META_KEY)).battles;
  } catch {
    return [];
  }
}

/** Battles from a friend's statistics file (null — not such a file). */
function fileBattles(text: string): BattleRecord[] | null {
  try {
    const raw = JSON.parse(text) as { kind?: string; battles?: unknown };
    if (raw.kind !== 'expedition-stats' || !Array.isArray(raw.battles)) return null;
    return raw.battles.filter((r): r is BattleRecord => typeof r === 'object' && r !== null && typeof (r as BattleRecord).node === 'string');
  } catch {
    return null;
  }
}

const CAUSE_NAMES: Record<string, string> = { melee: 'удар', shot: 'постріл', telegraph: 'удар з попередженням', hazard: 'калюжа / кільце', trap: 'капкан', poison: 'отрута' };

function render(root: HTMLElement, log: BattleRecord[], files: string[]): void {
  const order = new Map(WORLD_NODES.map((n, i) => [n.id, i]));
  const name = (id: string): string => WORLD_NODES.find((n) => n.id === id)?.name ?? id;
  const rows = summarize(log).sort((a, b) => (order.get(a.node) ?? 999) - (order.get(b.node) ?? 999));
  const pct = (n: number, d: number): string => (d ? `${Math.round((100 * n) / d)}%` : '—');
  const causes = new Map<string, number>();
  for (const r of log) if (!r.won) causes.set(r.cause?.kind ?? 'unknown', (causes.get(r.cause?.kind ?? 'unknown') ?? 0) + 1);
  root.innerHTML = `<p>Боїв: <b>${log.length}</b> (ця гра${files.length ? ` + файли: ${files.map(esc).join(', ')}` : ''}). Друзі експортують файл у головному меню гри («Статистика боїв»).</p>
<p><label class="small">Додати файли статистики друзів: <input id="stats-files" type="file" accept=".json" multiple /></label></p>
${
  rows.length === 0
    ? '<p class="dim">Записів ще немає: зіграй кілька боїв.</p>'
    : `<div class="tw"><table class="wide"><thead><tr><th>Локація</th><th>Боїв</th><th>Перемог</th><th>Смертей</th><th>Сер. час, с</th><th>Сер. отримана шкода</th><th>Сер. зілля</th><th>Сер. рівень</th></tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr><td>${esc(name(r.node))}</td><td>${r.battles}</td><td>${pct(r.wins, r.battles)}</td><td>${r.deaths}</td><td>${r.avgTime.toFixed(1)}</td><td>${Math.round(r.avgDamageTaken)}</td><td>${r.avgHeals.toFixed(1)}</td><td>${r.avgLevel.toFixed(1)}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
}
${causes.size ? `<p class="small">Причини смертей: ${[...causes.entries()].map(([k, n]) => `${esc(CAUSE_NAMES[k] ?? 'невідомо')} — ${n}`).join(' · ')}</p>` : ''}`;
  const input = root.querySelector<HTMLInputElement>('#stats-files')!;
  input.addEventListener('change', async () => {
    const added: BattleRecord[] = [];
    const names: string[] = [];
    for (const f of Array.from(input.files ?? [])) {
      const b = fileBattles(await f.text());
      if (b) {
        added.push(...b);
        names.push(f.name);
      }
    }
    render(root, [...log, ...added], [...files, ...names]);
  });
}

export function mountStats(root: HTMLElement): void {
  render(root, localBattles(), []);
}
