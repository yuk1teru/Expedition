// Between the arenas of a location (ROADMAP 13.2): what the arena gave, the hero's HP (it
// heals only in town), and the way on — the next arena, or a fork of two; or back to the map.

import type { Modal } from '../core/screens';
import { stepName, stepText } from '../data/expedition';
import type { ArenaStep } from '../systems/expedition';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, wrapLines } from './ui';

export function createWayOnModal(app: App, options: ArenaStep[], rewards: string[], onPick: (choice: number | null) => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 300, y: 80, w: 600, h: 360 };
  const fork = options.length > 1;
  const bw = fork ? 260 : 400;
  const buttons = new ButtonGroup([
    ...options.map(
      (o, i) =>
        new Button({
          label: `${stepName(o)} [${i + 1}]`,
          rect: { x: fork ? W / 2 - 270 + i * 280 : W / 2 - 200, y: panel.y + 180, w: bw, h: 44 },
          hotkey: `Digit${i + 1}`,
          fontSize: 16,
          onClick: () => onPick(i),
        }),
    ),
    new Button({ label: 'Повернутися на карту (локацію не пройдено)', rect: { x: W / 2 - 200, y: panel.y + panel.h - 56, w: 400, h: 34 }, fontSize: 13, onClick: () => onPick(null) }),
  ]);
  return {
    id: 'wayOn',
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      const hero = app.state.hero;
      const exp = app.state.expedition;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, `${stepName(exp?.current ?? { kind: 'entrance' })}: пройдено`, W / 2, panel.y + 30, { size: 22, bold: true, align: 'center', color: THEME.good });
      if (rewards.length > 0) drawText(ctx, `Нагорода: ${rewards.join(' · ')}`, W / 2, panel.y + 60, { size: 14, align: 'center', color: THEME.accent });
      const low = hero.hp < hero.maxHp * 0.4;
      drawText(ctx, `HP ${Math.ceil(hero.hp)}/${hero.maxHp} — лікуватися можна лише зіллям чи в місті`, W / 2, panel.y + 86, { size: 13, align: 'center', color: low ? THEME.bad : THEME.textDim });
      drawText(ctx, fork ? 'Розвилка: оберіть, куди далі' : 'Далі:', W / 2, panel.y + 120, { size: 15, bold: true, align: 'center' });
      options.forEach((o, i) => {
        const x = fork ? W / 2 - 140 + i * 280 : W / 2;
        ctx.font = `12px ${THEME.font}`;
        wrapLines(ctx, stepText(o), bw - 10).forEach((l, k) => drawText(ctx, l, x, panel.y + 240 + k * 16, { size: 12, align: 'center', color: THEME.textDim }));
      });
      buttons.draw(ctx);
    },
  };
}
