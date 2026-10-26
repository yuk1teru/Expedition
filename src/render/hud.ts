// Combat HUD: HP, XP, level, class, gold, day, wave, pause and speed buttons.

import type { InputEvent } from '../core/input';
import { ARENA } from '../data/balance';
import type { Battle } from '../systems/battle';
import { isMaxLevel, xpFraction } from '../systems/leveling';
import { className } from './names';
import type { App } from './app';
import type { Fx } from './fx';
import { THEME } from './theme';
import { Button, ButtonGroup, drawBar, drawText } from './ui';

export interface Hud {
  reset(): void;
  update(dt: number): void;
  /** Returns true if the HUD consumed the input. */
  handle(e: InputEvent): boolean;
  draw(ctx: CanvasRenderingContext2D, b: Battle): void;
}

export function createHud(app: App, _fx: Fx): Hud {
  const W = app.view.width;
  const pauseBtn = new Button({
    label: 'Пауза',
    rect: { x: W - 152, y: 12, w: 76, h: 32 },
    fontSize: 14,
    onClick: () => (app.loop.paused = !app.loop.paused),
  });
  const speedBtn = new Button({
    label: '×1',
    rect: { x: W - 68, y: 12, w: 56, h: 32 },
    fontSize: 15,
    onClick: () => app.loop.toggleSpeed(),
  });
  const buttons = new ButtonGroup([pauseBtn, speedBtn]);

  return {
    reset() {},
    update() {},
    handle(e) {
      return buttons.handle(e);
    },
    draw(ctx, b) {
      const state = app.state;
      const hero = state.hero;
      // Top band.
      ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
      ctx.fillRect(0, 0, W, ARENA.y);
      ctx.fillRect(0, ARENA.y + ARENA.h, W, app.view.height - ARENA.y - ARENA.h);

      // Level badge.
      ctx.fillStyle = '#2a3145';
      ctx.beginPath();
      ctx.arc(32, 28, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, String(hero.level), 32, 29, { size: 18, bold: true, align: 'center' });

      drawBar(ctx, { x: 62, y: 9, w: 250, h: 20 }, hero.hp / hero.maxHp, THEME.hp, THEME.hpBack, `${Math.ceil(hero.hp)} / ${hero.maxHp}`);
      const xpLabel = isMaxLevel(hero.level) ? 'МАКС' : '';
      drawBar(ctx, { x: 62, y: 34, w: 250, h: 11 }, xpFraction(hero.level, hero.xp), THEME.xp, 'rgba(0,0,0,0.5)', xpLabel);
      drawText(ctx, className(hero.classId), 324, 19, { size: 15, bold: true, color: hero.classId ? THEME.text : THEME.textDim });
      drawText(ctx, `Атака ${Math.round(hero.stats.attack)}`, 324, 39, { size: 12, color: THEME.textDim });

      // Centre: wave / location.
      if (b.waves) {
        const w = b.waves;
        const idx = Math.min(w.total, w.index + 1);
        drawText(ctx, `Хвиля ${idx}/${w.total}`, W / 2, 20, { size: 17, bold: true, align: 'center' });
      }
      drawText(ctx, b.node.name, W / 2, 41, { size: 12, align: 'center', color: THEME.textDim });

      // Right: gold & day.
      drawText(ctx, `${state.gold}`, W - 240, 20, { size: 16, bold: true, align: 'right', color: THEME.accent });
      drawText(ctx, 'золото', W - 236, 20, { size: 11, color: THEME.textDim });
      drawText(ctx, `День ${state.day}`, W - 240, 40, { size: 12, align: 'right', color: THEME.textDim });

      pauseBtn.label = app.loop.paused ? 'Далі' : 'Пауза';
      speedBtn.label = `×${app.loop.speed}`;
      buttons.draw(ctx);

      drawText(ctx, 'Пробіл — пауза', W - 12, app.view.height - 12, { size: 11, align: 'right', color: THEME.textMuted });
    },
  };
}
