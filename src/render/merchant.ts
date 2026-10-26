// Town merchant: buy magnifiers and healing herbs; identify, wear or sell bag items
// right here; the full equipment window opens on top (Tab).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CONSUMABLES, type ConsumableId } from '../data/consumables';
import { RARITIES } from '../data/items';
import { buyConsumable, canBuy, displayName, equipFromBag, identifyItem, sellItem, sellPrice } from '../systems/items';
import type { App } from './app';
import { drawConsumableIcon } from './icons';
import { itemTooltip } from './inventory';
import { drawItem } from './itemArt';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, drawTooltip, inRect, roundRect } from './ui';

const PANEL: Rect = { x: 70, y: 40, w: 820, h: 460 };
const GOODS: ConsumableId[] = ['magnifier', 'herb'];
const CELL = 58;
const COLS = 6;
const ROWS = 4;
const SELL_X = 470;
const SELL_Y = 120;

function sellCell(i: number): Rect {
  return { x: SELL_X + (i % COLS) * CELL, y: SELL_Y + Math.floor(i / COLS) * CELL, w: CELL - 6, h: CELL - 6 };
}

export function createMerchantModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  let selected = -1;
  let flash = '';
  let flashTime = 0;
  const buyButtons = GOODS.map(
    (id, i) =>
      new Button({
        label: `Купити — ${CONSUMABLES[id].price} зол.`,
        rect: { x: PANEL.x + 210, y: PANEL.y + 110 + i * 92, w: 170, h: 38 },
        fontSize: 14,
        onClick: () => {
          if (buyConsumable(app.state, id)) {
            flash = `Куплено: ${CONSUMABLES[id].name}`;
            flashTime = 1.5;
          }
        },
      }),
  );
  const say = (text: string): void => {
    flash = text;
    flashTime = 1.8;
  };
  const ACT_Y = SELL_Y + ROWS * CELL + 24;
  const ACT_W = 108;
  const identifyBtn = new Button({
    label: 'Розпізнати',
    rect: { x: SELL_X, y: ACT_Y, w: ACT_W, h: 36 },
    hotkey: 'KeyR',
    fontSize: 13,
    onClick: () => {
      const item = app.state.hero.bag[selected];
      if (item && identifyItem(app.state.hero, selected)) say(`Розпізнано: ${displayName(item)}`);
    },
  });
  const equipBtn = new Button({
    label: 'Вдягнути',
    rect: { x: SELL_X + ACT_W + 8, y: ACT_Y, w: ACT_W, h: 36 },
    hotkey: 'KeyE',
    fontSize: 13,
    onClick: () => {
      const item = app.state.hero.bag[selected];
      if (!item || !equipFromBag(app.state.hero, selected)) return;
      say(`Вдягнуто: ${displayName(item)}`);
      selected = -1;
    },
  });
  const sellBtn = new Button({
    label: 'Продати',
    rect: { x: SELL_X + 2 * (ACT_W + 8), y: ACT_Y, w: ACT_W, h: 36 },
    fontSize: 13,
    onClick: () => {
      if (selected < 0) return;
      const item = app.state.hero.bag[selected];
      if (!item) return;
      const price = sellItem(app.state, selected);
      say(`Продано «${displayName(item)}» за ${price} зол.`);
      selected = -1;
    },
  });
  const gearBtn = new Button({
    label: 'Спорядження [Tab]',
    rect: { x: PANEL.x + 30, y: PANEL.y + 300, w: 200, h: 36 },
    fontSize: 14,
    onClick: () => app.openInventoryOver(),
  });
  const closeBtn = new Button({
    label: 'Назад до міста',
    rect: { x: PANEL.x + PANEL.w / 2 - 110, y: PANEL.y + PANEL.h - 56, w: 220, h: 40 },
    hotkey: 'Escape',
    fontSize: 15,
    onClick: onClose,
  });
  const buttons = new ButtonGroup([...buyButtons, identifyBtn, equipBtn, sellBtn, gearBtn, closeBtn]);

  return {
    id: 'merchant',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      GOODS.forEach((id, i) => (buyButtons[i]!.enabled = canBuy(app.state, id)));
      const hero = app.state.hero;
      const item = selected >= 0 ? hero.bag[selected] : undefined;
      if (!item) selected = -1;
      identifyBtn.enabled = !!item && !item.identified && hero.consumables.magnifier > 0;
      identifyBtn.label = `Лупа (×${hero.consumables.magnifier})`;
      equipBtn.enabled = !!item && item.identified;
      sellBtn.enabled = !!item;
      sellBtn.label = item ? `Продати ${sellPrice(item)}` : 'Продати';
    },
    onInput(e: InputEvent) {
      if (e.type === 'key' && e.code === 'Tab') {
        app.openInventoryOver();
        return;
      }
      if (e.type === 'mousedown') {
        for (let i = 0; i < app.state.hero.bag.length && i < COLS * ROWS; i++) {
          if (inRect(sellCell(i), e.x, e.y)) {
            selected = i;
            return;
          }
        }
      }
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.78)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(24, 20, 18, 0.98)', '#8a6a44');
      drawText(ctx, 'Торговець', PANEL.x + PANEL.w / 2, PANEL.y + 26, { size: 24, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 26, { size: 16, bold: true, align: 'right', color: THEME.accent });

      drawText(ctx, 'Купити', PANEL.x + 30, PANEL.y + 70, { size: 16, bold: true, color: THEME.accent });
      GOODS.forEach((id, i) => {
        const def = CONSUMABLES[id];
        const y = PANEL.y + 96 + i * 92;
        roundRect(ctx, PANEL.x + 30, y, 64, 64, 8);
        ctx.fillStyle = '#2a241f';
        ctx.fill();
        drawConsumableIcon(ctx, id, PANEL.x + 62, y + 32, 44);
        drawText(ctx, def.name, PANEL.x + 108, y + 12, { size: 15, bold: true });
        drawText(ctx, `у вас: ${st.hero.consumables[id]} / ${def.max}`, PANEL.x + 108, y + 32, { size: 12, color: THEME.textDim });
        drawText(ctx, def.description, PANEL.x + 30, y + 78, { size: 11, color: THEME.textDim });
      });

      drawText(ctx, 'Ваша сумка (клік — обрати річ)', SELL_X, SELL_Y - 22, { size: 16, bold: true, color: THEME.accent });
      for (let i = 0; i < COLS * ROWS; i++) {
        const r = sellCell(i);
        const item = st.hero.bag[i];
        roundRect(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = item ? '#2a241f' : '#1d1915';
        ctx.fill();
        ctx.lineWidth = selected === i ? 3 : 1.5;
        ctx.strokeStyle = selected === i ? THEME.accent : item ? RARITIES[item.rarity].color : '#3a332b';
        ctx.stroke();
        if (item) {
          drawItem(ctx, item, r.x + r.w / 2, r.y + r.h / 2 - 4, r.w * 0.6);
          drawText(ctx, `${sellPrice(item)}`, r.x + r.w / 2, r.y + r.h - 8, { size: 10, bold: true, align: 'center', color: THEME.accent });
        }
      }
      if (st.hero.bag.length === 0) {
        drawText(ctx, 'Сумка порожня', SELL_X + (COLS * CELL) / 2, SELL_Y + 100, { size: 14, align: 'center', color: THEME.textDim });
      }
      const chosen = selected >= 0 ? st.hero.bag[selected] : undefined;
      drawText(ctx, chosen ? displayName(chosen) : 'Оберіть річ: розпізнати лупою, вдягнути або продати', SELL_X, ACT_Y - 10, {
        size: 12,
        bold: !!chosen,
        color: chosen ? RARITIES[chosen.rarity].color : THEME.textDim,
      });
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 76, { size: 14, bold: true, align: 'center', color: THEME.good });
        ctx.globalAlpha = 1;
      }
      const m = app.input.mouse;
      for (let i = 0; i < st.hero.bag.length && i < COLS * ROWS; i++) {
        if (inRect(sellCell(i), m.x, m.y)) drawTooltip(ctx, itemTooltip(st.hero.bag[i]!, ['Клік — обрати: розпізнати (R), вдягнути (E) або продати']), m.x, m.y, app.view.width, app.view.height);
      }
    },
  };
}
