// Town merchant: buy magnifiers, potions and random items for a chosen slot. A click on a
// bag item opens a dropdown: identify, wear or sell. The full equipment window opens on top (Tab).

import { sellTrophies, trophySale } from '../systems/trophies';
import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CONSUMABLES, type ConsumableId, describeConsumable } from '../data/consumables';
import { ITEM_SLOTS, MERCHANT_ITEMS, RARITIES } from '../data/items';
import type { ShopDef } from '../data/npcs';
import { buyConsumable, buyItem, canBuy, displayName, equipFromBag, identifyItem, merchantItemLevels, sellItem, sellPrice } from '../systems/items';
import type { App } from './app';
import { drawConsumableIcon } from './icons';
import { MENU_ROW, MENU_W, type MenuOption, drawBagItemTooltip, drawMenu } from './inventory';
import { drawItem } from './itemArt';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, inRect, roundRect } from './ui';

const PANEL: Rect = { x: 70, y: 40, w: 820, h: 460 };
/** The general store's goods (a seller without its own list). */
const DEFAULT_GOODS: ConsumableId[] = ['magnifier', 'potionSmall', 'potionMedium', 'potionLarge'];
const GOODS_Y = 90;
const GOODS_ROW = 64;
const CELL = 58;
const COLS = 6;
const ROWS = 4;
const SELL_X = 470;
const SELL_Y = 120;

function sellCell(i: number): Rect {
  return { x: SELL_X + (i % COLS) * CELL, y: SELL_Y + Math.floor(i / COLS) * CELL, w: CELL - 6, h: CELL - 6 };
}

export function createMerchantModal(app: App, onClose: () => void, shop: ShopDef = {}, title = 'Торговець'): Modal<CanvasRenderingContext2D> {
  const GOODS = shop.goods ?? DEFAULT_GOODS;
  const SLOTS = shop.slots ? ITEM_SLOTS.filter((s) => shop.slots!.includes(s.id)) : ITEM_SLOTS;
  /** Bag item whose dropdown is open (-1: none). */
  let selected = -1;
  let menu: { x: number; y: number; options: MenuOption[] } | null = null;
  let flash = '';
  let flashTime = 0;
  const buyButtons = GOODS.map(
    (id, i) =>
      new Button({
        label: `Купити — ${CONSUMABLES[id].price}`,
        rect: { x: PANEL.x + 262, y: PANEL.y + GOODS_Y + i * GOODS_ROW, w: 128, h: 28 },
        fontSize: 13,
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
  /** Dropdown for a bag item: identify (if needed), wear, sell. */
  const openMenu = (index: number, x: number, y: number): void => {
    const hero = app.state.hero;
    const item = hero.bag[index];
    if (!item) return;
    selected = index;
    const options: MenuOption[] = [];
    if (!item.identified) {
      options.push({
        label: `Розпізнати (лупа: ${hero.consumables.magnifier})`,
        enabled: hero.consumables.magnifier > 0,
        run: () => {
          if (identifyItem(hero, index)) say(`Розпізнано: ${displayName(item)}`);
        },
      });
    }
    options.push({
      label: 'Вдягнути',
      enabled: item.identified,
      run: () => {
        if (equipFromBag(hero, index)) say(`Вдягнуто: ${displayName(item)}`);
      },
    });
    options.push({
      label: `Продати за ${sellPrice(item)} зол.`,
      enabled: true,
      run: () => say(`Продано «${displayName(item)}» за ${sellItem(app.state, index)} зол.`),
    });
    menu = {
      x: Math.min(x, PANEL.x + PANEL.w - MENU_W - 8),
      y: Math.min(y, PANEL.y + PANEL.h - options.length * MENU_ROW - 8),
      options,
    };
  };
  const ITEM_Y = SELL_Y + ROWS * CELL + 30;
  const itemButtons = SLOTS.map(
    (slot, i) =>
      new Button({
        label: slot.name,
        rect: { x: SELL_X + i * 87, y: ITEM_Y, w: 80, h: 32 },
        fontSize: 12,
        onClick: () => {
          const item = buyItem(app.state, slot.id);
          if (item) say(`Куплено: ${displayName(item)} (${RARITIES[item.rarity].name.toLowerCase()}) — у сумці`);
        },
      }),
  );
  const gearBtn = new Button({
    label: 'Спорядження [Tab]',
    rect: { x: PANEL.x + 30, y: PANEL.y + PANEL.h - 54, w: 190, h: 36 },
    fontSize: 14,
    onClick: () => app.openInventoryOver(),
  });
  const trophyBtn = new Button({
    label: 'Продати трофеї',
    rect: { x: PANEL.x + PANEL.w - 250, y: PANEL.y + PANEL.h - 54, w: 220, h: 36 },
    fontSize: 13,
    onClick: () => {
      const { count } = trophySale(app.state);
      const gold = sellTrophies(app.state);
      say(`Продано трофеїв: ${count} — ${gold} зол.`);
    },
  });
  const closeBtn = new Button({
    label: 'Назад до міста',
    rect: { x: PANEL.x + PANEL.w / 2 - 110, y: PANEL.y + PANEL.h - 56, w: 220, h: 40 },
    hotkey: 'Escape',
    fontSize: 15,
    onClick: onClose,
  });
  const buttons = new ButtonGroup([...buyButtons, ...itemButtons, gearBtn, trophyBtn, closeBtn]);

  return {
    id: 'merchant',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      GOODS.forEach((id, i) => (buyButtons[i]!.enabled = canBuy(app.state, id)));
      if (!menu) selected = -1;
      for (const b of itemButtons) b.enabled = app.state.gold >= MERCHANT_ITEMS.price;
      const sale = trophySale(app.state);
      trophyBtn.enabled = sale.count > 0;
      trophyBtn.label = sale.count > 0 ? `Продати трофеї: ${sale.count} — ${sale.gold} зол.` : 'Трофеїв на продаж немає';
    },
    onInput(e: InputEvent) {
      if (e.type === 'key' && e.code === 'Tab') {
        app.openInventoryOver();
        return;
      }
      if (menu) {
        if (e.type === 'key' && e.code === 'Escape') {
          menu = null;
          return;
        }
        if (e.type === 'mousedown') {
          const m = menu;
          const i = Math.floor((e.y - m.y) / MENU_ROW);
          const inside = e.x >= m.x && e.x <= m.x + MENU_W && i >= 0 && i < m.options.length;
          menu = null;
          if (inside) {
            const opt = m.options[i]!;
            if (opt.enabled) opt.run();
            return;
          }
        }
      }
      if (e.type === 'mousedown') {
        for (let i = 0; i < app.state.hero.bag.length && i < COLS * ROWS; i++) {
          if (inRect(sellCell(i), e.x, e.y)) {
            openMenu(i, e.x, e.y);
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
      drawText(ctx, title, PANEL.x + PANEL.w / 2, PANEL.y + 26, { size: 24, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 26, { size: 16, bold: true, align: 'right', color: THEME.accent });

      if (GOODS.length > 0) drawText(ctx, 'Купити', PANEL.x + 30, PANEL.y + 70, { size: 16, bold: true, color: THEME.accent });
      GOODS.forEach((id, i) => {
        const def = CONSUMABLES[id];
        const y = PANEL.y + GOODS_Y + i * GOODS_ROW;
        roundRect(ctx, PANEL.x + 30, y, 52, 52, 8);
        ctx.fillStyle = '#2a241f';
        ctx.fill();
        drawConsumableIcon(ctx, id, PANEL.x + 56, y + 26, 38);
        drawText(ctx, def.name, PANEL.x + 94, y + 12, { size: 15, bold: true });
        drawText(ctx, describeConsumable(id), PANEL.x + 94, y + 34, { size: 11, color: THEME.textDim });
        drawText(ctx, `у вас: ${st.hero.consumables[id]} / ${def.max}`, PANEL.x + 94, y + 50, { size: 11, color: THEME.textMuted });
      });
      if (GOODS.length > 0) drawText(ctx, 'Трава росте на арені; трава й зілля — на Z / X / C.', PANEL.x + 30, PANEL.y + GOODS_Y + GOODS.length * GOODS_ROW + 6, {
        size: 11,
        color: THEME.textDim,
      });

      drawText(ctx, 'Ваша сумка (клік по речі — меню)', SELL_X, SELL_Y - 22, { size: 16, bold: true, color: THEME.accent });
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
      if (st.hero.bag.length > COLS * ROWS) {
        drawText(ctx, `…ще ${st.hero.bag.length - COLS * ROWS} у сумці (Tab)`, SELL_X + COLS * CELL - 6, SELL_Y - 22, { size: 11, align: 'right', color: THEME.textDim });
      }
      const [lo, hi] = merchantItemLevels(st);
      if (SLOTS.length > 0) drawText(ctx, `Купити річ — ${MERCHANT_ITEMS.price} зол. (зелена, синя або епічна; рівень ${lo}–${hi})`, SELL_X, ITEM_Y - 14, {
        size: 12,
        bold: true,
        color: THEME.accent,
      });
      if (st.hero.bag.length === 0) {
        drawText(ctx, 'Сумка порожня', SELL_X + (COLS * CELL) / 2, SELL_Y + 100, { size: 14, align: 'center', color: THEME.textDim });
      }
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + 30, PANEL.y + GOODS_Y + GOODS.length * GOODS_ROW + 30, { size: 13, bold: true, color: THEME.good });
        ctx.globalAlpha = 1;
      }
      const m = app.input.mouse;
      if (menu) drawMenu(ctx, menu, m);
      else {
        for (let i = 0; i < st.hero.bag.length && i < COLS * ROWS; i++) {
          if (!inRect(sellCell(i), m.x, m.y)) continue;
          drawBagItemTooltip(ctx, app, st.hero.bag[i]!, ['Клік — меню: розпізнати, вдягнути або продати'], st.hero, m);
        }
      }
    },
  };
}
