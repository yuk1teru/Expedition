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
  const y = 50;
  const w = 196;
  const bh = 26;
  const gap = 4;
  const st = (): typeof app.state => app.state;
  // [label, action, on/off state for switches] (ROADMAP 10.8).
  const actions: [string, () => void, (() => boolean)?][] = [
    ['+1 рівень', () => app.debugLevelUp()],
    ['+1000 золота', () => (st().gold += 1000)],
    ['Вбити всіх', () => app.debugKillAll()],
    ['Безсмертя', () => (st().hero.immortal = !st().hero.immortal), () => st().hero.immortal],
    ['Перейти до боса', () => app.debugGoBoss()],
    ['Скинути локацію', () => app.debugResetLocation()],
    ['Вільні переходи', () => (st().freeTravel = !st().freeTravel), () => !!st().freeTravel],
    ['+5 днів', () => (st().day += 5)],
    ['Без туману', () => (st().noFog = !st().noFog), () => !!st().noFog],
    ['Тарадайка даром', () => (st().freeCoach = !st().freeCoach), () => !!st().freeCoach],
    ['Без навали', () => (st().noInvasion = !st().noInvasion), () => !!st().noInvasion],
    ['Нескінченні життя', () => (st().infiniteLives = !st().infiniteLives), () => !!st().infiniteLives],
  ];
  const buttons = new ButtonGroup(
    actions.map(
      ([label, fn], i) =>
        new Button({ label, rect: { x: x + 10, y: y + 34 + i * (bh + gap), w: w - 20, h: bh }, fontSize: 12, onClick: fn }),
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
      drawText(ctx, `seed ${app.state.seed}`, x + w - 12, y + 18, { size: 11, color: THEME.textMuted, align: 'right' });
      actions.forEach(([label, , on], i) => {
        const btn = buttons.buttons[i];
        if (btn && on) btn.label = `${label}: ${on() ? 'так' : 'ні'}`;
      });
      buttons.draw(ctx);
      drawText(ctx, '` — закрити', x + 12, y + h - 14, { size: 11, color: THEME.textMuted });
    },
  };
  return panel;
}
