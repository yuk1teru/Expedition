// Copies the player's current input (held movement keys, mouse aim) into the battle.

import type { Input } from '../core/input';
import type { Battle } from '../systems/battle';
import { insideArena } from '../systems/collision';

export function syncBattleInput(input: Input, b: Battle): void {
  const m = input.mouse;
  b.input.move = input.moveVector();
  b.input.aim = insideArena(m.x, m.y) ? { x: m.x, y: m.y } : null;
}
