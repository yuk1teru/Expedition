// Town screen: rest (full heal) and set out.

import type { Screen } from '../core/screens';
import { restInTown } from '../systems/run';
import type { App } from './app';
import { THEME } from './theme';
import { TOP_BAR_H, drawTopBar } from './topBar';
import { Button, ButtonGroup, drawBar, drawPanel, drawText } from './ui';

export function createTownScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 220, y: 90, w: 440, h: 400 };
  let restedFlash = 0;
  const buttons = new ButtonGroup([
    new Button({
      label: 'Відпочити',
      rect: { x: panel.x + 60, y: panel.y + 170, w: 320, h: 48 },
      hotkey: 'Digit1',
      onClick: () => {
        restInTown(app.state);
        restedFlash = 1.2;
      },
    }),
    new Button({
      label: 'Спорядження',
      rect: { x: panel.x + 60, y: panel.y + 232, w: 320, h: 48 },
      hotkey: 'Digit2',
      onClick: () => app.toggleInventory(),
    }),
    new Button({
      label: 'Вирушити',
      rect: { x: panel.x + 60, y: panel.y + 294, w: 320, h: 48 },
      hotkey: 'Digit3',
      onClick: () => app.goMap(),
    }),
  ]);

  return {
    enter() {
      restedFlash = 0;
    },
    update(dt) {
      restedFlash = Math.max(0, restedFlash - dt);
    },
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      const state = app.state;
      const hero = state.hero;
      ctx.fillStyle = '#16131a';
      ctx.fillRect(0, 0, W, app.view.height);
      drawSkyline(ctx, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, 'Місто', W / 2, panel.y + 40, { size: 30, bold: true, align: 'center' });
      drawText(ctx, 'Тут безпечно. Відпочиньте перед дорогою.', W / 2, panel.y + 76, {
        size: 15,
        align: 'center',
        color: THEME.textDim,
      });
      drawBar(
        ctx,
        { x: panel.x + 60, y: panel.y + 108, w: 320, h: 22 },
        hero.hp / hero.maxHp,
        THEME.hp,
        THEME.hpBack,
        `HP ${Math.ceil(hero.hp)} / ${hero.maxHp}`,
      );
      if (restedFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, restedFlash);
        drawText(ctx, 'HP відновлено · прогрес збережено', W / 2, panel.y + 148, { size: 14, align: 'center', color: THEME.good, bold: true });
        ctx.restore();
      }
      buttons.draw(ctx);
      drawText(ctx, '1 — відпочити (чекпоінт) · 2 / Tab — спорядження · 3 — вирушити', W / 2, panel.y + panel.h - 20, {
        size: 12,
        align: 'center',
        color: THEME.textMuted,
      });
      drawTopBar(ctx, state, W, app.totalBosses());
    },
  };
}

function drawSkyline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, TOP_BAR_H, 0, h);
  g.addColorStop(0, '#231d33');
  g.addColorStop(1, '#3a2a2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, TOP_BAR_H, w, h - TOP_BAR_H);
  ctx.fillStyle = '#120f16';
  const base = h - 40;
  const houses = [
    [20, 90, 80],
    [110, 60, 120],
    [190, 110, 70],
    [700, 80, 100],
    [790, 120, 70],
    [870, 70, 90],
  ];
  for (const [x, hh, ww] of houses as [number, number, number][]) {
    ctx.fillRect(x, base - hh, ww, hh + 40);
    ctx.beginPath();
    ctx.moveTo(x - 6, base - hh);
    ctx.lineTo(x + ww / 2, base - hh - 30);
    ctx.lineTo(x + ww + 6, base - hh);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(242, 193, 78, 0.6)';
  for (const [x, hh, ww] of houses as [number, number, number][]) {
    ctx.fillRect(x + ww / 2 - 6, base - hh + 24, 12, 14);
  }
}
