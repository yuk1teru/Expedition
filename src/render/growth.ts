// Town growth window (ROADMAP 15.4): the town's levels — what each gives and costs — and
// "Вкласти" for the next one.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { TOWN_GROWTH } from '../data/growth';
import { fillNames } from '../data/names';
import { getNode } from '../systems/mapgen';
import { invest, nextGrowth, townLevel } from '../systems/growth';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, wrapLines } from './ui';

const PANEL = { x: 150, y: 60, w: 660, h: 420 };

export function createGrowthModal(app: App, townId: string, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const def = TOWN_GROWTH[townId];
  let flash = '';
  let flashTime = 0;
  const investBtn = new Button({
    label: 'Вкласти',
    rect: { x: PANEL.x + PANEL.w / 2 - 150, y: PANEL.y + PANEL.h - 96, w: 300, h: 38 },
    hotkey: 'Enter',
    fontSize: 15,
    onClick: () => {
      const next = nextGrowth(app.state, townId);
      if (next && invest(app.state, townId)) {
        flash = `Збудовано: ${next.name}`;
        flashTime = 2;
      }
    },
  });
  const closeBtn = new Button({ label: 'Назад [Esc]', rect: { x: PANEL.x + PANEL.w / 2 - 90, y: PANEL.y + PANEL.h - 48, w: 180, h: 32 }, hotkey: 'Escape', fontSize: 14, onClick: onClose });
  const buttons = new ButtonGroup([investBtn, closeBtn]);
  return {
    id: 'growth',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      const next = nextGrowth(app.state, townId);
      investBtn.enabled = !!next && app.state.gold >= next.cost;
      investBtn.label = next ? `Вкласти ${next.cost} зол.: ${next.name}` : 'Місто розбудовано повністю';
    },
    onInput(e: InputEvent) {
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.78)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(24, 28, 22, 0.98)', '#7a9a5a');
      drawText(ctx, `Розвиток: ${getNode(st.world, townId).name}`, PANEL.x + PANEL.w / 2, PANEL.y + 28, { size: 22, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 28, { size: 15, bold: true, align: 'right', color: THEME.accent });
      const level = townLevel(st, townId);
      (def?.levels ?? []).forEach((l, i) => {
        const y = PANEL.y + 70 + i * 84;
        const done = i < level;
        const color = done ? THEME.good : i === level ? THEME.accent : THEME.textDim;
        drawText(ctx, `${done ? '✔' : `${i + 1}.`} ${l.name} — ${l.cost} зол.`, PANEL.x + 30, y, { size: 16, bold: true, color });
        ctx.font = `13px ${THEME.font}`;
        wrapLines(ctx, fillNames(l.text), PANEL.w - 60).forEach((line, k) => drawText(ctx, line, PANEL.x + 30, y + 22 + k * 18, { size: 13, color: done ? THEME.text : THEME.textDim }));
      });
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 110, { size: 14, bold: true, align: 'center', color: THEME.good });
        ctx.globalAlpha = 1;
      }
    },
  };
}
