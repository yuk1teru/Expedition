// Input: keyboard + mouse, converted to logical coordinates.
// Event sources and the coordinate mapping are passed in; no global DOM access.

export type InputEvent =
  | { type: 'key'; code: string; key: string; shift: boolean }
  | { type: 'mousedown'; x: number; y: number; button: number }
  | { type: 'mouseup'; x: number; y: number; button: number }
  | { type: 'mousemove'; x: number; y: number }
  /** Mouse wheel: `delta` > 0 scrolls down (zoom out on the map). */
  | { type: 'wheel'; x: number; y: number; delta: number };

/** Movement keys (KeyboardEvent.code) → direction. */
export const MOVE_KEYS: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Keys the game reacts to (KeyboardEvent.code); their browser defaults are suppressed. */
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
  'KeyE',
  'KeyG',
  ...Object.keys(MOVE_KEYS),
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

export interface WheelLike extends PointerLike {
  deltaY: number;
  preventDefault(): void;
}

export interface EventSourceLike {
  addEventListener(type: string, fn: (e: unknown) => void, options?: { passive?: boolean }): void;
}

export class Input {
  mouse = { x: -1, y: -1 };
  /** Keys currently held down (KeyboardEvent.code). */
  readonly held = new Set<string>();
  private queue: InputEvent[] = [];

  push(e: InputEvent): void {
    if (e.type !== 'key') {
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

  /** Normalised movement direction from held movement keys (zero if none). */
  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const code of this.held) {
      const d = MOVE_KEYS[code];
      if (d) {
        x += d.x;
        y += d.y;
      }
    }
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
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
    input.held.add(e.code);
    if (e.repeat) return;
    input.push({ type: 'key', code: e.code, key: e.key, shift: e.shiftKey });
  });
  keySource.addEventListener('keyup', (raw) => {
    input.held.delete((raw as KeyLike).code);
  });
  // Releasing keys outside the window must not leave the hero running.
  keySource.addEventListener('blur', () => input.held.clear());
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
  // The wheel zooms the map; the page itself must not scroll.
  pointerSource.addEventListener(
    'wheel',
    (raw) => {
      const e = raw as WheelLike;
      e.preventDefault();
      const p = toLogical(e.clientX, e.clientY);
      input.push({ type: 'wheel', x: p.x, y: p.y, delta: e.deltaY });
    },
    { passive: false },
  );
  // Mouse-up is listened on the key source (window) so drags ending outside the canvas still finish.
  keySource.addEventListener('mouseup', (raw) => {
    const e = raw as PointerLike;
    const p = toLogical(e.clientX, e.clientY);
    input.push({ type: 'mouseup', x: p.x, y: p.y, button: e.button });
  });
}
