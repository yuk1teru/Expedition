// Basic UI primitives: buttons (hover + keyboard focus), panels,
// wrapped text, progress bars, tooltips.

import type { InputEvent } from '../core/input';
import { THEME, font } from './theme';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export interface ButtonOptions {
  label: string;
  rect: Rect;
  onClick: () => void;
  enabled?: boolean;
  /** Optional hotkey (KeyboardEvent.code). */
  hotkey?: string;
  fontSize?: number;
}

export class Button {
  label: string;
  rect: Rect;
  onClick: () => void;
  enabled: boolean;
  hotkey: string | undefined;
  fontSize: number;
  hovered = false;
  focused = false;

  constructor(o: ButtonOptions) {
    this.label = o.label;
    this.rect = o.rect;
    this.onClick = o.onClick;
    this.enabled = o.enabled ?? true;
    this.hotkey = o.hotkey;
    this.fontSize = o.fontSize ?? 18;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.rect;
    ctx.fillStyle = !this.enabled ? THEME.buttonDisabled : this.hovered ? THEME.buttonHover : THEME.button;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.lineWidth = this.focused ? 3 : 1.5;
    ctx.strokeStyle = this.focused ? THEME.focus : THEME.panelBorder;
    ctx.stroke();
    ctx.fillStyle = this.enabled ? THEME.text : THEME.textMuted;
    ctx.font = font(this.fontSize, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, x + w / 2, y + h / 2 + 1);
  }
}

/** A set of buttons with mouse hover/click and Tab/Enter keyboard focus. */
export class ButtonGroup {
  buttons: Button[] = [];
  private focus = -1;

  constructor(buttons: Button[] = []) {
    this.buttons = buttons;
  }

  add(b: Button): Button {
    this.buttons.push(b);
    return b;
  }

  clear(): void {
    this.buttons = [];
    this.focus = -1;
  }

  /** Returns true if the event was consumed. */
  handle(e: InputEvent): boolean {
    if (e.type === 'mousemove') {
      for (const b of this.buttons) b.hovered = inRect(b.rect, e.x, e.y);
      return false;
    }
    if (e.type === 'mousedown') {
      if (e.button !== 0) return false;
      for (const b of this.buttons) {
        if (b.enabled && inRect(b.rect, e.x, e.y)) {
          b.onClick();
          return true;
        }
      }
      return false;
    }
    if (e.type !== 'key') return false;
    if (e.code === 'Tab') {
      const enabled = this.buttons.filter((b) => b.enabled);
      if (enabled.length === 0) return false;
      const n = this.buttons.length;
      let i = this.focus;
      for (let k = 0; k < n; k++) {
        i = (i + (e.shift ? n - 1 : 1)) % n;
        if (this.buttons[i]?.enabled) break;
      }
      this.setFocus(i);
      return true;
    }
    if (e.code === 'Enter') {
      const b = this.buttons[this.focus];
      if (b?.enabled) {
        b.onClick();
        return true;
      }
    }
    for (const b of this.buttons) {
      if (b.enabled && b.hotkey === e.code) {
        b.onClick();
        return true;
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.buttons) b.draw(ctx);
  }

  private setFocus(i: number): void {
    this.focus = i;
    this.buttons.forEach((b, k) => (b.focused = k === i));
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect, fill: string = THEME.panel, border: string = THEME.panelBorder): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = border;
  ctx.stroke();
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draws wrapped text; returns the height used. */
export function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length * lineHeight;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; bold?: boolean; baseline?: CanvasTextBaseline } = {},
): void {
  ctx.font = font(opts.size ?? 16, opts.bold ? 'bold' : 'normal');
  ctx.fillStyle = opts.color ?? THEME.text;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillText(text, x, y);
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  fraction: number,
  color: string,
  back: string = 'rgba(0,0,0,0.5)',
  label?: string,
): void {
  const f = Math.max(0, Math.min(1, fraction));
  roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(4, r.h / 2));
  ctx.fillStyle = back;
  ctx.fill();
  if (f > 0) {
    roundRect(ctx, r.x, r.y, r.w * f, r.h, Math.min(4, r.h / 2));
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (label) {
    drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, {
      size: Math.max(10, Math.min(14, r.h - 2)),
      align: 'center',
      bold: true,
    });
  }
}

/** Tooltip box near (x, y), kept inside the logical screen. */
export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  screenW: number,
  screenH: number,
): void {
  if (lines.length === 0) return;
  const size = 14;
  const lh = 19;
  const pad = 10;
  ctx.font = font(size);
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += pad * 2;
  const h = lines.length * lh + pad * 2 - 4;
  let tx = x + 16;
  let ty = y + 16;
  if (tx + w > screenW - 4) tx = x - w - 12;
  if (ty + h > screenH - 4) ty = screenH - h - 4;
  tx = Math.max(4, tx);
  ty = Math.max(4, ty);
  drawPanel(ctx, { x: tx, y: ty, w, h }, 'rgba(10, 12, 18, 0.95)');
  lines.forEach((l, i) => {
    drawText(ctx, l, tx + pad, ty + pad + i * lh + 6, {
      size,
      color: i === 0 ? THEME.accent : THEME.text,
      bold: i === 0,
    });
  });
}
