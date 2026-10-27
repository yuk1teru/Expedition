import { describe, expect, it } from 'vitest';
import { resolveName, fillNames } from '../src/data/names';
import { NPCS } from '../src/data/npcs';
import { TOWNS, type TownLayout, getTownLayout } from '../src/data/towns';
import { WORLD_NODES } from '../src/data/world';
import { atGate, chooseOption, createWalker, currentNode, isWalkable, moveWalker, npcInReach, startConversation, stepWalker } from '../src/systems/town';

/** Grid flood fill from the spawn over walkable points (4 px steps). */
function reachable(layout: TownLayout): { x: number; y: number }[] {
  const S = 4;
  const seen = new Set<string>();
  const start = { x: Math.round(layout.spawn.x / S), y: Math.round(layout.spawn.y / S) };
  const queue = [start];
  const out: { x: number; y: number }[] = [];
  seen.add(`${start.x},${start.y}`);
  while (queue.length > 0) {
    const c = queue.pop()!;
    out.push({ x: c.x * S, y: c.y * S });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = `${n.x},${n.y}`;
      if (seen.has(k) || !isWalkable(layout, n.x * S, n.y * S)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return out;
}

describe('town layouts', () => {
  const towns = WORLD_NODES.filter((n) => n.kind === 'town');

  it('every town of the world has its own layout', () => {
    for (const t of towns) expect(TOWNS[t.id], t.id).toBeDefined();
    expect(getTownLayout('unknown').id).toBe('capital');
  });

  it('every NPC exists and every town has a merchant with a shop option', () => {
    for (const layout of Object.values(TOWNS)) {
      for (const n of layout.npcs) expect(NPCS[n.id], `${layout.id}: ${n.id}`).toBeDefined();
      const shop = layout.npcs.some((n) => Object.values(NPCS[n.id]!.nodes).some((node) => node.options.some((o) => o.action === 'openShop')));
      expect(shop, layout.id).toBe(true);
    }
  });

  it('the spawn is walkable and the gate and every NPC can be reached from it', () => {
    for (const layout of Object.values(TOWNS)) {
      expect(isWalkable(layout, layout.spawn.x, layout.spawn.y), layout.id).toBe(true);
      expect(atGate(layout, layout.spawn), `${layout.id}: spawn inside the gate`).toBe(false);
      const area = reachable(layout);
      expect(area.some((p) => atGate(layout, p)), `${layout.id}: gate`).toBe(true);
      for (const npc of layout.npcs) expect(area.some((p) => npcInReach(layout, p) === npc.id), `${layout.id}: ${npc.id}`).toBe(true);
    }
  });
});

describe('town walking', () => {
  it('the prologue arrival point is walkable and next to the first quest giver', () => {
    const port = TOWNS.port!;
    expect(port.arrival).toBeDefined();
    expect(isWalkable(port, port.arrival!.x, port.arrival!.y)).toBe(true);
    expect(npcInReach(port, port.arrival!)).toBe('portFisher');
  });

  const layout = getTownLayout('capital');

  it('buildings block the hero, who slides along the wall', () => {
    const b = layout.buildings[13]!;
    const w = createWalker(layout);
    w.pos = { x: b.x + b.w / 2, y: b.y + b.h + 20 };
    for (let i = 0; i < 60; i++) moveWalker(layout, w, { x: 0, y: -1 }, 1 / 60);
    expect(w.pos.y).toBeGreaterThan(b.y + b.h);
    const x0 = w.pos.x;
    const d = Math.SQRT1_2;
    for (let i = 0; i < 30; i++) moveWalker(layout, w, { x: d, y: -d }, 1 / 60);
    expect(w.pos.x).toBeGreaterThan(x0);
  });

  it('a clicked NPC is talked to once the hero gets there', () => {
    const w = createWalker(layout);
    const npc = layout.npcs.find((n) => n.id === 'capitalMerchant')!;
    w.talkTo = npc.id;
    w.target = { x: npc.x + 30, y: npc.y + 10 };
    let met: string | null = null;
    for (let i = 0; i < 60 * 10 && !met; i++) met = stepWalker(layout, w, { x: 0, y: 0 }, 1 / 60);
    expect(met).toBe('capitalMerchant');
  });

  it('WASD cancels the click target', () => {
    const w = createWalker(layout);
    w.target = { x: 100, y: 300 };
    w.talkTo = 'capitalMerchant';
    stepWalker(layout, w, { x: 1, y: 0 }, 1 / 60);
    expect(w.target).toBeNull();
    expect(w.talkTo).toBeNull();
  });
});

describe('dialogues', () => {
  it('every option leads to an existing node and every node has options', () => {
    for (const npc of Object.values(NPCS)) {
      expect(npc.nodes[npc.start], npc.id).toBeDefined();
      for (const [id, node] of Object.entries(npc.nodes)) {
        expect(node.options.length, `${npc.id}.${id}`).toBeGreaterThan(0);
        for (const o of node.options) {
          if (o.next) expect(npc.nodes[o.next], `${npc.id}.${id} → ${o.next}`).toBeDefined();
          else expect(o.action, `${npc.id}.${id}: «${o.text}» goes nowhere`).toBeDefined();
        }
      }
    }
  });

  it('the merchant greets, can talk and opens the shop', () => {
    const c = startConversation('capitalMerchant');
    expect(fillNames(currentNode(c).text)).toContain(resolveName('town', 'capital')!);
    const about = currentNode(c).options.findIndex((o) => o.next === 'about');
    expect(chooseOption(c, about)).toEqual({ action: null, ended: false });
    expect(c.nodeId).toBe('about');
    const shop = currentNode(c).options.findIndex((o) => o.action === 'openShop');
    expect(chooseOption(c, shop)).toEqual({ action: 'openShop', ended: true });
  });

  it('an option index out of range does nothing', () => {
    const c = startConversation('capitalGuard');
    expect(chooseOption(c, 9)).toEqual({ action: null, ended: false });
    expect(c.nodeId).toBe('hello');
  });
});
