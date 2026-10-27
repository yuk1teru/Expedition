import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { CLASSES } from '../src/data/classes';
import { ENEMIES } from '../src/data/enemies';
import { LORE } from '../src/data/lore';
import { LORE_NAMES, brokenPlaceholders, fillNames, resolveName } from '../src/data/names';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { INTERIORS, TOWNS, allTownNpcs } from '../src/data/towns';
import { ARTIFACT_ORDERS, TROPHIES } from '../src/data/trophies';
import { WORLD_MAP, WORLD_NODES } from '../src/data/world';

/** Every text of the content data, with where it comes from. */
function allTexts(): [string, string][] {
  const out: [string, string][] = [];
  for (const npc of Object.values(NPCS)) {
    out.push([`npc ${npc.id}.title`, npc.title]);
    for (const [nid, node] of Object.entries(npc.nodes)) {
      out.push([`npc ${npc.id}.${nid}`, node.text]);
      node.options.forEach((o, i) => out.push([`npc ${npc.id}.${nid}.option${i}`, o.text]));
    }
  }
  for (const l of LORE) out.push([`lore ${l.id}.title`, l.title], [`lore ${l.id}`, l.text]);
  for (const q of Object.values(QUESTS)) {
    out.push([`quest ${q.id}.name`, q.name], [`quest ${q.id}.offer`, q.offer], [`quest ${q.id}.done`, q.done]);
    if (q.reward.unlock) out.push([`quest ${q.id}.unlock`, q.reward.unlock]);
    if (q.requires?.note) out.push([`quest ${q.id}.note`, q.requires.note]);
    q.objectives.forEach((o, i) => o.text && out.push([`quest ${q.id}.objective${i}`, o.text]));
  }
  for (const t of Object.values(TROPHIES)) out.push([`trophy ${t.id}.name`, t.name], [`trophy ${t.id}`, t.description]);
  for (const o of ARTIFACT_ORDERS) out.push([`order ${o.id}`, o.text]);
  for (const town of Object.values(TOWNS)) for (const b of town.buildings) if (b.label) out.push([`town ${town.id} label`, b.label]);
  for (const room of Object.values(INTERIORS)) out.push([`room ${room.id}`, room.name]);
  for (const [id, n] of Object.entries(LORE_NAMES)) out.push([`name ${id}`, n.name], ...Object.values(n.forms ?? {}).map((f): [string, string] => [`name ${id} form`, f]));
  return out;
}

describe('names in texts', () => {
  it('every name reference in the content resolves', () => {
    for (const [where, text] of allTexts()) expect(brokenPlaceholders(text), where).toEqual([]);
  });

  it('a rename reaches every text that refers to the name', () => {
    const capital = WORLD_NODES.find((n) => n.id === 'capital')!;
    const old = capital.name;
    try {
      capital.name = 'Тестоград';
      expect(fillNames('Столиця — {town:capital}.')).toBe('Столиця — Тестоград.');
      expect(fillNames(NPCS.capitalMerchant!.nodes.hello!.text)).toContain('Тестоград');
    } finally {
      capital.name = old;
    }
  });

  it('case forms fall back to the name; lore names may nest', () => {
    expect(resolveName('town', 'capital', 'in')).toBe(WORLD_NODES.find((n) => n.id === 'capital')!.forms!.in);
    expect(resolveName('loc', 'quietGrove', 'in')).toBe(WORLD_NODES.find((n) => n.id === 'quietGrove')!.name);
    expect(resolveName('name', 'church')).toContain(resolveName('name', 'goddess', 'of')!);
    expect(resolveName('npc', 'nobody')).toBeNull();
  });
});

describe('quests', () => {
  const nodeIds = new Set(WORLD_NODES.map((n) => n.id));
  const townNpcs = new Set(allTownNpcs());

  it('givers live in towns; targets, chains and classes exist', () => {
    for (const q of Object.values(QUESTS)) {
      expect(townNpcs.has(q.giver), `${q.id}: giver ${q.giver}`).toBe(true);
      if (q.turnIn) expect(townNpcs.has(q.turnIn), `${q.id}: turnIn`).toBe(true);
      if (q.next) expect(QUESTS[q.next], `${q.id} → ${q.next}`).toBeDefined();
      for (const r of q.requires?.quests ?? []) expect(QUESTS[r], `${q.id} requires ${r}`).toBeDefined();
      if (q.classId) expect(CLASSES[q.classId], q.id).toBeDefined();
      for (const o of q.objectives) {
        const ok =
          o.kind === 'kill' ? o.target === 'any' || !!ENEMIES[o.target]
          : o.kind === 'bring' ? !!TROPHIES[o.target]
          : o.kind === 'deliver' || o.kind === 'talk' ? townNpcs.has(o.target)
          : o.kind === 'special' ? !!o.text
          : nodeIds.has(o.target);
        expect(ok, `${q.id}: ${o.kind} ${o.target}`).toBe(true);
        if (o.where) expect(nodeIds.has(o.where), `${q.id}: where ${o.where}`).toBe(true);
        if (o.kind === 'killMiniboss') expect(WORLD_NODES.find((n) => n.id === o.target)!.kind, q.id).toBe('location');
        if (o.kind === 'killBoss') expect(WORLD_NODES.find((n) => n.id === o.target)!.kind, q.id).toBe('boss');
      }
    }
  });

  it('class chains give 2 talent points at the end; trials give 1 each', () => {
    for (const q of Object.values(QUESTS)) {
      const points = q.reward.talentPoints ?? 0;
      if (q.kind === 'trial') expect(points, q.id).toBe(1);
      else if (q.kind === 'class') expect(points, q.id).toBe(q.next ? 0 : 2);
      else expect(points, q.id).toBe(0);
    }
    const classes = new Set(Object.values(QUESTS).filter((q) => q.kind === 'class').map((q) => q.classId));
    expect(classes.size).toBe(Object.keys(CLASSES).length);
  });
});

describe('trophies', () => {
  const regions = new Set(WORLD_MAP.regions.map((r) => r.id));

  it('come from existing monsters or regions; orders want existing trophies and pay more than a merchant', () => {
    for (const t of Object.values(TROPHIES)) {
      for (const f of t.from) expect(t.kind === 'relic' ? regions.has(f) : !!ENEMIES[f] || !!BOSSES[f], `${t.id}: ${f}`).toBe(true);
    }
    for (const o of ARTIFACT_ORDERS) {
      const merchant = o.wants.reduce((sum, w) => sum + TROPHIES[w.trophy]!.price * w.count, 0);
      expect(o.pay, o.id).toBeGreaterThan(merchant);
    }
  });
});
