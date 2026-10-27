// Finds the number or string literal behind a data value in a TypeScript source (PLAN.md 8.5): the
// wiki's dev editing writes the new value straight into src/data/*.ts. A small tokenizer
// walks `const ROOT = …` (or `Object.assign(ROOT, …)`) down a path of object keys and
// array indexes; calls like `skill({ … })` are entered through their first argument.
// Values that are not plain literals (computed, spread, from a helper) are not found.

export type LiteralPath = (string | number)[];

interface Token {
  /** id — identifier, num — number, str — string (unquoted text in `v`), p — punctuation. */
  k: 'id' | 'num' | 'str' | 'p';
  v: string;
  s: number;
  e: number;
  /** Comment lines right above the token (own lines only). */
  comment?: string;
  /** Quote of a string token. */
  q?: string;
}

export interface LiteralLocation {
  start: number;
  end: number;
  /** Source text of the literal (`-0.5`, `120`, `'Вовк'`). */
  text: string;
  kind: 'number' | 'string';
  /** The value the literal stands for (strings unescaped). */
  value: number | string;
  /** The comment above the last key of the path. */
  comment?: string;
}

const NUM = /^(?:0x[0-9a-f]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)/i;
const ID = /^[A-Za-z_$][\w$]*/;

export type Tokens = Token[];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let comment: string[] = [];
  let i = 0;
  const lastLineHasToken = (pos: number): boolean => {
    const prev = out[out.length - 1];
    return !!prev && !src.slice(prev.e, pos).includes('\n');
  };
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      if (!lastLineHasToken(i)) comment.push(src.slice(i + 2, stop).trim());
      i = stop;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      if (!lastLineHasToken(i)) {
        const body = src.slice(i + 2, stop - 2).split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim());
        comment.push(...body.filter((l) => l.length > 0));
      }
      i = stop;
      continue;
    }
    let tok: Token;
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      tok = { k: 'str', v: src.slice(i + 1, j), s: i, e: j + 1, q: c };
    } else {
      const rest = src.slice(i, i + 64);
      const num = /\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? '')) ? NUM.exec(rest) : null;
      const id = num ? null : ID.exec(rest);
      if (num) tok = { k: 'num', v: num[0], s: i, e: i + num[0].length };
      else if (id) {
        // Identifiers may be longer than the look-ahead window.
        let j = i + id[0].length;
        while (j < src.length && /[\w$]/.test(src[j]!)) j++;
        tok = { k: 'id', v: src.slice(i, j), s: i, e: j };
      } else if (src.startsWith('...', i)) tok = { k: 'p', v: '...', s: i, e: i + 3 };
      else if (src.startsWith('=>', i)) tok = { k: 'p', v: '=>', s: i, e: i + 2 };
      else tok = { k: 'p', v: c, s: i, e: i + 1 };
    }
    if (comment.length > 0) tok.comment = comment.join(' ');
    comment = [];
    out.push(tok);
    i = tok.e;
  }
  return out;
}

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);

/** Index of the token right after the value starting at `i` (a `,` or a closing bracket). */
function skipValue(toks: Token[], i: number): number {
  let depth = 0;
  for (; i < toks.length; i++) {
    const v = toks[i]!.v;
    if (toks[i]!.k !== 'p') continue;
    if (OPEN.has(v)) depth++;
    else if (CLOSE.has(v)) {
      if (depth === 0) return i;
      depth--;
    } else if (v === ',' && depth === 0) return i;
  }
  return i;
}

/** Source text of a string token (quotes included). */
function src(_toks: Token[], t: Token): string {
  return `${t.q ?? "'"}${t.v}${t.q ?? "'"}`;
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };

/** The text a string literal stands for (`\n`, `\'`, `’` → characters). */
export function unescapeString(raw: string): string {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_m, e: string) => {
    if (e.startsWith('u{')) return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return ESCAPES[e] ?? e;
  });
}

/** `value` as a string literal with the given quote. */
export function quoteString(value: string, quote: string): string {
  let body = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').split(quote).join(`\\${quote}`);
  if (quote === '`') body = body.replace(/\$\{/g, '\\${');
  return `${quote}${body}${quote}`;
}

function resolve(toks: Token[], i: number, path: LiteralPath, anyValue = false): LiteralLocation | null {
  // Calls (`skill({ … })`) and parentheses: look into the first argument.
  while (path.length > 0 && toks[i] && ((toks[i]!.k === 'id' && toks[i + 1]?.v === '(') || toks[i]!.v === '(')) i += toks[i]!.v === '(' ? 1 : 2;
  const t = toks[i];
  if (!t) return null;
  if (path.length === 0) {
    if (anyValue) return { start: t.s, end: t.s, text: '', kind: 'string', value: '' };
    const neg = t.v === '-' && toks[i + 1]?.k === 'num';
    const lit = neg ? toks[i + 1]! : t;
    if (lit.k !== 'num' && lit.k !== 'str') return null;
    // `1 / 3`, `2 * X`, `'a' + b` — computed, not a literal.
    const after = toks[i + (neg ? 2 : 1)];
    if (after && after.k === 'p' && !CLOSE.has(after.v) && after.v !== ',' && after.v !== ';') return null;
    if (lit.k === 'str') {
      // Template strings with `${…}` are computed.
      if (lit.v.includes('${')) return null;
      return { start: lit.s, end: lit.e, text: src(toks, lit), kind: 'string', value: unescapeString(lit.v) };
    }
    const text = (neg ? '-' : '') + lit.v;
    return { start: t.s, end: lit.e, text, kind: 'number', value: Number(text.replace(/_/g, '')) };
  }
  const [head, ...rest] = path;
  if (t.v === '{') {
    i++;
    while (i < toks.length && toks[i]!.v !== '}') {
      const key = toks[i]!;
      if (key.v === '...') i = skipValue(toks, i + 1);
      else if (toks[i + 1]?.v === ':' && (key.k === 'id' || key.k === 'str' || key.k === 'num')) {
        if (key.v === String(head)) {
          const res = resolve(toks, i + 2, rest, anyValue);
          if (res && rest.length === 0 && key.comment) res.comment = key.comment;
          return res;
        }
        i = skipValue(toks, i + 2);
      } else i = skipValue(toks, i);
      if (toks[i]?.v === ',') i++;
    }
    return null;
  }
  if (t.v === '[') {
    if (typeof head !== 'number') return null;
    i++;
    for (let idx = 0; i < toks.length && toks[i]!.v !== ']'; idx++) {
      if (idx === head) return resolve(toks, i, rest, anyValue);
      i = skipValue(toks, i);
      if (toks[i]?.v === ',') i++;
    }
  }
  return null;
}

/** Token indexes where the value of `root` starts. */
function roots(toks: Token[], root: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if ((t.v === 'const' || t.v === 'let') && toks[i + 1]?.v === root) {
      // Skip the type annotation up to `=` (outside brackets).
      let depth = 0;
      for (let j = i + 2; j < toks.length; j++) {
        const v = toks[j]!.v;
        if (v === '<' || OPEN.has(v)) depth++;
        else if (v === '>' || CLOSE.has(v)) depth--;
        else if (v === '=' && depth <= 0) {
          out.push(j + 1);
          break;
        }
      }
    }
    if (t.v === 'Object' && toks[i + 2]?.v === 'assign' && toks[i + 3]?.v === '(' && toks[i + 4]?.v === root && toks[i + 5]?.v === ',') out.push(i + 6);
  }
  return out;
}

/** The number or string literal at `root.path` in `src`, or null. */
export function locateLiteral(src: string, root: string, path: LiteralPath, toks: Token[] = tokenize(src)): LiteralLocation | null {
  for (const start of roots(toks, root)) {
    const res = resolve(toks, start, path);
    if (res) return res;
  }
  return null;
}

/** The comment above the key at `root.path` (any value, not only numbers). */
export function keyComment(src: string, root: string, path: LiteralPath, toks: Token[] = tokenize(src)): string | undefined {
  if (path.length === 0) {
    // The comment above `export const ROOT`.
    const i = toks.findIndex((t, k) => (t.v === 'const' || t.v === 'let') && toks[k + 1]?.v === root);
    if (i < 0) return undefined;
    return toks[i - 1]?.v === 'export' ? toks[i - 1]!.comment : toks[i]!.comment;
  }
  for (const start of roots(toks, root)) {
    const res = resolve(toks, start, path, true);
    if (res) return res.comment;
  }
  return undefined;
}

/** Whether `root` is declared in `src`. */
export function declaresRoot(src: string, root: string): boolean {
  return new RegExp(`(?:const|let)\\s+${root}\\b|Object\\.assign\\(\\s*${root}\\s*,`).test(src);
}

/** Number as written into the source (no float noise: 0.1 + 0.2 → 0.3). */
export function formatLiteral(value: number): string {
  return String(Number(value.toPrecision(12)));
}

/** `src` with the literal at `loc` replaced by `value` (strings keep their quote). */
export function replaceLiteral(src: string, loc: LiteralLocation, value: number | string): string {
  const text = typeof value === 'number' ? formatLiteral(value) : quoteString(value, loc.text[0] ?? "'");
  return src.slice(0, loc.start) + text + src.slice(loc.end);
}
