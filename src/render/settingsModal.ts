// Settings window (ROADMAP 10.7): volume, screen shake, damage numbers and the controls.

import type { Modal } from '../core/screens';
import type { App } from './app';
import { CONTROLS } from './help';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

export function createSettingsModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  const panel = { x: W / 2 - 330, y: 24, w: 660, h: H - 48 };
  const s = (): typeof app.settings => app.settings;
  const rowY = (i: number): number => panel.y + 72 + i * 42;
  const toggle = (get: () => boolean, set: (v: boolean) => void, i: number): Button =>
    new Button({
      label: '',
      rect: { x: panel.x + panel.w - 200, y: rowY(i) - 17, w: 150, h: 34 },
      fontSize: 14,
      onClick: () => {
        set(!get());
        app.saveSettings();
      },
    });
  const shakeBtn = toggle(() => s().shake, (v) => (s().shake = v), 1);
  const numbersBtn = toggle(() => s().damageNumbers, (v) => (s().damageNumbers = v), 2);
  const volume = (d: number): void => {
    s().volume = Math.round(Math.max(0, Math.min(1, s().volume + d)) * 10) / 10;
    app.saveSettings();
  };
  const buttons = new ButtonGroup([
    new Button({ label: '−', rect: { x: panel.x + panel.w - 200, y: rowY(0) - 17, w: 40, h: 34 }, fontSize: 18, onClick: () => volume(-0.1) }),
    new Button({ label: '+', rect: { x: panel.x + panel.w - 90, y: rowY(0) - 17, w: 40, h: 34 }, fontSize: 18, onClick: () => volume(0.1) }),
    shakeBtn,
    numbersBtn,
    new Button({ label: 'Готово [Esc]', rect: { x: W / 2 - 90, y: panel.y + panel.h - 50, w: 180, h: 36 }, fontSize: 14, hotkey: 'Escape', onClick: onClose }),
  ]);
  return {
    id: 'settings',
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, panel);
      drawText(ctx, 'Налаштування', W / 2, panel.y + 30, { size: 22, bold: true, align: 'center' });
      shakeBtn.label = s().shake ? 'Увімкнено' : 'Вимкнено';
      numbersBtn.label = s().damageNumbers ? 'Увімкнено' : 'Вимкнено';
      const rows = ['Гучність (звук — згодом)', 'Тряска екрана', 'Цифри шкоди й лікування'];
      rows.forEach((r, i) => drawText(ctx, r, panel.x + 40, rowY(i), { size: 16 }));
      drawText(ctx, `${Math.round(s().volume * 100)}%`, panel.x + panel.w - 125, rowY(0), { size: 16, bold: true, align: 'center' });
      buttons.draw(ctx);
      // Controls (read-only for now).
      const top = rowY(3) + 10;
      drawText(ctx, 'Клавіші', panel.x + 40, top, { size: 16, bold: true, color: THEME.accent });
      CONTROLS.forEach(([key, what], i) => {
        const y = top + 24 + i * 18;
        drawText(ctx, key, panel.x + 40, y, { size: 12, bold: true });
        drawText(ctx, what, panel.x + 250, y, { size: 12, color: THEME.textDim });
      });
    },
  };
}
