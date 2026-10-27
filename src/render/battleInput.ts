// Copies the player's current input (held movement keys, mouse aim) into the battle.

import type { Input } from '../core/input';
import type { Battle } from '../systems/battle';
import { insideArena } from '../systems/collision';
import { ARENA_VIEW } from '../data/balance';

export function syncBattleInput(input: Input, b: Battle): void {
  const m = input.mouse;
  b.input.control = 'player';
  b.input.move = input.moveVector();
  // The mouse is on the screen; the arena may scroll under the camera.
  const inView = m.x >= ARENA_VIEW.x && m.x <= ARENA_VIEW.x + ARENA_VIEW.w && m.y >= ARENA_VIEW.y && m.y <= ARENA_VIEW.y + ARENA_VIEW.h;
  const world = { x: m.x - ARENA_VIEW.x + b.cam.x, y: m.y - ARENA_VIEW.y + b.cam.y };
  b.input.aim = inView && insideArena(world.x, world.y) ? world : null;
  b.input.cursor = world;
}
