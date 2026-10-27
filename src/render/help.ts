// "Як грати": controls shown before the game starts and on the pause screen.

import type { InputEvent } from '../core/input';
import { PROGRESSION } from '../data/balance';
import type { Modal } from '../core/screens';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

export const CONTROLS: [string, string][] = [
  ['WASD / стрілки', 'рух героя'],
  ['Миша', 'напрямок автоатаки й скілів'],
  ['1–5 або клік по слоту', 'скіли класу; що на панелі — у дереві (T)'],
  ['R / F', `скіли гілки (з ${PROGRESSION.promotionLevel} і ${PROGRESSION.promotion2Level} рівня)`],
  ['T', 'дерево талантів (поза боєм)'],
  ['Q', 'лучник: перемкнути стріли (стихію)'],
  ['N', 'одразу наступна хвиля (у перерві)'],
  ['Shift', 'ривок черевиків у напрямку руху (зелені й кращі)'],
  ['Z / X / C', 'трава й зілля (що на слотах — обирається в інвентарі)'],
  ['Tab', 'інвентар (речі, сумка); Shift над річчю — порівняти'],
  ['J', 'журнал квестів'],
  ['Esc', 'пауза'],
  ['Кнопка ×1/×2', 'швидкість гри'],
];

/** Draws the controls table; returns its height. */
export function drawControls(ctx: CanvasRenderingContext2D, cx: number, y: number, size = 15, lh = 26, color: string = THEME.text): number {
  CONTROLS.forEach(([key, action], i) => {
    const yy = y + i * lh;
    drawText(ctx, key, cx - 10, yy, { size, bold: true, align: 'right', color: THEME.accent });
    drawText(ctx, action, cx + 10, yy, { size, color });
  });
  return CONTROLS.length * lh;
}

export function createHelpModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 330, y: 40, w: 660, h: 460 };
  const buttons = new ButtonGroup([
    new Button({
      label: 'Почати',
      rect: { x: W / 2 - 110, y: panel.y + panel.h - 66, w: 220, h: 46 },
      hotkey: 'Enter',
      onClick: onClose,
    }),
    new Button({
      label: 'Вікі гри ↗',
      rect: { x: panel.x + panel.w - 150, y: panel.y + panel.h - 58, w: 130, h: 32 },
      fontSize: 14,
      onClick: openWiki,
    }),
  ]);
  return {
    id: 'help',
    update() {},
    onInput(e: InputEvent) {
      if (e.type === 'key' && (e.code === 'Space' || e.code === 'Escape')) {
        onClose();
        return;
      }
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel, 'rgba(20, 23, 33, 0.98)');
      drawText(ctx, 'Як грати', W / 2, panel.y + 34, { size: 26, bold: true, align: 'center' });
      drawText(ctx, 'Ідіть углиб світу, качайте героя, збирайте речі й переможіть 4 босів на його краях.', W / 2, panel.y + 66, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });
      drawText(ctx, 'У героя 3 життя: смерть забирає одне й повертає до останнього відпочинку в місті.', W / 2, panel.y + 88, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });
      // Keys are short, actions long: the divider sits left of centre so both fit the panel.
      drawControls(ctx, W / 2 - 90, panel.y + 126, 15, 24);
      buttons.draw(ctx);
    },
  };
}

/** The wiki (wiki.html next to the game) in a new tab. */
export function openWiki(): void {
  window.open('./wiki.html', '_blank', 'noopener');
}
