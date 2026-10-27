// The smith's window (ROADMAP 14.4): pick an item (worn or in the bag) on the left; on the
// right — its stats with "Перекинути" for each line, raising its level, taking a stone out.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { ITEM_SLOTS, RARITIES } from '../data/items';
import { SOULS } from '../data/souls';
import { displayName, formatStat, type Item } from '../systems/items';
import { removeStone, removeStonePrice, rerollPrice, rerollStat, smithMaxLevel, upgradeItem, upgradePrice } from '../systems/smith';
import type { App } from './app';
import { drawItem } from './itemArt';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, inRect, roundRect } from './ui';

const PANEL = { x: 40, y: 22, w: 880, h: 496 };
const CELL = 58;
const LEFT_X = PANEL.x + 24;
const WORN_Y = PANEL.y + 84;
const BAG_Y = WORN_Y + CELL + 44;
const BAG_COLS = 6;
const BAG_ROWS = 4;
const RIGHT_X = PANEL.x + 430;

const wornCell = (i: number): Rect => ({ x: LEFT_X + i * CELL, y: WORN_Y, w: CELL - 6, h: CELL - 6 });
const bagCell = (i: number): Rect => ({ x: LEFT_X + (i % BAG_COLS) * CELL, y: BAG_Y + Math.floor(i / BAG_COLS) * CELL, w: CELL - 6, h: CELL - 6 });

export function createSmithModal(app: App, title: string, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const hero = (): App['state']['hero'] => app.state.hero;
  let selected: number | null = null;
  let flash = '';
  let flashTime = 0;
  let actions = new ButtonGroup([]);
  const say = (text: string): void => {
    flash = text;
    flashTime = 2;
  };
  const items = (): Item[] => [...ITEM_SLOTS.map((s) => hero().equipment[s.id]).filter((x): x is Item => !!x), ...hero().bag];
  const current = (): Item | undefined => items().find((x) => x.uid === selected);

  const closeBtn = new Button({
    label: 'Назад [Esc]',
    rect: { x: PANEL.x + PANEL.w / 2 - 90, y: PANEL.y + PANEL.h - 44, w: 180, h: 32 },
    hotkey: 'Escape',
    fontSize: 14,
    onClick: onClose,
  });

  /** The buttons of the chosen item: one per stat line, the level, the stone. */
  const rebuild = (): void => {
    const item = current();
    const list: Button[] = [closeBtn];
    if (item?.identified) {
      item.stats.forEach((_, i) => {
        list.push(
          new Button({
            label: `Перекинути — ${rerollPrice(item)}`,
            rect: { x: PANEL.x + PANEL.w - 190, y: PANEL.y + 150 + i * 34 - 14, w: 166, h: 28 },
            fontSize: 12,
            onClick: () => {
              if (rerollStat(app.state, hero(), item, i)) say(`Перекинуто: ${formatStat(item.stats[i]!)}`);
              rebuild();
            },
          }),
        );
      });
      const top = smithMaxLevel(app.state);
      list.push(
        new Button({
          label: top > item.ilvl ? `Підняти до рівня ${top} — ${upgradePrice(app.state, item)} зол.` : 'Рівень уже найвищий',
          rect: { x: RIGHT_X, y: PANEL.y + 330, w: 420, h: 32 },
          fontSize: 13,
          onClick: () => {
            if (upgradeItem(app.state, hero(), item)) say(`Рівень предмета: ${item.ilvl}`);
            rebuild();
          },
        }),
      );
    }
    if (item?.stone) {
      list.push(
        new Button({
          label: `Дістати камінь — ${removeStonePrice(item)} зол.`,
          rect: { x: RIGHT_X, y: PANEL.y + 372, w: 420, h: 32 },
          fontSize: 13,
          onClick: () => {
            if (removeStone(app.state, hero(), item)) say('Камінь у сумці (вкладка «Трофеї»)');
            rebuild();
          },
        }),
      );
    }
    actions = new ButtonGroup(list);
  };
  rebuild();

  return {
    id: 'smith',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      const item = current();
      for (const b of actions.buttons) {
        if (b === closeBtn || !item) continue;
        if (b.label.startsWith('Перекинути')) b.enabled = app.state.gold >= rerollPrice(item);
        else if (b.label.startsWith('Підняти')) b.enabled = app.state.gold >= upgradePrice(app.state, item);
        else if (b.label.startsWith('Рівень')) b.enabled = false;
        else if (b.label.startsWith('Дістати')) b.enabled = app.state.gold >= removeStonePrice(item);
      }
    },
    onInput(e: InputEvent) {
      if (e.type === 'mousedown' && e.button === 0) {
        const worn = ITEM_SLOTS.map((s) => hero().equipment[s.id]);
        for (let i = 0; i < worn.length; i++) {
          const it = worn[i];
          if (it && inRect(wornCell(i), e.x, e.y)) {
            selected = it.uid;
            rebuild();
            return;
          }
        }
        for (let i = 0; i < hero().bag.length && i < BAG_COLS * BAG_ROWS; i++) {
          if (inRect(bagCell(i), e.x, e.y)) {
            selected = hero().bag[i]!.uid;
            rebuild();
            return;
          }
        }
      }
      actions.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(30, 22, 18, 0.98)', '#a07040');
      drawText(ctx, title, PANEL.x + PANEL.w / 2, PANEL.y + 24, { size: 22, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 24, { size: 15, bold: true, align: 'right', color: THEME.accent });
      drawText(ctx, 'Оберіть річ: одягнену або з сумки', LEFT_X, PANEL.y + 56, { size: 13, color: THEME.textDim });
      drawText(ctx, 'Одягнене', LEFT_X, WORN_Y - 12, { size: 13, bold: true, color: THEME.accent });
      ITEM_SLOTS.forEach((s, i) => cell(ctx, wornCell(i), st.hero.equipment[s.id] ?? null, selected));
      drawText(ctx, 'Сумка', LEFT_X, BAG_Y - 12, { size: 13, bold: true, color: THEME.accent });
      for (let i = 0; i < BAG_COLS * BAG_ROWS; i++) cell(ctx, bagCell(i), st.hero.bag[i] ?? null, selected);

      const item = current();
      if (!item) {
        drawText(ctx, 'Перекинути характеристику, підняти рівень речі, дістати камінь.', RIGHT_X, PANEL.y + 120, { size: 13, color: THEME.textDim });
        drawText(ctx, `Найвищий рівень, до якого підніму: ${smithMaxLevel(st)} (росте з пройденими локаціями).`, RIGHT_X, PANEL.y + 144, { size: 13, color: THEME.textDim });
      } else {
        drawText(ctx, displayName(item), RIGHT_X, PANEL.y + 92, { size: 17, bold: true, color: RARITIES[item.rarity].color });
        drawText(ctx, `${RARITIES[item.rarity].name} · рівень предмета ${item.ilvl}`, RIGHT_X, PANEL.y + 116, { size: 12, color: THEME.textDim });
        if (!item.identified) drawText(ctx, 'Спершу розпізнайте річ лупою', RIGHT_X, PANEL.y + 150, { size: 13, color: THEME.bad });
        else item.stats.forEach((s, i) => drawText(ctx, formatStat(s), RIGHT_X, PANEL.y + 150 + i * 34, { size: 14 }));
        if (item.stone) drawText(ctx, `Камінь: ${SOULS[item.stone]?.name ?? item.stone}`, RIGHT_X, PANEL.y + 310, { size: 13, color: SOULS[item.stone]?.color });
      }
      actions.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, RIGHT_X, PANEL.y + PANEL.h - 70, { size: 14, bold: true, color: THEME.good });
        ctx.globalAlpha = 1;
      }
    },
  };
}

function cell(ctx: CanvasRenderingContext2D, r: Rect, item: Item | null, selected: number | null): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = item ? '#2a241f' : '#1d1915';
  ctx.fill();
  const on = item && item.uid === selected;
  ctx.lineWidth = on ? 3 : 1.5;
  ctx.strokeStyle = on ? THEME.accent : item ? RARITIES[item.rarity].color : '#3a332b';
  ctx.stroke();
  if (!item) return;
  ctx.globalAlpha = item.identified ? 1 : 0.5;
  drawItem(ctx, item, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62);
  ctx.globalAlpha = 1;
  if (item.stone) {
    ctx.fillStyle = SOULS[item.stone]?.color ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(r.x + r.w - 8, r.y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
