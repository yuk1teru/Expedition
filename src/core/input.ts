// Input: keyboard + mouse, converted to logical coordinates.
// Event sources and the coordinate mapping are passed in; no global DOM access.

export type InputEvent =
  | { type: 'key'; code: string; key: string; shift: boolean }
  | { type: 'mousedown'; x: number; y: number; button: number }
  | { type: 'mousemove'; x: number; y: number };

/** Keys the game reacts to (KeyboardEvent.code). */
export const GAME_KEYS = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Space',
  'Escape',
  'Backquote',
  'Enter',
  'Tab',
] as const;

export interface KeyLike {
  code: string;
  key: string;
  shiftKey: boolean;
  repeat: boolean;
  preventDefault(): void;
}

export interface PointerLike {
  clientX: number;
  clientY: number;
  button: number;
}

export interface EventSourceLike {
  addEventListener(type: string, fn: (e: unknown) => void): void;
}

export class Input {
  mouse = { x: -1, y: -1 };
  private queue: InputEvent[] = [];

  push(e: InputEvent): void {
    if (e.type === 'mousemove' || e.type === 'mousedown') {
      this.mouse.x = e.x;
      this.mouse.y = e.y;
    }
    this.queue.push(e);
  }

  drain(): InputEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}

/** Wires DOM-like event sources into an Input. */
export function bindInput(
  input: Input,
  keySource: EventSourceLike,
  pointerSource: EventSourceLike,
  toLogical: (clientX: number, clientY: number) => { x: number; y: number },
): void {
  keySource.addEventListener('keydown', (raw) => {
    const e = raw as KeyLike;
    if ((GAME_KEYS as readonly string[]).includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.push({ type: 'key', code: e.code, key: e.key, shift: e.shiftKey });
  });
  pointerSource.addEventListener('mousemove', (raw) => {
    const e = raw as PointerLike;
    const p = toLogical(e.clientX, e.clientY);
    input.push({ type: 'mousemove', x: p.x, y: p.y });
  });
  pointerSource.addEventListener('mousedown', (raw) => {
    const e = raw as PointerLike;
    const p = toLogical(e.clientX, e.clientY);
    input.push({ type: 'mousedown', x: p.x, y: p.y, button: e.button });
  });
}
