// Equipment screen (from the town): worn items by slot and the bag; click a bag item to wear it.

import type { InputEvent } from '../core/input';
import type { Screen } from '../core/screens';
import { ITEM_SLOTS, RARITIES } from '../data/items';
import { type Item, equipFromBag, formatStat } from '../systems/items';
import type { App } from './app';
import { THEME } from './theme';
import { TOP_BAR_H, drawTopBar } from './topBar';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, inRect, roundRect } from './ui';

const ROW_H = 58;
const BAG_ROWS = 5;

export function createGearScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const left: Rect = { x: 30, y: TOP_BAR_H + 50, w: 430, h: ITEM_SLOTS.length * ROW_H + 40 };
  const right: Rect = { x: 490, y: TOP_BAR_H + 50, w: 440, h: BAG_ROWS * ROW_H + 40 };
  const bagRows: Rect[] = Array.from({ length: BAG_ROWS }, (_, i) => ({
    x: right.x + 12,
    y: right.y + 34 + i * ROW_H,
    w: right.w - 24,
    h: ROW_H - 6,
  }));
  let hover = -1;
  const buttons = new ButtonGroup([
    new Button({
      label: 'Назад до міста',
      rect: { x: W / 2 - 120, y: app.view.height - 60, w: 240, h: 44 },
      hotkey: 'Escape',
      onClick: () => app.goTown(),
    }),
  ]);

  return {
    update() {},
    onInput(e: InputEvent) {
      if (e.type === 'mousemove') hover = bagRows.findIndex((r) => inRect(r, e.x, e.y));
      if (e.type === 'mousedown') {
        const i = bagRows.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0 && app.state.hero.bag[i]) {
          equipFromBag(app.state.hero, i);
          return;
        }
      }
      buttons.handle(e);
    },
    render(ctx) {
      const hero = app.state.hero;
      ctx.fillStyle = '#16131a';
      ctx.fillRect(0, 0, W, app.view.height);
      drawText(ctx, 'Спорядження', W / 2, TOP_BAR_H + 24, { size: 24, bold: true, align: 'center' });

      drawPanel(ctx, left);
      drawText(ctx, 'Вдягнуто', left.x + 16, left.y + 18, { size: 14, bold: true, color: THEME.accent });
      ITEM_SLOTS.forEach((slot, i) => {
        const r = { x: left.x + 12, y: left.y + 34 + i * ROW_H, w: left.w - 24, h: ROW_H - 6 };
        const item = hero.equipment[slot.id];
        drawItemRow(ctx, r, slot.name, item ?? null, false);
      });

      drawPanel(ctx, right);
      drawText(ctx, `Сумка (${hero.bag.length})`, right.x + 16, right.y + 18, { size: 14, bold: true, color: THEME.accent });
      drawText(ctx, 'клік — вдягнути', right.x + right.w - 16, right.y + 18, { size: 12, align: 'right', color: THEME.textDim });
      if (hero.bag.length === 0) {
        drawText(ctx, 'Порожньо. Речі падають з мінібосів і босів.', right.x + right.w / 2, right.y + 90, {
          size: 14,
          align: 'center',
          color: THEME.textDim,
        });
      }
      bagRows.forEach((r, i) => {
        const item = hero.bag[i];
        if (!item) return;
        const slotName = ITEM_SLOTS.find((s) => s.id === item.slot)?.name ?? '';
        drawItemRow(ctx, r, slotName, item, hover === i);
      });
      if (hero.bag.length > BAG_ROWS) {
        drawText(ctx, `…і ще ${hero.bag.length - BAG_ROWS}`, right.x + right.w / 2, right.y + right.h - 10, { size: 12, align: 'center', color: THEME.textDim });
      }

      const s = hero.stats;
      const summary = [
        `HP ${hero.maxHp}`,
        `Атака ${Math.round(s.attack)}`,
        `Броня ${Math.round(s.armor)}`,
        `Крит ${Math.round(s.critChance * 100)}%`,
        `Атак/с ${s.attackSpeed.toFixed(2)}`,
        `Рух ${Math.round(s.moveSpeed)}`,
      ].join('   ·   ');
      drawText(ctx, summary, W / 2, left.y + Math.max(left.h, right.h) + 22, { size: 14, align: 'center', color: THEME.text });
      buttons.draw(ctx);
      drawTopBar(ctx, app.state, W, app.totalBosses());
    },
  };
}

function drawItemRow(ctx: CanvasRenderingContext2D, r: Rect, slotName: string, item: Item | null, hovered: boolean): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = hovered ? '#2d3650' : '#20263a';
  ctx.fill();
  if (item) {
    ctx.strokeStyle = RARITIES[item.rarity].color;
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    ctx.stroke();
  }
  drawText(ctx, slotName, r.x + 12, r.y + 15, { size: 11, color: THEME.textDim });
  if (!item) {
    drawText(ctx, '— порожньо —', r.x + 12, r.y + 35, { size: 14, color: THEME.textMuted });
    return;
  }
  drawText(ctx, item.name, r.x + 12, r.y + 35, { size: 15, bold: true, color: RARITIES[item.rarity].color });
  drawText(ctx, RARITIES[item.rarity].name, r.x + r.w - 12, r.y + 15, { size: 11, align: 'right', color: RARITIES[item.rarity].color });
  drawText(ctx, item.stats.map(formatStat).join(', '), r.x + r.w - 12, r.y + 35, { size: 12, align: 'right', color: THEME.good });
}
