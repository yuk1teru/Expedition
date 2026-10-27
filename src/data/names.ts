// Names in texts are references, so a rename in the wiki changes them everywhere:
//   {town:capital}  {loc:quietGrove}  {region:forest}  {npc:capitalGuard}
//   {enemy:wolf}  {boss:enat}  {trophy:wolfPelt}  {name:kingdom}
// An optional case form follows the id: {town:capital:in} → «Ізяславі». Forms live next to
// the name in the data (`forms`); a missing form falls back to the name itself.

import { BOSSES } from './bosses';
import { ENEMIES } from './enemies';
import { NPCS } from './npcs';
import { TROPHIES } from './trophies';
import { WORLD_MAP, WORLD_NODES } from './world';

/** Case forms of a name: of — родовий (кого? чого?), to — давальний (кому?), in — місцевий (у кому? у чому?), acc — знахідний (кого? що?), with — орудний (ким? чим?). */
export type NameForm = 'of' | 'to' | 'in' | 'acc' | 'with';
export type NameForms = Partial<Record<NameForm, string>>;

/** Names of the world's lore (the kingdom, the world of the dead, the Dark Lord…) with their forms. */
export const LORE_NAMES: Record<string, { name: string; forms?: NameForms }> = {
  kingdom: { name: 'Обереж', forms: { of: 'Обережу', in: 'Обережі', with: 'Обережем' } },
  dead: { name: 'Нав', forms: { of: 'Наві', in: 'Наві', to: 'Наві' } },
  lord: { name: 'Морок', forms: { of: 'Морока', acc: 'Морока', with: 'Мороком', to: 'Морокові' } },
  goddess: { name: 'Берегиня', forms: { of: 'Берегині', to: 'Берегині', acc: 'Берегиню' } },
  church: { name: 'Собор {name:goddess:of}', forms: { of: 'Собору {name:goddess:of}', in: 'Соборі {name:goddess:of}', to: 'Собору {name:goddess:of}' } },
};

export type NameKind = 'town' | 'loc' | 'region' | 'npc' | 'enemy' | 'boss' | 'trophy' | 'name';

const PLACEHOLDER = /\{(town|loc|region|npc|enemy|boss|trophy|name):(\w+)(?::(of|to|in|acc|with))?\}/g;

function pick(entry: { name: string; forms?: NameForms } | undefined, form: NameForm | undefined): string | null {
  if (!entry) return null;
  return (form && entry.forms?.[form]) || entry.name;
}

/** The current name (or its case form) of an entity, or null if it does not exist. */
export function resolveName(kind: NameKind, id: string, form?: NameForm, depth = 0): string | null {
  const raw = rawName(kind, id, form);
  if (raw === null || depth > 3) return raw;
  // Names may refer to other names («Стара монета {name:kingdom:of}»).
  return raw.replace(PLACEHOLDER, (m, k: NameKind, i: string, f?: NameForm) => resolveName(k, i, f, depth + 1) ?? m);
}

function rawName(kind: NameKind, id: string, form?: NameForm): string | null {
  switch (kind) {
    case 'town':
    case 'loc':
      return pick(WORLD_NODES.find((n) => n.id === id), form);
    case 'region':
      return WORLD_MAP.regions.find((r) => r.id === id)?.name ?? null;
    case 'npc':
      return pick(NPCS[id], form);
    case 'enemy':
      return ENEMIES[id]?.name ?? null;
    case 'boss':
      return pick(BOSSES[id], form);
    case 'trophy':
      return TROPHIES[id]?.name ?? null;
    case 'name':
      return pick(LORE_NAMES[id], form);
  }
}

/** Text with every placeholder replaced by the current name; unknown ones stay as they are. */
export function fillNames(text: string): string {
  return text.replace(PLACEHOLDER, (m, kind: NameKind, id: string, form?: NameForm) => resolveName(kind, id, form) ?? m);
}

/** All placeholders of a text (tests check that each one resolves). */
export function placeholdersIn(text: string): { kind: NameKind; id: string; form?: NameForm; raw: string }[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => ({ kind: m[1] as NameKind, id: m[2]!, form: m[3] as NameForm | undefined, raw: m[0] }));
}

/** Any `{…:…}` that looks like a placeholder but is not a valid one (a typo in the data). */
export function brokenPlaceholders(text: string): string[] {
  const valid = new Set(placeholdersIn(text).filter((p) => resolveName(p.kind, p.id, p.form) !== null).map((p) => p.raw));
  return [...text.matchAll(/\{[a-z]+:[^}]*\}/g)].map((m) => m[0]).filter((raw) => !valid.has(raw));
}
