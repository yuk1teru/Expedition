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

/** A yes / no question (a soul to catch): [1] / Enter — yes, [2] / Esc — no. */
export function createConfirmModal(
  app: App,
  title: string,
  text: string,
  labels: [string, string],
  onAnswer: (yes: boolean) => void,
  color: string = THEME.accent,
): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 280, y: 140, w: 560, h: 250 };
  const buttons = new ButtonGroup([
    new Button({ label: `${labels[0]} [1]`, rect: { x: W / 2 - 220, y: panel.y + panel.h - 60, w: 210, h: 42 }, hotkey: 'Digit1', onClick: () => onAnswer(true) }),
    new Button({ label: `${labels[1]} [2]`, rect: { x: W / 2 + 10, y: panel.y + panel.h - 60, w: 210, h: 42 }, hotkey: 'Digit2', onClick: () => onAnswer(false) }),
  ]);
  return {
    id: 'confirm',
    update() {},
    onInput(e) {
      if (e.type === 'key' && e.code === 'Escape') onAnswer(false);
      else if (e.type === 'key' && e.code === 'Enter') onAnswer(true);
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

/** One of two named options ([1] / [2]); no way around it (a level-22 branch boost). */
export function createChoiceModal(app: App, title: string, options: [{ name: string; text: string }, { name: string; text: string }], onPick: (index: number) => void, color: string = THEME.accent): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 330, y: 110, w: 660, h: 300 };
  const buttons = new ButtonGroup(
    options.map(
      (o, i) => new Button({ label: `${o.name} [${i + 1}]`, rect: { x: W / 2 - 310 + i * 320, y: panel.y + panel.h - 60, w: 300, h: 42 }, hotkey: `Digit${i + 1}`, fontSize: 14, onClick: () => onPick(i) }),
    ),
  );
  return {
    id: 'confirm',
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel, THEME.panel, color);
      drawText(ctx, fillNames(title), W / 2, panel.y + 32, { size: 22, bold: true, align: 'center', color });
      ctx.font = `14px ${THEME.font}`;
      options.forEach((o, i) => {
        const x = W / 2 - 160 + i * 320;
        drawText(ctx, o.name, x, panel.y + 80, { size: 16, bold: true, align: 'center' });
        wrapLines(ctx, fillNames(o.text), 280).forEach((l, k) => drawText(ctx, l, x, panel.y + 108 + k * 20, { size: 14, align: 'center', color: THEME.textDim }));
      });
      buttons.draw(ctx);
    },
  };
}
