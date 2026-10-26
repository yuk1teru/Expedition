// Reward, death and victory screens.

import type { Screen } from '../core/screens';
import type { App } from './app';
import { className } from './names';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function rows(ctx: CanvasRenderingContext2D, items: [string, string][], x: number, y: number, w: number): void {
  items.forEach(([k, v], i) => {
    const yy = y + i * 30;
    drawText(ctx, k, x, yy, { size: 16, color: THEME.textDim });
    drawText(ctx, v, x + w, yy, { size: 17, bold: true, align: 'right' });
  });
}

export function createRewardScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 210, y: 90, w: 420, h: 360 };
  const buttons = new ButtonGroup([
    new Button({
      label: 'Продовжити',
      rect: { x: panel.x + 80, y: panel.y + panel.h - 72, w: 260, h: 48 },
      hotkey: 'Enter',
      onClick: () => app.goMap(),
    }),
  ]);
  let t = 0;
  return {
    enter() {
      t = 0;
    },
    update(dt) {
      t += dt;
    },
    onInput(e) {
      if (e.type === 'key' && e.code === 'Space') {
        app.goMap();
        return;
      }
      buttons.handle(e);
    },
    render(ctx) {
      const s = app.lastSummary;
      ctx.fillStyle = THEME.bg;
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, 'Локацію зачищено!', W / 2, panel.y + 40, { size: 26, bold: true, align: 'center', color: THEME.good });
      drawText(ctx, s?.nodeName ?? '', W / 2, panel.y + 72, { size: 15, align: 'center', color: THEME.textDim });
      if (s) {
        const items: [string, string][] = [
          ['Досвід', `+${s.xp}`],
          ['Золото', `+${s.gold}  (бонус ${s.clearBonus})`],
          ['Вбито ворогів', String(s.kills)],
          ['Отримано шкоди', String(Math.round(s.damageTaken))],
          ['День', String(app.state.day)],
        ];
        rows(ctx, items, panel.x + 50, panel.y + 116, panel.w - 100);
      }
      // Level-up ring on the reward screen if the hero levelled in the fight.
      if (t < 1 && (s?.xp ?? 0) > 0) {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = THEME.xp;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, panel.y + 40, 60 + t * 140, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      buttons.draw(ctx);
    },
  };
}

export function createDeathScreen(app: App): Screen<CanvasRenderingContext2D> {
  return createRunEndScreen(app, false);
}

export function createVictoryScreen(app: App): Screen<CanvasRenderingContext2D> {
  return createRunEndScreen(app, true);
}

function createRunEndScreen(app: App, victory: boolean): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 250, y: 40, w: 500, h: 460 };
  const buttons = new ButtonGroup([
    new Button({
      label: 'Новий забіг',
      rect: { x: panel.x + 120, y: panel.y + panel.h - 68, w: 260, h: 48 },
      hotkey: 'Enter',
      onClick: () => app.newRun(),
    }),
  ]);
  return {
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      const hero = st.hero;
      ctx.fillStyle = victory ? '#14201a' : '#1d1214';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, victory ? 'Перемога!' : 'Експедицію завершено', W / 2, panel.y + 42, {
        size: 30,
        bold: true,
        align: 'center',
        color: victory ? THEME.good : THEME.bad,
      });
      drawText(ctx, victory ? 'Усіх босів переможено. Експедиція вдалася!' : 'Герой загинув у дорозі.', W / 2, panel.y + 76, {
        size: 15,
        align: 'center',
        color: THEME.textDim,
      });
      const items: [string, string][] = [
        ['Днів', String(st.day)],
        ['Рівень', String(hero.level)],
        ['Клас', className(hero.classId)],
        ['Вбито ворогів', String(st.stats.kills)],
        ['Нанесено шкоди', String(Math.round(st.stats.damageDealt))],
        ['Переможено босів', `${st.bossesDefeated.length}/${app.totalBosses()}`],
        ['Час гри', formatTime(st.stats.playTime)],
        ['Seed', String(st.seed)],
      ];
      rows(ctx, items, panel.x + 60, panel.y + 112, panel.w - 120);
      if (victory) {
        const skills = app.skillSummary();
        drawText(ctx, skills, W / 2, panel.y + 112 + items.length * 30 + 4, {
          size: 13,
          align: 'center',
          color: THEME.accent,
        });
      }
      buttons.draw(ctx);
    },
  };
}
