// The artifact buyer's orders (ROADMAP 14.1а): every order with what it wants, what the
// bag holds, where to look and what he pays; a ready set is handed in with one button.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { fillNames } from '../data/names';
import { ARTIFACT_ORDERS, TROPHIES } from '../data/trophies';
import { completeOrder, orderOpen, orderProgress, trophyWhere } from '../systems/orders';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, drawTooltip, inRect } from './ui';

const PANEL = { x: 40, y: 22, w: 880, h: 496 };
const ROW_Y = PANEL.y + 64;
const ROW_H = 49;

export function createOrdersModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  let flash = '';
  let flashTime = 0;
  const giveButtons = ARTIFACT_ORDERS.map(
    (o, i) =>
      new Button({
        label: 'Віддати',
        rect: { x: PANEL.x + PANEL.w - 120, y: ROW_Y + i * ROW_H + 8, w: 100, h: 30 },
        fontSize: 13,
        onClick: () => {
          if (completeOrder(app.state, o.id)) {
            flash = `«${o.name}» — ${o.pay} зол.`;
            flashTime = 2;
          }
        },
      }),
  );
  const closeBtn = new Button({
    label: 'Назад [Esc]',
    rect: { x: PANEL.x + PANEL.w / 2 - 90, y: PANEL.y + PANEL.h - 42, w: 180, h: 32 },
    hotkey: 'Escape',
    fontSize: 14,
    onClick: onClose,
  });
  const buttons = new ButtonGroup([...giveButtons, closeBtn]);
  return {
    id: 'orders',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      ARTIFACT_ORDERS.forEach((o, i) => {
        const b = giveButtons[i]!;
        const open = orderOpen(app.state, o.id);
        b.enabled = open && orderProgress(app.state, o).ready;
        b.label = open ? 'Віддати' : 'Виконано';
      });
    },
    onInput(e: InputEvent) {
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(26, 20, 32, 0.98)', '#8a6aa4');
      drawText(ctx, 'Замовлення скупника', PANEL.x + PANEL.w / 2, PANEL.y + 24, { size: 22, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 24, { size: 15, bold: true, align: 'right', color: THEME.accent });
      drawText(ctx, 'Кожне замовлення — один раз. Торговець не купує те, що чекає скупник.', PANEL.x + 20, PANEL.y + 48, { size: 12, color: THEME.textDim });
      ARTIFACT_ORDERS.forEach((o, i) => {
        const y = ROW_Y + i * ROW_H;
        const open = orderOpen(st, o.id);
        const { have } = orderProgress(st, o);
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(PANEL.x + 10, y, PANEL.w - 20, ROW_H - 2);
        }
        ctx.globalAlpha = open ? 1 : 0.45;
        drawText(ctx, fillNames(o.name), PANEL.x + 20, y + 14, { size: 14, bold: true });
        drawText(ctx, `${o.pay} зол.`, PANEL.x + PANEL.w - 140, y + 23, { size: 15, bold: true, align: 'right', color: THEME.accent });
        const wants = o.wants.map((w, k) => `${fillNames(TROPHIES[w.trophy]?.name ?? w.trophy)} ${have[k]}/${w.count}`).join(' · ');
        drawText(ctx, wants, PANEL.x + 330, y + 14, { size: 12, color: open ? THEME.text : THEME.textDim });
        drawText(ctx, o.wants.map((w) => trophyWhere(st, w.trophy)).join(' · '), PANEL.x + 20, y + 34, { size: 11, color: THEME.textDim });
        ctx.globalAlpha = 1;
      });
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + 20, PANEL.y + PANEL.h - 26, { size: 14, bold: true, color: THEME.good });
        ctx.globalAlpha = 1;
      }
      // What Ізидор says about the order under the mouse.
      const m = app.input.mouse;
      ARTIFACT_ORDERS.forEach((o, i) => {
        const r = { x: PANEL.x + 10, y: ROW_Y + i * ROW_H, w: PANEL.w - 150, h: ROW_H - 2 };
        if (inRect(r, m.x, m.y)) drawTooltip(ctx, [fillNames(o.name), `«${fillNames(o.text)}»`], m.x, m.y, app.view.width, app.view.height);
      });
    },
  };
}
