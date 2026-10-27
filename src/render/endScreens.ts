// Reward, death and victory screens.

import type { Screen } from '../core/screens';
import { RARITIES } from '../data/items';
import { type Item, displayName, formatStat } from '../systems/items';
import type { BattleSummary } from '../systems/run';
import type { App } from './app';
import { className } from './names';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function rows(ctx: CanvasRenderingContext2D, items: [string, string][], x: number, y: number, w: number, step = 30): void {
  items.forEach(([k, v], i) => {
    const yy = y + i * step;
    drawText(ctx, k, x, yy, { size: 16, color: THEME.textDim });
    drawText(ctx, v, x + w, yy, { size: 17, bold: true, align: 'right' });
  });
}

/** Loot lines: name in rarity colour and its stats; returns the height used. */
function lootLines(ctx: CanvasRenderingContext2D, loot: Item[], cx: number, y: number, equippedUids: Set<number>, step = 20): number {
  if (loot.length === 0) return 0;
  drawText(ctx, 'Здобич', cx, y, { size: 14, bold: true, align: 'center', color: THEME.accent });
  loot.forEach((item, i) => {
    const yy = y + 22 + i * step;
    const where = equippedUids.has(item.uid) ? 'вдягнуто' : 'у сумці';
    const desc = item.identified ? item.stats.map(formatStat).join(', ') : 'не розпізнано';
    drawText(ctx, `${displayName(item)} — ${desc} (${where})`, cx, yy, {
      size: 13,
      align: 'center',
      color: RARITIES[item.rarity].color,
      bold: true,
    });
  });
  return 22 + loot.length * step;
}

function wornUids(app: App): Set<number> {
  return new Set(
    Object.values(app.state.hero.equipment)
      .filter((x): x is Item => !!x)
      .map((x) => x.uid),
  );
}

/** Mandatory and cleared waves of a wave location (none for the boss lair). */
function waveRows(s: BattleSummary): [string, string][] {
  if (s.wavesCleared <= 0 && s.mandatoryWaves <= 0) return [];
  const range = s.wavesCleared > 0 ? ` (${s.firstWave}–${s.lastWave})` : '';
  return [
    ['Обов’язкових хвиль', String(s.mandatoryWaves)],
    ['Пройдено хвиль', `${s.wavesCleared}${range}`],
  ];
}

export function createRewardScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 250, y: 16, w: 500, h: 508 };
  const buttons = new ButtonGroup([
    new Button({
      label: 'Продовжити',
      rect: { x: panel.x + 120, y: panel.y + panel.h - 64, w: 260, h: 46 },
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
      drawText(ctx, 'Локацію пройдено!', W / 2, panel.y + 36, { size: 26, bold: true, align: 'center', color: THEME.good });
      drawText(ctx, s?.nodeName ?? '', W / 2, panel.y + 66, { size: 15, align: 'center', color: THEME.textDim });
      if (s) {
        const items: [string, string][] = [
          ['Досвід', `+${s.xp}`],
          ['Золото', `+${s.gold}  (бонус ${s.clearBonus})`],
          ['Вбито ворогів', String(s.kills)],
          ...waveRows(s),
          ['Отримано шкоди', String(Math.round(s.damageTaken))],
          ['День', String(app.state.day)],
        ];
        rows(ctx, items, panel.x + 60, panel.y + 100, panel.w - 120, 25);
        lootLines(ctx, s.loot, W / 2, panel.y + 100 + items.length * 25 + 2, wornUids(app), 18);
      }
      // Level-up ring on the reward screen if the hero levelled in the fight.
      if (t < 1 && (s?.xp ?? 0) > 0) {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = THEME.xp;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, panel.y + 36, 60 + t * 140, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      buttons.draw(ctx);
    },
  };
}

/** Death is not the end of the run: the hero returns to the last rest in town. */
export function createDeathScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 250, y: 50, w: 500, h: 440 };
  const buttons = new ButtonGroup([
    new Button({
      label: 'Повернутися до міста',
      rect: { x: panel.x + 100, y: panel.y + panel.h - 118, w: 300, h: 48 },
      hotkey: 'Enter',
      onClick: () => app.respawn(),
    }),
    new Button({
      label: 'Новий герой',
      rect: { x: panel.x + 150, y: panel.y + panel.h - 60, w: 200, h: 38 },
      fontSize: 14,
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
      const cp = st.checkpoint;
      ctx.fillStyle = '#1d1214';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, 'Ви загинули', W / 2, panel.y + 40, { size: 30, bold: true, align: 'center', color: THEME.bad });
      drawText(ctx, 'Пригода триває: герой прокинеться в місті з прогресом останнього візиту туди.', W / 2, panel.y + 74, {
        size: 13,
        align: 'center',
        color: THEME.textDim,
      });
      const lost = app.lastSummary;
      const items: [string, string][] = [
        ['Чекпоінт: рівень', String(cp.hero.level)],
        ['Чекпоінт: день', String(cp.day)],
        ['Чекпоінт: золото', String(cp.gold)],
        ['Чекпоінт: речей', String(Object.values(cp.hero.equipment).filter(Boolean).length + cp.hero.bag.length)],
        ['Загинули в', lost?.nodeName ?? '—'],
        ['Смертей', String(st.stats.deaths + 1)],
      ];
      rows(ctx, items, panel.x + 60, panel.y + 112, panel.w - 120);
      buttons.draw(ctx);
    },
  };
}

export function createVictoryScreen(app: App): Screen<CanvasRenderingContext2D> {
  return createRunSummaryScreen(app, true);
}

/** The player gave up from the pause menu. */
export function createGameOverScreen(app: App): Screen<CanvasRenderingContext2D> {
  return createRunSummaryScreen(app, false);
}

function createRunSummaryScreen(app: App, victory: boolean): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 260, y: 20, w: 520, h: 500 };
  const buttons = new ButtonGroup(
    victory
      ? [
          new Button({
            label: 'Продовжити експедицію',
            rect: { x: panel.x + 40, y: panel.y + panel.h - 60, w: 250, h: 46 },
            hotkey: 'Enter',
            fontSize: 16,
            onClick: () => app.goMap(),
          }),
          new Button({
            label: 'Новий герой',
            rect: { x: panel.x + 310, y: panel.y + panel.h - 60, w: 170, h: 46 },
            fontSize: 15,
            onClick: () => app.newRun(),
          }),
        ]
      : [
          new Button({
            label: 'Новий герой',
            rect: { x: panel.x + 130, y: panel.y + panel.h - 60, w: 260, h: 46 },
            hotkey: 'Enter',
            onClick: () => app.newRun(),
          }),
        ],
  );
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
      drawText(ctx, victory ? 'Перемога!' : 'Пригоду завершено', W / 2, panel.y + 36, {
        size: 30,
        bold: true,
        align: 'center',
        color: victory ? THEME.good : THEME.bad,
      });
      drawText(
        ctx,
        victory ? 'Усіх босів переможено! Прогрес збережено — можна грати далі.' : 'Ви завершили експедицію. Підсумки:',
        W / 2,
        panel.y + 66,
        { size: 15, align: 'center', color: THEME.textDim },
      );
      const items: [string, string][] = [
        ['Днів', String(st.day)],
        ['Рівень', String(hero.level)],
        ['Клас', className(hero.classId, hero.promotion)],
        ['Вбито ворогів', String(st.stats.kills)],
        ['Нанесено шкоди', String(Math.round(st.stats.damageDealt))],
        ['Переможено босів', `${st.bossesDefeated.length}/${app.totalBosses()}`],
        ['Смертей', String(st.stats.deaths)],
        ['Час гри', formatTime(st.stats.playTime)],
      ];
      rows(ctx, items, panel.x + 60, panel.y + 96, panel.w - 120, 26);
      let y = panel.y + 96 + items.length * 26;
      drawText(ctx, app.skillSummary(), W / 2, y, { size: 13, align: 'center', color: THEME.accent });
      y += 22;
      if (victory) lootLines(ctx, app.lastSummary?.loot ?? [], W / 2, y, wornUids(app));
      buttons.draw(ctx);
    },
  };
}
