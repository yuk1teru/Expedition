// Dev-only Vite middleware for the wiki (PLAN.md 8.5): POST /__wiki/edit with
// { root, path, value, expect } finds the number or string literal of `root.path` in src/data/*.ts
// and writes the new value; Vite then reloads the pages that use the data.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { type LiteralPath, declaresRoot, locateLiteral, replaceLiteral } from '../src/wiki/literal';

const DATA_DIR = 'src/data';

interface EditRequest {
  root: string;
  path: LiteralPath;
  value: number | string;
  /** The value the wiki showed; the edit is refused if the file says otherwise. */
  expect?: number | string;
}

/** Applies an edit to the data files; returns the changed file or an error. */
export function applyWikiEdit(dir: string, req: EditRequest): { ok: true; file: string; old: string } | { ok: false; error: string } {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(req.root)) return { ok: false, error: `невідома група ${req.root}` };
  if (!Array.isArray(req.path) || req.path.some((p) => typeof p !== 'string' && typeof p !== 'number')) return { ok: false, error: 'невірний шлях' };
  if (typeof req.value === 'number' ? !Number.isFinite(req.value) : typeof req.value !== 'string') return { ok: false, error: 'потрібне число або текст' };
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts')) continue;
    const file = join(dir, name);
    const src = readFileSync(file, 'utf8');
    if (!declaresRoot(src, req.root)) continue;
    const loc = locateLiteral(src, req.root, req.path);
    if (!loc) continue;
    if (loc.kind !== (typeof req.value === 'number' ? 'number' : 'string')) return { ok: false, error: loc.kind === 'number' ? 'тут потрібне число' : 'тут потрібен текст' };
    if (req.expect !== undefined && loc.value !== req.expect) return { ok: false, error: `у файлі вже ${loc.text}, а не ${String(req.expect)} — онови сторінку` };
    writeFileSync(file, replaceLiteral(src, loc, req.value));
    return { ok: true, file: `${dir}/${name}`, old: loc.text };
  }
  return { ok: false, error: `${req.root}.${req.path.join('.')} — не просте значення в ${dir}` };
}

export function wikiEditPlugin(): Plugin {
  return {
    name: 'wiki-edit',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__wiki/edit', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          let out: ReturnType<typeof applyWikiEdit>;
          try {
            out = applyWikiEdit(DATA_DIR, JSON.parse(body) as EditRequest);
          } catch (err) {
            out = { ok: false, error: String(err) };
          }
          if (out.ok) server.config.logger.info(`wiki: ${out.file} ${out.old} → ${JSON.stringify((JSON.parse(body) as EditRequest).value)}`);
          res.statusCode = out.ok ? 200 : 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}
