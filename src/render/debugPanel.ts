// Dev-only debug panel (toggle with `).

import type { InputEvent } from '../core/input';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

export interface DebugPanel {
  open: boolean;
  handle(e: InputEvent): boolean;
  draw(ctx: CanvasRenderingContext2D): void;
}

export function createDebugPanel(app: App): DebugPanel {
  const x = app.view.width - 210;
  const y = 70;
  const w = 196;
  const bh = 30;
  const gap = 6;
  const actions: [string, () => void][] = [
    ['+1 рівень', () => app.debugLevelUp()],
    ['+1000 золота', () => (app.state.gold += 1000)],
    ['Вбити всіх', () => app.debugKillAll()],
    ['Безсмертя', () => (app.state.hero.immortal = !app.state.hero.immortal)],
    ['Перейти до боса', () => app.debugGoBoss()],
    ['Скинути гай', () => app.debugResetGrove()],
  ];
  const buttons = new ButtonGroup(
    actions.map(
      ([label, fn], i) =>
        new Button({ label, rect: { x: x + 10, y: y + 34 + i * (bh + gap), w: w - 20, h: bh }, fontSize: 13, onClick: fn }),
    ),
  );
  const panel = {
    open: false,
    handle(e: InputEvent): boolean {
      if (e.type === 'key' && e.code === 'Backquote') {
        panel.open = !panel.open;
        return true;
      }
      if (!panel.open) return false;
      return buttons.handle(e);
    },
    draw(ctx: CanvasRenderingContext2D): void {
      if (!panel.open) return;
      const h = 34 + actions.length * (bh + gap) + 30;
      drawPanel(ctx, { x, y, w, h }, 'rgba(8, 10, 14, 0.92)', THEME.accent);
      drawText(ctx, 'Дебаг', x + 12, y + 18, { size: 14, bold: true, color: THEME.accent });
      const immortalBtn = buttons.buttons[3];
      if (immortalBtn) immortalBtn.label = app.state.hero.immortal ? 'Безсмертя: так' : 'Безсмертя: ні';
      buttons.draw(ctx);
      drawText(ctx, '` — закрити', x + 12, y + h - 14, { size: 11, color: THEME.textMuted });
    },
  };
  return panel;
}
