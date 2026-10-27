// Building blocks of the wiki pages: numbers and texts with their data references
// (editable in `npm run dev`), tables, cards and links between entries. Texts may hold
// name references ({town:…}, {npc:…} — src/data/names.ts): they are shown filled in and
// edited as written.

import { BOSSES } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { fillNames } from '../data/names';
import { NPCS, NPC_LINES } from '../data/npcs';
import { TOWNS } from '../data/towns';
import { TROPHIES } from '../data/trophies';
import { WORLD_MAP, WORLD_NODES } from '../data/world';
import { nodeFromDef } from '../systems/mapgen';
import type { LiteralPath } from './literal';

export type Fmt = 'n' | 'pct' | 's' | 'px' | 'deg' | 'x';
export type Ref = [string, ...LiteralPath];

export interface Section {
  id: string;
  title: string;
  html: string;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function round(x: number, d = 2): number {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}

export function formatValue(value: number, fmt: Fmt): string {
  switch (fmt) {
    case 'pct':
      return `${round(value * 100, 1)}%`;
    case 's':
      return `${round(value)} с`;
    case 'deg':
      return `${round(value)}°`;
    case 'x':
      return `×${round(value)}`;
    default:
      return String(round(value));
  }
}

/** A number with its data reference (editable in dev). */
export function v(value: number | undefined, ref: Ref | null = null, fmt: Fmt = 'n'): string {
  if (value === undefined) return '—';
  const attrs = ref ? ` data-refs="${esc(JSON.stringify([ref]))}" data-raw="${value}" data-fmt="${fmt}"` : '';
  return `<span class="v"${attrs}>${formatValue(value, fmt)}</span>`;
}

/**
 * A text with its data reference (editable in dev), shown with names filled in. Several
 * refs: the first one that is a plain string in the data is edited (NPC lines come from
 * helper arguments). `raw` — the stored text when the shown one is built from it (skill
 * descriptions with {param}); by default the text itself, references included.
 */
export function t(text: string, refs: Ref | Ref[] | null = null, raw: string = text): string {
  const shown = esc(fillNames(text));
  if (!refs) return shown;
  const list = (Array.isArray(refs[0]) ? refs : [refs]) as Ref[];
  return `<span class="t" data-refs="${esc(JSON.stringify(list))}" data-raw="${esc(raw)}">${shown}</span>`;
}

export function table(head: string[], rows: string[][], cls = ''): string {
  return `<div class="tw"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

export function card(id: string, title: string, body: string, sub = ''): string {
  return `<div class="card" id="${id}"><h3>${title}${sub ? ` <small>${sub}</small>` : ''}</h3>${body}</div>`;
}

export const anchor = (kind: string, id: string): string => `${kind}-${id}`;
export const link = (kind: string, id: string, text: string): string => `<a href="#${anchor(kind, id)}">${esc(fillNames(text))}</a>`;

export function monsterLink(id: string): string {
  if (ENEMIES[id]) return link('enemy', id, ENEMIES[id].name);
  if (BOSSES[id]) return link('boss', id, BOSSES[id].name);
  return esc(id);
}

export const NODES = WORLD_NODES.map(nodeFromDef);

/** Link to a location or a town (towns lead to their card). */
export function nodeLink(id: string): string {
  const n = NODES.find((x) => x.id === id);
  if (!n) return esc(id);
  return link(n.isTown && TOWNS[id] ? 'town' : 'loc', id, n.name);
}

export function npcLink(id: string): string {
  const npc = NPCS[id];
  return npc ? link('npc', id, npc.name) : esc(id);
}

export function trophyLink(id: string): string {
  const tr = TROPHIES[id];
  return tr ? link('trophy', id, tr.name) : esc(id);
}

/** The town an NPC lives in (by the town layouts), or null. */
export function npcTown(id: string): string | null {
  for (const town of Object.values(TOWNS)) if (town.npcs.some((n) => n.id === id)) return town.id;
  return null;
}

export function regionName(id: string): string {
  return WORLD_MAP.regions.find((r) => r.id === id)?.name ?? id;
}

/** Ref of a shared NPC line (`NPC_LINES`) with this text, if any. */
export function sharedLine(text: string): Ref[] {
  const key = Object.entries(NPC_LINES).find(([, line]) => line === text)?.[0];
  return key ? [['NPC_LINES', key]] : [];
}

/** Locations where a monster appears (waves, miniboss or boss). */
export function whereFound(id: string): string {
  const at = NODES.filter((n) => !n.isTown && (n.enemies.includes(id) || n.miniboss === id || n.boss === id));
  return at.length ? at.map((n) => link('loc', n.id, n.name)).join(', ') : '—';
}

/** Case forms of a name, each editable: «Відмінки: Ізяслава · Ізяславі». */
export function formsLine(forms: Partial<Record<string, string>> | undefined, ref: Ref): string {
  if (!forms) return '';
  const labels: Record<string, string> = { of: 'кого/чого', to: 'кому/чому', in: 'у кому/чому', acc: 'кого/що', with: 'ким/чим' };
  const items = Object.entries(forms)
    .filter((e): e is [string, string] => typeof e[1] === 'string')
    .map(([k, f]) => `<span class="dim">${labels[k] ?? k}:</span> ${t(f, [...ref, k] as Ref)}`);
  return items.length ? `<div class="small forms">Відмінки — ${items.join(' · ')}</div>` : '';
}
