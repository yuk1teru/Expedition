// What part of the field the screen shows (ROADMAP 20.4): the camera follows the hero (a little
// above him) and stops at the field's edges; in the duel it holds the ring, pulled back. The hero
// and his skills aim only at beasts the player can see — a ranged hero must not kill the flood
// off screen before it ever comes. The view (reworkView.ts) draws from the same rect.

import { VIEW } from '../../data/balance';
import { REWORK_BOSS, REWORK_FIELD } from '../../data/rework';
import type { Vec } from '../entities';
import type { Run } from './types';

const clamp = (v: number, max: number): number => Math.max(0, Math.min(Math.max(0, max), v));

/** The camera holds the ring: in the duel, and after the biome's last boss (no path on). */
export const duel = (run: Run): boolean => run.phase === 'ring' || (run.phase === 'won' && !run.path);

/** The world rect on screen at `zoom` (1 — the flood, `REWORK_BOSS.zoom` — the duel). */
export function viewRect(run: Run, zoom = duel(run) ? REWORK_BOSS.zoom : 1): { x: number; y: number; w: number; h: number } {
  const w = VIEW.width / zoom;
  const h = VIEW.height / zoom;
  const f = duel(run) ? run.ringCenter : run.hero.pos;
  return { x: clamp(f.x - w / 2, run.width - w), y: clamp(f.y - h / 2 - REWORK_FIELD.camLift, run.height - h), w, h };
}

/** Whether a point is on screen, `inset` px inside its edges. */
export function onScreen(run: Run, p: Vec, inset = REWORK_FIELD.aimInset): boolean {
  const v = viewRect(run);
  return p.x > v.x + inset && p.x < v.x + v.w - inset && p.y > v.y + inset && p.y < v.y + v.h - inset;
}
