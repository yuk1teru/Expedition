// A message window: a title, a text and "Зрозуміло" (invasion thresholds and other news).

import type { Modal } from '../core/screens';
import { fillNames } from '../data/names';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, wrapLines } from './ui';

export function createNoticeModal(app: App, title: string, text: string, onClose: () => void, color: string = THEME.bad): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 260, y: 150, w: 520, h: 230 };
  const buttons = new ButtonGroup([
    new Button({ label: 'Зрозуміло', rect: { x: W / 2 - 90, y: panel.y + panel.h - 58, w: 180, h: 40 }, hotkey: 'Enter', onClick: onClose }),
  ]);
  return {
    id: 'notice',
    update() {},
    onInput(e) {
      if (e.type === 'key' && e.code === 'Escape') onClose();
      else buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel, THEME.panel, color);
      drawText(ctx, fillNames(title), W / 2, panel.y + 32, { size: 22, bold: true, align: 'center', color });
      ctx.font = `15px ${THEME.font}`;
      wrapLines(ctx, fillNames(text), panel.w - 60).forEach((l, i) => drawText(ctx, l, W / 2, panel.y + 72 + i * 22, { size: 15, align: 'center' }));
      buttons.draw(ctx);
    },
  };
}
