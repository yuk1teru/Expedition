// The stash (ROADMAP 14.7): one for all towns. The bag on the left, the stash on the right;
// a click moves an item across.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { RARITIES, STASH } from '../data/items';
import { fromStash, type Item, toStash } from '../systems/items';
import type { App } from './app';
import { drawBagItemTooltip } from './inventory';
import { drawItem } from './itemArt';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, inRect, roundRect } from './ui';

const PANEL = { x: 30, y: 22, w: 900, h: 496 };
const CELL = 52;
const BAG = { x: PANEL.x + 24, y: PANEL.y + 96, cols: 6, rows: 6 };
const ST = { x: PANEL.x + 420, y: PANEL.y + 96, cols: 8, rows: 5 };

const cellOf = (g: typeof BAG, i: number): Rect => ({ x: g.x + (i % g.cols) * CELL, y: g.y + Math.floor(i / g.cols) * CELL, w: CELL - 6, h: CELL - 6 });

export function createStashModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  let flash = '';
  let flashTime = 0;
  const closeBtn = new Button({
    label: 'Назад [Esc]',
    rect: { x: PANEL.x + PANEL.w / 2 - 90, y: PANEL.y + PANEL.h - 44, w: 180, h: 32 },
    hotkey: 'Escape',
    fontSize: 14,
    onClick: onClose,
  });
  const buttons = new ButtonGroup([closeBtn]);
  const at = (g: typeof BAG, list: Item[], x: number, y: number): number => {
    for (let i = 0; i < list.length && i < g.cols * g.rows; i++) if (inRect(cellOf(g, i), x, y)) return i;
    return -1;
  };
  return {
    id: 'stash',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
    },
    onInput(e: InputEvent) {
      if (e.type === 'key' && e.code === 'KeyB') {
        onClose();
        return;
      }
      if (e.type === 'mousedown' && e.button === 0) {
        const st = app.state;
        const bi = at(BAG, st.hero.bag, e.x, e.y);
        if (bi >= 0) {
          if (!toStash(st, bi)) {
            flash = `Сховище повне (${STASH.size})`;
            flashTime = 1.8;
          }
          return;
        }
        const si = at(ST, st.stash, e.x, e.y);
        if (si >= 0) {
          fromStash(st, si);
          return;
        }
      }
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(22, 24, 30, 0.98)');
      drawText(ctx, 'Сховище', PANEL.x + PANEL.w / 2, PANEL.y + 24, { size: 22, bold: true, align: 'center' });
      drawText(ctx, 'Одне на всі міста. Клік по речі — перенести.', PANEL.x + PANEL.w / 2, PANEL.y + 50, { size: 12, align: 'center', color: THEME.textDim });
      drawText(ctx, `Сумка (${st.hero.bag.length})`, BAG.x, BAG.y - 14, { size: 14, bold: true, color: THEME.accent });
      drawText(ctx, `Сховище (${st.stash.length}/${STASH.size})`, ST.x, ST.y - 14, { size: 14, bold: true, color: THEME.accent });
      for (let i = 0; i < BAG.cols * BAG.rows; i++) cell(ctx, cellOf(BAG, i), st.hero.bag[i] ?? null);
      for (let i = 0; i < ST.cols * ST.rows; i++) cell(ctx, cellOf(ST, i), st.stash[i] ?? null);
      if (st.hero.bag.length > BAG.cols * BAG.rows) drawText(ctx, `…і ще ${st.hero.bag.length - BAG.cols * BAG.rows}`, BAG.x + BAG.cols * CELL - 6, BAG.y - 14, { size: 11, align: 'right', color: THEME.textDim });
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + 24, PANEL.y + PANEL.h - 28, { size: 13, bold: true, color: THEME.bad });
        ctx.globalAlpha = 1;
      }
      const m = app.input.mouse;
      const bi = at(BAG, st.hero.bag, m.x, m.y);
      const si = at(ST, st.stash, m.x, m.y);
      if (bi >= 0) drawBagItemTooltip(ctx, app, st.hero.bag[bi]!, ['Клік — у сховище'], st.hero, m);
      else if (si >= 0) drawBagItemTooltip(ctx, app, st.stash[si]!, ['Клік — у сумку'], st.hero, m);
    },
  };
}

function cell(ctx: CanvasRenderingContext2D, r: Rect, item: Item | null): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = item ? '#22283a' : '#1a1f2d';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = item ? RARITIES[item.rarity].color : THEME.panelBorder;
  ctx.stroke();
  if (item) drawItem(ctx, item, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62);
}
