// Title screen (ROADMAP 9.2–9.3): continue the saved hero or start a new one with a name;
// the save can be exported to a file and imported from one (to pass a hero to a friend).

import type { Screen } from '../core/screens';
import { GAME_VERSION } from '../data/changelog';
import { fillNames } from '../data/names';
import { WORLD_NODES } from '../data/world';
import { DEFAULT_HERO_NAME } from '../systems/run';
import type { SaveData } from '../systems/save';
import type { App } from './app';
import { className } from './names';
import { THEME, font } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, roundRect } from './ui';

/** Longest hero name, characters. */
export const HERO_NAME_MAX = 16;

export function createTitleScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  let mode: 'menu' | 'name' = 'menu';
  let name = '';
  let save: SaveData | null = null;
  /** A note under the buttons (import result), and how long it stays. */
  let note = '';
  let noteTime = 0;
  let noteBad = false;
  const say = (text: string, bad = false): void => {
    note = text;
    noteBad = bad;
    noteTime = 4;
  };

  const panel = { x: W / 2 - 240, y: 150, w: 480, h: 300 };
  const settingsBtn = new Button({ label: 'Налаштування', rect: { x: 16, y: H - 50, w: 150, h: 34 }, fontSize: 13, onClick: () => app.openSettings() });
  const extras = new ButtonGroup([settingsBtn]);
  const menu = new ButtonGroup();
  const entry = new ButtonGroup();

  const start = (): void => app.startNewHero(name.trim() || DEFAULT_HERO_NAME);
  const openName = (): void => {
    mode = 'name';
    name = '';
  };
  const layoutMenu = (): void => {
    menu.clear();
    const x = panel.x + 60;
    const w = panel.w - 120;
    let y = panel.y + (save ? 112 : 60);
    if (save) {
      menu.add(new Button({ label: 'Продовжити', rect: { x, y: panel.y + 60, w, h: 46 }, hotkey: 'Enter', onClick: () => app.continueGame() }));
    }
    menu.add(new Button({ label: 'Нова гра', rect: { x, y, w, h: 42 }, fontSize: 16, hotkey: save ? undefined : 'Enter', onClick: openName }));
    y += 54;
    const half = (w - 12) / 2;
    menu.add(
      new Button({
        label: 'Імпорт героя',
        rect: { x, y, w: save ? half : w, h: 34 },
        fontSize: 13,
        onClick: () => {
          void app.importSave().then((res) => {
            if (res === null) return;
            say(res.ok ? `Завантажено героя ${res.name}` : 'Це не збереження гри (або воно з новішої версії)', !res.ok);
            refresh();
          });
        },
      }),
    );
    if (save) menu.add(new Button({ label: 'Експорт героя', rect: { x: x + half + 12, y, w: half, h: 34 }, fontSize: 13, onClick: () => app.exportSave() }));
    y += 44;
    if (app.meta.battles.length > 0) {
      menu.add(new Button({ label: `Статистика боїв (${app.meta.battles.length}) — для розробника`, rect: { x, y, w, h: 30 }, fontSize: 12, onClick: () => app.exportStats() }));
    }
    // The new core of the rework grows in its own mode (ROADMAP 20), only in `npm run dev`.
    if (app.debug) {
      menu.add(new Button({ label: 'Реворк: Ліс', rect: { x: W - 196, y: H - 92, w: 180, h: 34 }, fontSize: 14, onClick: () => app.screens.go('rework') }));
    }
  };
  entry.add(new Button({ label: 'Почати пригоду', rect: { x: panel.x + 60, y: panel.y + 190, w: panel.w - 120, h: 46 }, hotkey: 'Enter', onClick: start }));
  entry.add(new Button({ label: 'Назад [Esc]', rect: { x: panel.x + 160, y: panel.y + 246, w: panel.w - 320, h: 32 }, fontSize: 13, hotkey: 'Escape', onClick: () => (mode = 'menu') }));

  const refresh = (): void => {
    save = app.savedHero();
    layoutMenu();
  };

  return {
    enter() {
      refresh();
      mode = app.titleStartsWithName ? 'name' : 'menu';
      app.titleStartsWithName = false;
      name = '';
    },
    update(dt) {
      noteTime = Math.max(0, noteTime - dt);
    },
    onInput(e) {
      if (extras.handle(e)) return;
      if (mode === 'menu') {
        menu.handle(e);
        return;
      }
      if (entry.handle(e)) return;
      if (e.type !== 'key') return;
      if (e.code === 'Backspace') name = name.slice(0, -1);
      else if (e.key.length === 1 && name.length < HERO_NAME_MAX && !(e.key === ' ' && name.length === 0)) name += e.key;
    },
    render(ctx) {
      ctx.fillStyle = THEME.bg;
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'Експедиція', W / 2, 70, { size: 46, bold: true, align: 'center', color: THEME.accent });
      drawText(ctx, fillNames('Над {name:kingdom:with} — тінь {name:lord:of}. Хтось має піти за браму.'), W / 2, 112, { size: 15, align: 'center', color: THEME.textDim });
      drawPanel(ctx, panel);
      if (mode === 'menu') {
        if (save) {
          const town = WORLD_NODES.find((n) => n.id === save!.homeTown)?.name ?? '';
          const who = `${save.heroName} · ${className(save.hero.classId, save.hero.promotion)} · рівень ${save.hero.level}`;
          drawText(ctx, who, W / 2, panel.y + 26, { size: 16, bold: true, align: 'center' });
          drawText(ctx, `${town} · день ${save.day} · життів ${save.lives}`, W / 2, panel.y + 46, { size: 13, align: 'center', color: THEME.textDim });
        } else drawText(ctx, 'Збереженого героя немає', W / 2, panel.y + 32, { size: 15, align: 'center', color: THEME.textDim });
        menu.draw(ctx);
        if (save) drawText(ctx, 'Гра зберігається сама: у місті, на виході з нього й після боса.', W / 2, panel.y + panel.h - 22, { size: 12, align: 'center', color: THEME.textMuted });
      } else {
        drawText(ctx, 'Як звати героя?', W / 2, panel.y + 36, { size: 20, bold: true, align: 'center' });
        const field = { x: panel.x + 60, y: panel.y + 70, w: panel.w - 120, h: 48 };
        ctx.fillStyle = '#0d1018';
        roundRect(ctx, field.x, field.y, field.w, field.h, 8);
        ctx.fill();
        ctx.strokeStyle = THEME.focus;
        ctx.lineWidth = 2;
        ctx.stroke();
        const shown = name || DEFAULT_HERO_NAME;
        drawText(ctx, shown, W / 2, field.y + field.h / 2 + 1, { size: 22, bold: true, align: 'center', color: name ? THEME.text : THEME.textMuted });
        if (Math.floor(app.time * 2) % 2 === 0) {
          ctx.font = font(22, 'bold');
          const tw = name ? ctx.measureText(name).width : 0;
          ctx.fillStyle = THEME.text;
          ctx.fillRect(W / 2 + tw / 2 + 2, field.y + 12, 2, field.h - 24);
        }
        drawText(ctx, `До ${HERO_NAME_MAX} символів · Enter — почати`, W / 2, panel.y + 140, { size: 12, align: 'center', color: THEME.textMuted });
        if (save) drawText(ctx, `Збережений герой ${save.heroName} буде замінений новим.`, W / 2, panel.y + 166, { size: 13, align: 'center', color: THEME.bad });
        entry.draw(ctx);
      }
      if (noteTime > 0) drawText(ctx, note, W / 2, panel.y + panel.h + 26, { size: 14, align: 'center', color: noteBad ? THEME.bad : THEME.good });
      settingsBtn.draw(ctx);
      drawText(ctx, `v${GAME_VERSION}`, W - 16, H - 16, { size: 12, align: 'right', color: THEME.textMuted });
    },
  };
}
