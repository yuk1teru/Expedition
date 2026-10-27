// Wiki page (PLAN.md 8.5): sections from src/data with a navigation and a filter. In
// `npm run dev` every number that is a plain literal in the data is editable: a click
// opens an input, Enter writes the value into the data file (scripts/wikiPlugin.ts) and
// the page reloads with the new data.

import balanceSource from '../data/balance.ts?raw';
import { GAME_VERSION } from '../data/changelog';
import { type LiteralPath, type Tokens, declaresRoot, keyComment, locateLiteral, tokenize } from './literal';
import { type Fmt, type Ref, buildSections, esc, formatValue } from './sections';
import './style.css';

const balanceTokens = tokenize(balanceSource);
const sections = buildSections((root, path) => keyComment(balanceSource, root, path, balanceTokens));

const app = document.getElementById('wiki')!;
app.innerHTML = `
<nav>
  <a class="home" href="./index.html">← До гри</a>
  <h1>Вікі</h1>
  <div class="dim small">версія ${esc(GAME_VERSION)}</div>
  <input id="filter" type="search" placeholder="Пошук…" />
  ${sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}
  ${import.meta.env.DEV ? '<div class="devnote">Режим розробника: клік по підкресленому числу — змінити його в даних гри.</div>' : ''}
</nav>
<main>${sections.map((s) => `<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}</main>
<div id="toast"></div>`;

// ---- Filter: hides cards and table rows without the text ----

const filter = document.getElementById('filter') as HTMLInputElement;
filter.addEventListener('input', () => {
  const q = filter.value.trim().toLowerCase();
  for (const el of document.querySelectorAll<HTMLElement>('main .card, main tbody tr')) {
    el.style.display = !q || el.textContent!.toLowerCase().includes(q) ? '' : 'none';
  }
  for (const d of document.querySelectorAll<HTMLDetailsElement>('main details')) if (q) d.open = true;
});

function toast(text: string, bad = false): void {
  const t = document.getElementById('toast')!;
  t.textContent = text;
  t.className = bad ? 'show bad' : 'show';
  window.setTimeout(() => (t.className = ''), 4000);
}

// ---- Dev editing ----

const SCROLL_KEY = 'wiki.scroll';
const TOAST_KEY = 'wiki.toast';

if (import.meta.env.DEV) void enableEditing();

async function enableEditing(): Promise<void> {
  const raw = import.meta.glob('../data/*.ts', { query: '?raw', import: 'default' });
  const sources = await Promise.all(Object.values(raw).map((load) => load() as Promise<string>));
  const parsed: { src: string; toks: Tokens }[] = sources.map((src) => ({ src, toks: tokenize(src) }));
  const findLiteral = (root: string, path: LiteralPath): boolean =>
    parsed.some((f) => declaresRoot(f.src, root) && locateLiteral(f.src, root, path, f.toks) !== null);
  for (const el of document.querySelectorAll<HTMLElement>('.v[data-ref]')) {
    const [root, ...path] = JSON.parse(el.dataset.ref!) as Ref;
    if (!findLiteral(root, path)) continue;
    el.classList.add('edit');
    el.title = `${root}.${path.join('.')} = ${el.dataset.raw}`;
    el.addEventListener('click', () => openEditor(el, root, path));
  }
  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (saved) {
    sessionStorage.removeItem(SCROLL_KEY);
    window.scrollTo(0, Number(saved));
  }
  const msg = sessionStorage.getItem(TOAST_KEY);
  if (msg) {
    sessionStorage.removeItem(TOAST_KEY);
    toast(msg);
  }
}

function openEditor(el: HTMLElement, root: string, path: LiteralPath): void {
  if (el.querySelector('input')) return;
  const old = Number(el.dataset.raw);
  const shown = el.innerHTML;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.value = String(old);
  input.className = 'num-edit';
  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
  input.select();
  const cancel = (): void => {
    el.innerHTML = shown;
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel();
    if (e.key !== 'Enter') return;
    const value = Number(input.value);
    if (input.value.trim() === '' || !Number.isFinite(value)) {
      toast('Потрібне число', true);
      return;
    }
    if (value === old) {
      cancel();
      return;
    }
    void save(el, root, path, old, value, shown);
  });
  input.addEventListener('blur', () => window.setTimeout(() => el.contains(input) && cancel(), 150));
}

async function save(el: HTMLElement, root: string, path: LiteralPath, old: number, value: number, shown: string): Promise<void> {
  el.innerHTML = '…';
  try {
    const res = await fetch('/__wiki/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, path, value, expect: old }),
    });
    const out = (await res.json()) as { ok: boolean; file?: string; error?: string };
    if (!out.ok) throw new Error(out.error ?? res.statusText);
    const fmt = (el.dataset.fmt ?? 'n') as Fmt;
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    sessionStorage.setItem(TOAST_KEY, `Збережено: ${root}.${path.join('.')} ${formatValue(old, fmt)} → ${formatValue(value, fmt)} (${out.file})`);
    // Vite reloads the page after the data file changes; reload anyway if it does not.
    window.setTimeout(() => location.reload(), 1500);
  } catch (err) {
    el.innerHTML = shown;
    toast(`Не збережено: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}
