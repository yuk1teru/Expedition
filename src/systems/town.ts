// Town scene logic (PLAN.md 8.4): the hero walks around a town layout (buildings and
// water block), talks to NPCs and leaves through the gate. Conversations follow the
// node graphs of src/data/npcs.ts.

import { TOWN_SCENE } from '../data/balance';
import { type DialogueAction, type DialogueNode, type NpcDef, getNpc } from '../data/npcs';
import type { TownLayout, TownRect } from '../data/towns';
import type { Vec } from './entities';

export interface TownWalker {
  pos: Vec;
  /** Click-to-walk destination (null — WASD only). */
  target: Vec | null;
  /** NPC to talk to once the hero gets there (a click on the NPC). */
  talkTo: string | null;
  facing: number;
}

export function createWalker(layout: TownLayout): TownWalker {
  return { pos: { ...layout.spawn }, target: null, talkTo: null, facing: -Math.PI / 2 };
}

function circleHitsRect(x: number, y: number, r: number, b: TownRect): boolean {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

/** Whether the hero can stand at (x, y): inside the town map, off buildings, water and NPCs. */
export function isWalkable(layout: TownLayout, x: number, y: number): boolean {
  const r = TOWN_SCENE.heroRadius;
  if (x < r || x > layout.width - r || y < r || y > layout.height - r) {
    // The gate may touch the edge.
    if (!circleHitsRect(x, y, r, layout.gate)) return false;
  }
  for (const b of layout.buildings) if (circleHitsRect(x, y, r, b)) return false;
  for (const w of layout.water) if (circleHitsRect(x, y, r, w)) return false;
  const n = TOWN_SCENE.npcRadius + r;
  for (const npc of layout.npcs) if ((x - npc.x) ** 2 + (y - npc.y) ** 2 < n * n) return false;
  return true;
}

/** Moves the walker by `dir` (normalised) for `dt` seconds, sliding along walls. */
export function moveWalker(layout: TownLayout, w: TownWalker, dir: Vec, dt: number): void {
  if (dir.x === 0 && dir.y === 0) return;
  const step = TOWN_SCENE.heroSpeed * dt;
  const nx = w.pos.x + dir.x * step;
  const ny = w.pos.y + dir.y * step;
  w.facing = Math.atan2(dir.y, dir.x);
  if (isWalkable(layout, nx, ny)) {
    w.pos.x = nx;
    w.pos.y = ny;
  } else if (isWalkable(layout, nx, w.pos.y)) w.pos.x = nx;
  else if (isWalkable(layout, w.pos.x, ny)) w.pos.y = ny;
}

/** NPC the hero is close enough to talk to (the nearest), or null. */
export function npcInReach(layout: TownLayout, pos: Vec): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  const reach = TOWN_SCENE.heroRadius + TOWN_SCENE.npcRadius + TOWN_SCENE.talkRange;
  for (const npc of layout.npcs) {
    const d = Math.hypot(pos.x - npc.x, pos.y - npc.y);
    if (d <= reach && d < bestD) {
      bestD = d;
      best = npc.id;
    }
  }
  return best;
}

/** NPC under a screen point (a click), or null. */
export function npcAt(layout: TownLayout, x: number, y: number): string | null {
  const r = TOWN_SCENE.npcRadius + 8;
  for (const npc of layout.npcs) if ((x - npc.x) ** 2 + (y - npc.y) ** 2 <= r * r) return npc.id;
  return null;
}

export function atGate(layout: TownLayout, pos: Vec): boolean {
  return circleHitsRect(pos.x, pos.y, TOWN_SCENE.heroRadius, layout.gate);
}

/**
 * One step of the walker: WASD wins over a click target. Returns the NPC to talk to
 * when the hero has reached the one that was clicked.
 */
export function stepWalker(layout: TownLayout, w: TownWalker, move: Vec, dt: number): string | null {
  if (move.x !== 0 || move.y !== 0) {
    w.target = null;
    w.talkTo = null;
    moveWalker(layout, w, move, dt);
    return null;
  }
  if (w.talkTo && npcInReach(layout, w.pos) === w.talkTo) {
    const id = w.talkTo;
    w.talkTo = null;
    w.target = null;
    return id;
  }
  if (!w.target) return null;
  const dx = w.target.x - w.pos.x;
  const dy = w.target.y - w.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 3) {
    w.target = null;
    return null;
  }
  const before = { ...w.pos };
  moveWalker(layout, w, { x: dx / d, y: dy / d }, Math.min(dt, d / TOWN_SCENE.heroSpeed));
  // Stuck against a wall: give up the target.
  if (before.x === w.pos.x && before.y === w.pos.y) {
    w.target = null;
    w.talkTo = null;
  }
  return null;
}

// ---- Conversations ----

export interface Conversation {
  npc: NpcDef;
  nodeId: string;
}

export function startConversation(npcId: string): Conversation {
  const npc = getNpc(npcId);
  return { npc, nodeId: npc.start };
}

export function currentNode(c: Conversation): DialogueNode {
  const node = c.npc.nodes[c.nodeId];
  if (!node) throw new Error(`NPC ${c.npc.id}: unknown dialogue node ${c.nodeId}`);
  return node;
}

/**
 * Picks option `index`: moves to its `next` node and returns its action. `ended` is true
 * when the conversation is over (no next node).
 */
export function chooseOption(c: Conversation, index: number): { action: DialogueAction | null; ended: boolean } {
  const opt = currentNode(c).options[index];
  if (!opt) return { action: null, ended: false };
  if (opt.next) c.nodeId = opt.next;
  return { action: opt.action ?? null, ended: !opt.next };
}
