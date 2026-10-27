import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyWikiEdit } from '../scripts/wikiPlugin';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { SKILLS } from '../src/data/skills';
import { WAVES } from '../src/data/balance';
import { WORLD_NODES } from '../src/data/world';
import { locateLiteral, replaceLiteral } from '../src/wiki/literal';

const SRC = `
// Head comment.
export const A: Record<string, { x: number }> = {
  /** Hit points. */
  hp: 9,
  neg: -0.5, // trailing note
  'quoted': 3,
  nested: { list: [1, { deep: 2.5 }, 3], call: f(1, 2) },
  ...SPREAD,
  computed: 1 / 3,
  after: 7,
};
const B = make({ base: { damage: 4 }, upgrades: [{ set: { damage: 5 } }, { set: {} }] });
Object.assign(A, { extra: { hp: 11 } });
`;

describe('literal locator', () => {
  it('finds keys, quoted keys, negatives, arrays and nested objects', () => {
    expect(locateLiteral(SRC, 'A', ['hp'])?.text).toBe('9');
    expect(locateLiteral(SRC, 'A', ['hp'])?.comment).toBe('Hit points.');
    expect(locateLiteral(SRC, 'A', ['neg'])?.text).toBe('-0.5');
    expect(locateLiteral(SRC, 'A', ['quoted'])?.text).toBe('3');
    expect(locateLiteral(SRC, 'A', ['nested', 'list', 1, 'deep'])?.text).toBe('2.5');
    expect(locateLiteral(SRC, 'A', ['nested', 'list', 2])?.text).toBe('3');
    expect(locateLiteral(SRC, 'A', ['after'])?.text).toBe('7');
    expect(locateLiteral(SRC, 'A', ['after'])?.comment).toBeUndefined();
  });

  it('enters calls and Object.assign extensions', () => {
    expect(locateLiteral(SRC, 'B', ['base', 'damage'])?.text).toBe('4');
    expect(locateLiteral(SRC, 'B', ['upgrades', 0, 'set', 'damage'])?.text).toBe('5');
    expect(locateLiteral(SRC, 'A', ['extra', 'hp'])?.text).toBe('11');
  });

  it('refuses computed values, missing keys and non-numbers', () => {
    expect(locateLiteral(SRC, 'A', ['computed'])).toBeNull();
    expect(locateLiteral(SRC, 'A', ['missing'])).toBeNull();
    expect(locateLiteral(SRC, 'A', ['nested'])).toBeNull();
    expect(locateLiteral(SRC, 'A', ['nested', 'call'])).toBeNull();
    expect(locateLiteral(SRC, 'B', ['upgrades', 1, 'set', 'damage'])).toBeNull();
    expect(locateLiteral(SRC, 'C', ['hp'])).toBeNull();
  });

  it('replaces only the literal, without float noise', () => {
    const loc = locateLiteral(SRC, 'A', ['neg'])!;
    const out = replaceLiteral(SRC, loc, 0.1 + 0.2);
    expect(out).toContain('neg: 0.3, // trailing note');
    expect(locateLiteral(out, 'A', ['after'])?.text).toBe('7');
  });

  it('agrees with the real data files', () => {
    const enemies = readFileSync('src/data/enemies.ts', 'utf8');
    for (const [id, e] of Object.entries(ENEMIES)) {
      const loc = locateLiteral(enemies, 'ENEMIES', [id, 'hp']);
      if (loc) expect(Number(loc.text), id).toBe(e.hp);
    }
    expect(locateLiteral(enemies, 'ENEMIES', ['wolf', 'dash', 'interval'])?.text).toBe(String(ENEMIES.wolf!.dash!.interval));
    const balance = readFileSync('src/data/balance.ts', 'utf8');
    expect(Number(locateLiteral(balance, 'WAVES', ['overlapAt'])?.text)).toBe(WAVES.overlapAt);
    const world = readFileSync('src/data/world.ts', 'utf8');
    WORLD_NODES.forEach((n, i) => expect(Number(locateLiteral(world, 'WORLD_NODES', [i, 'tier'])?.text), n.id).toBe(n.tier));
    const skills = readFileSync('src/data/skills.ts', 'utf8');
    const first = Object.values(SKILLS)[0]!;
    const param = Object.keys(first.ranks[0]!)[0]!;
    const base = locateLiteral(skills, 'SKILLS', [first.id, 'base', param]);
    expect(Number(base?.text)).toBe(first.ranks[0]![param]);
  });
});

describe('wiki edits', () => {
  it('writes the value into the file that declares the root and refuses stale or computed edits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wiki-'));
    writeFileSync(join(dir, 'a.ts'), 'export const OTHER = { hp: 1 };\n');
    writeFileSync(join(dir, 'b.ts'), SRC);
    expect(applyWikiEdit(dir, { root: 'A', path: ['hp'], value: 12, expect: 9 })).toMatchObject({ ok: true, old: '9' });
    expect(locateLiteral(readFileSync(join(dir, 'b.ts'), 'utf8'), 'A', ['hp'])?.text).toBe('12');
    expect(applyWikiEdit(dir, { root: 'A', path: ['hp'], value: 5, expect: 9 }).ok).toBe(false);
    expect(applyWikiEdit(dir, { root: 'A', path: ['computed'], value: 5 }).ok).toBe(false);
    expect(applyWikiEdit(dir, { root: 'A', path: ['hp'], value: Number.NaN }).ok).toBe(false);
    expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe('export const OTHER = { hp: 1 };\n');
  });
});
