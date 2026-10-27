// The tutorial hint banner (ROADMAP 11.4): a line at the top of the screen that fades out.

import { THEME, font } from './theme';
import { drawText, roundRect, wrapLines } from './ui';

/** How long a hint stays, s. */
export const HINT_SECONDS = 8;

export function drawHint(ctx: CanvasRenderingContext2D, W: number, _H: number, text: string, timeLeft: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, timeLeft);
  ctx.font = font(15, 'bold');
  const lines = wrapLines(ctx, text, 620);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40;
  const h = lines.length * 21 + 18;
  const x = W / 2 - w / 2;
  const y = 92;
  ctx.fillStyle = 'rgba(14, 18, 28, 0.92)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  lines.forEach((l, i) => drawText(ctx, l, W / 2, y + 19 + i * 21, { size: 15, bold: true, align: 'center', color: THEME.text }));
  ctx.restore();
}
