// Shared top bar for map and town screens.

import type { GameState } from '../core/state';
import { THEME } from './theme';
import { GAME_VERSION } from '../data/changelog';
import { hasNewItems } from '../systems/items';
import { drawNewItemHint } from './hud';
import { drawText } from './ui';

export const TOP_BAR_H = 44;

export function drawTopBar(ctx: CanvasRenderingContext2D, state: GameState, width: number, totalBosses: number, time = 0): void {
  ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
  ctx.fillRect(0, 0, width, TOP_BAR_H);
  ctx.strokeStyle = THEME.panelBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_BAR_H + 0.5);
  ctx.lineTo(width, TOP_BAR_H + 0.5);
  ctx.stroke();
  const y = TOP_BAR_H / 2;
  const h = state.hero;
  const items: [string, string][] = [
    ['День', String(state.day)],
    ['Золото', String(state.gold)],
    ['Рівень', String(h.level)],
    ['HP', `${Math.ceil(h.hp)}/${h.maxHp}`],
    ['Боси', `${state.bossesDefeated.length}/${totalBosses}`],
  ];
  let x = 18;
  for (const [label, value] of items) {
    drawText(ctx, label, x, y, { size: 13, color: THEME.textDim });
    ctx.font = `13px ${THEME.font}`;
    const lw = ctx.measureText(label).width;
    drawText(ctx, value, x + lw + 6, y, { size: 16, bold: true, color: label === 'Золото' ? THEME.accent : THEME.text });
    ctx.font = `bold 16px ${THEME.font}`;
    x += lw + 6 + ctx.measureText(value).width + 26;
  }
  drawText(ctx, `v${GAME_VERSION}`, width - 16, y, { size: 13, color: THEME.textMuted, align: 'right' });
  if (hasNewItems(state.hero)) drawNewItemHint(ctx, width - 150, y, time, 'right');
}
