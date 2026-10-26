// Inventory (Tab, or "Спорядження" in town): a figure wearing the items, slot
// boxes around it, the bag, consumables and the quick slots Z / X / C. Wear items by
// dragging them onto the figure / a slot, or via the right-click menu. Unidentified
// items need a magnifier first (menu "Розпізнати" or drag the magnifier onto the item).
// Herbs and potions go onto the quick slots by dragging or via the right-click menu.
// The game is paused while it is open.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CONSUMABLES, type ConsumableId, HEAL_ORDER, QUICK_SLOTS, describeConsumable } from '../data/consumables';
import { ITEM_SLOTS, type ItemSlot, RARITIES } from '../data/items';
import {
  type Item,
  displayName,
  assignQuickSlot,
  equipFromBag,
  formatStat,
  isHeal,
  itemPerks,
  identifyItem,
  markItemsSeen,
  sellPrice,
  unequip,
} from '../systems/items';
import type { App } from './app';
import { drawConsumableIcon, drawItemIcon } from './icons';
import { drawItem } from './itemArt';
import { THEME } from './theme';
import { type Rect, drawPanel, drawText, drawTooltip, inRect, roundRect } from './ui';

const PANEL: Rect = { x: 50, y: 30, w: 860, h: 480 };
const FIG_X = 250;
const FIG_Y = 110;
const FIGURE_AREA: Rect = { x: FIG_X - 80, y: FIG_Y - 10, w: 160, h: 320 };
const SLOT_SIZE = 64;
const CELL = 58;
const BAG_COLS = 6;
const BAG_ROWS = 4;
const BAG_X = 500;
const BAG_Y = 100;
const BAG_AREA: Rect = { x: BAG_X - 6, y: BAG_Y - 6, w: BAG_COLS * CELL + 6, h: BAG_ROWS * CELL + 6 };
const CONS_Y = BAG_Y + BAG_ROWS * CELL + 34;
const CONSUMABLE_ORDER: ConsumableId[] = ['magnifier', ...HEAL_ORDER];
const CONS_CELL = 44;
const CONS_STEP = 50;
const QUICK_Y = CONS_Y + 58;
const QUICK_X = BAG_X + 150;
const QUICK_STEP = 56;
const MENU_W = 200;
const MENU_ROW = 28;
const DRAG_THRESHOLD = 5;
const MESSAGE_TIME = 2.2;

/** Slot boxes around the figure and the body point each one links to. */
const SLOT_LAYOUT: Record<ItemSlot, { box: Rect; anchor: { x: number; y: number } }> = {
  hat: { box: { x: FIG_X - 170, y: FIG_Y - 10, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X - 20, y: FIG_Y + 10 } },
  armor: { box: { x: FIG_X - 170, y: FIG_Y + 110, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X - 30, y: FIG_Y + 120 } },
  weapon: { box: { x: FIG_X + 106, y: FIG_Y + 70, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X + 62, y: FIG_Y + 150 } },
  boots: { box: { x: FIG_X + 106, y: FIG_Y + 220, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X + 26, y: FIG_Y + 280 } },
};

type DragSource =
  | { kind: 'bag'; index: number }
  | { kind: 'worn'; slot: ItemSlot }
  | { kind: 'consumable'; id: ConsumableId }
  | { kind: 'quick'; slot: number };

interface MenuOption {
  label: string;
  enabled: boolean;
  run: () => void;
}

function bagCell(i: number): Rect {
  return { x: BAG_X + (i % BAG_COLS) * CELL, y: BAG_Y + Math.floor(i / BAG_COLS) * CELL, w: CELL - 6, h: CELL - 6 };
}

function consumableCell(i: number): Rect {
  return { x: BAG_X + i * CONS_STEP, y: CONS_Y, w: CONS_CELL, h: CONS_CELL };
}

function quickCell(i: number): Rect {
  return { x: QUICK_X + i * QUICK_STEP, y: QUICK_Y, w: CONS_CELL, h: CONS_CELL };
}

function consumableAt(x: number, y: number): ConsumableId | null {
  const i = CONSUMABLE_ORDER.findIndex((_, k) => inRect(consumableCell(k), x, y));
  return i >= 0 ? (CONSUMABLE_ORDER[i] ?? null) : null;
}

function quickAt(x: number, y: number): number {
  return QUICK_SLOTS.labels.findIndex((_, k) => inRect(quickCell(k), x, y));
}

function slotName(slot: ItemSlot): string {
  return ITEM_SLOTS.find((s) => s.id === slot)?.name ?? '';
}

export function itemTooltip(item: Item, extra: string[]): string[] {
  const lines = [displayName(item), `${slotName(item.slot)} · ${RARITIES[item.rarity].name}`];
  if (item.identified) lines.push(...item.stats.map(formatStat), ...itemPerks(item));
  else lines.push('Не розпізнано: використайте лупу', '(ПКМ → «Розпізнати» або перетягніть лупу на річ)');
  lines.push(`Ціна продажу: ${sellPrice(item)} зол.`, ...extra);
  return lines;
}

export function createInventoryModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  let t = 0;
  let drag: (DragSource & { x: number; y: number; moved: boolean }) | null = null;
  let menu: { x: number; y: number; options: MenuOption[] } | null = null;
  let message = '';
  let messageTime = 0;
  const say = (text: string): void => {
    message = text;
    messageTime = MESSAGE_TIME;
  };
  const hero = (): App['state']['hero'] => app.state.hero;

  const bagIndexAt = (x: number, y: number): number => {
    for (let i = 0; i < hero().bag.length && i < BAG_COLS * BAG_ROWS; i++) if (inRect(bagCell(i), x, y)) return i;
    return -1;
  };
  const slotAt = (x: number, y: number): ItemSlot | null => {
    for (const s of ITEM_SLOTS) if (inRect(SLOT_LAYOUT[s.id].box, x, y)) return s.id;
    return null;
  };

  const tryEquip = (index: number): void => {
    const item = hero().bag[index];
    if (!item) return;
    if (!item.identified) say('Спершу розпізнайте річ лупою');
    else equipFromBag(hero(), index);
  };
  const tryIdentify = (index: number): void => {
    if (hero().consumables.magnifier <= 0) say('Немає лупи — купіть у торговця в місті');
    else identifyItem(hero(), index);
  };

  const openMenu = (x: number, y: number): void => {
    const bi = bagIndexAt(x, y);
    const slot = slotAt(x, y);
    const options: MenuOption[] = [];
    if (bi >= 0) {
      const item = hero().bag[bi]!;
      if (!item.identified) {
        options.push({
          label: `Розпізнати (лупа: ${hero().consumables.magnifier})`,
          enabled: hero().consumables.magnifier > 0,
          run: () => tryIdentify(bi),
        });
      }
      options.push({ label: 'Вдягнути', enabled: item.identified, run: () => tryEquip(bi) });
    } else if (slot && hero().equipment[slot]) {
      options.push({ label: 'Зняти в сумку', enabled: true, run: () => unequip(hero(), slot) });
    } else {
      const cid = consumableAt(x, y);
      const qi = quickAt(x, y);
      if (cid && isHeal(cid)) {
        QUICK_SLOTS.labels.forEach((key, k) => {
          options.push({ label: `Поставити на ${key}`, enabled: hero().quickSlots[k] !== cid, run: () => assignQuickSlot(hero(), k, cid) });
        });
      } else if (qi >= 0 && hero().quickSlots[qi]) {
        options.push({ label: 'Прибрати зі слота', enabled: true, run: () => assignQuickSlot(hero(), qi, null) });
      }
    }
    menu = options.length > 0 ? { x: Math.min(x, PANEL.x + PANEL.w - MENU_W - 8), y, options } : null;
  };

  const drop = (src: DragSource, x: number, y: number): void => {
    const slot = slotAt(x, y);
    const onFigure = inRect(FIGURE_AREA, x, y);
    if (src.kind === 'bag') {
      const item = hero().bag[src.index];
      if (!item) return;
      if (slot === item.slot || onFigure) tryEquip(src.index);
      else if (slot) say(`Ця річ — не для слота «${slotName(slot)}»`);
    } else if (src.kind === 'worn') {
      if (inRect(BAG_AREA, x, y)) unequip(hero(), src.slot);
    } else if (src.kind === 'quick') {
      // Onto another quick slot: swap; anywhere else: clear the slot.
      const to = quickAt(x, y);
      const id = hero().quickSlots[src.slot] ?? null;
      if (to === src.slot) return;
      if (to >= 0) {
        const other = hero().quickSlots[to] ?? null;
        hero().quickSlots[to] = id;
        hero().quickSlots[src.slot] = other;
      } else assignQuickSlot(hero(), src.slot, null);
    } else if (isHeal(src.id)) {
      const to = quickAt(x, y);
      if (to >= 0) assignQuickSlot(hero(), to, src.id);
    } else {
      const bi = bagIndexAt(x, y);
      const item = bi >= 0 ? hero().bag[bi] : undefined;
      if (item && !item.identified) tryIdentify(bi);
    }
  };

  return {
    id: 'inventory',
    exit() {
      markItemsSeen(app.state.hero);
    },
    update(dt) {
      t += dt;
      messageTime = Math.max(0, messageTime - dt);
    },
    onInput(e: InputEvent) {
      if (e.type === 'key') {
        if (e.code === 'Escape' && menu) menu = null;
        else if (e.code === 'Escape' || e.code === 'Tab') onClose();
        return;
      }
      if (e.type === 'mousemove') {
        if (drag && Math.hypot(e.x - drag.x, e.y - drag.y) > DRAG_THRESHOLD) drag.moved = true;
        return;
      }
      if (e.type === 'mousedown') {
        if (menu) {
          const m = menu;
          const i = Math.floor((e.y - m.y) / MENU_ROW);
          const inside = e.x >= m.x && e.x <= m.x + MENU_W && i >= 0 && i < m.options.length;
          menu = null;
          if (inside && e.button === 0) {
            const opt = m.options[i]!;
            if (opt.enabled) opt.run();
            return;
          }
        }
        if (e.button === 2) {
          openMenu(e.x, e.y);
          return;
        }
        if (e.button !== 0) return;
        const bi = bagIndexAt(e.x, e.y);
        const slot = slotAt(e.x, e.y);
        if (bi >= 0) drag = { kind: 'bag', index: bi, x: e.x, y: e.y, moved: false };
        else if (slot && hero().equipment[slot]) drag = { kind: 'worn', slot, x: e.x, y: e.y, moved: false };
        else {
          const cid = consumableAt(e.x, e.y);
          const qi = quickAt(e.x, e.y);
          if (cid && (isHeal(cid) || hero().consumables[cid] > 0)) drag = { kind: 'consumable', id: cid, x: e.x, y: e.y, moved: false };
          else if (qi >= 0 && hero().quickSlots[qi]) drag = { kind: 'quick', slot: qi, x: e.x, y: e.y, moved: false };
        }
        return;
      }
      if (e.type === 'mouseup' && drag) {
        const d = drag;
        drag = null;
        if (d.moved) drop(d, e.x, e.y);
        else if (d.kind === 'bag' || d.kind === 'worn') say('ПКМ — меню · перетягніть річ на фігуру, щоб вдягнути');
        else say('Перетягніть траву чи зілля на слот Z / X / C або ПКМ → «Поставити на…»');
      }
    },
    render(ctx) {
      const h = app.state.hero;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.75)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(20, 23, 33, 0.98)');
      drawText(ctx, 'Інвентар', PANEL.x + PANEL.w / 2, PANEL.y + 24, { size: 22, bold: true, align: 'center' });
      drawText(ctx, 'Tab / Esc — закрити · гра на паузі', PANEL.x + PANEL.w - 16, PANEL.y + 24, {
        size: 12,
        align: 'right',
        color: THEME.textDim,
      });
      drawText(ctx, 'Перетягніть річ на фігуру або ПКМ → «Вдягнути»', PANEL.x + 20, PANEL.y + 24, { size: 12, color: THEME.textDim });

      drawFigure(ctx, h.equipment, t);
      for (const slot of ITEM_SLOTS) {
        const { box, anchor } = SLOT_LAYOUT[slot.id];
        const item = h.equipment[slot.id];
        const dropTarget = drag?.kind === 'bag' && drag.moved && h.bag[drag.index]?.slot === slot.id;
        ctx.strokeStyle = 'rgba(160, 170, 195, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(box.x + box.w / 2, box.y + box.h / 2);
        ctx.lineTo(anchor.x, anchor.y);
        ctx.stroke();
        ctx.setLineDash([]);
        drawCell(ctx, box, item ?? null, slot.id, dropTarget);
        drawText(ctx, slot.name, box.x + box.w / 2, box.y + box.h + 12, { size: 12, align: 'center', color: THEME.textDim });
      }

      drawText(ctx, `Сумка (${h.bag.length})`, BAG_X, BAG_Y - 18, { size: 15, bold: true, color: THEME.accent });
      for (let i = 0; i < BAG_COLS * BAG_ROWS; i++) {
        const item = h.bag[i] ?? null;
        const cell = bagCell(i);
        const dragging = drag?.kind === 'bag' && drag.index === i && drag.moved;
        const lupaTarget = drag?.kind === 'consumable' && drag.id === 'magnifier' && drag.moved && item && !item.identified;
        drawCell(ctx, cell, dragging ? null : item, null, !!lupaTarget);
        if (item?.isNew && !dragging) {
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
          drawText(ctx, 'НОВЕ', cell.x + cell.w - 3, cell.y + 8, { size: 9, bold: true, align: 'right', color: THEME.accent });
          ctx.globalAlpha = 1;
        }
      }
      if (h.bag.length > BAG_COLS * BAG_ROWS) {
        drawText(ctx, `…і ще ${h.bag.length - BAG_COLS * BAG_ROWS}`, BAG_X + BAG_COLS * CELL - 6, BAG_Y - 18, { size: 12, align: 'right', color: THEME.textDim });
      }

      drawText(ctx, 'Витратні', BAG_X, CONS_Y - 12, { size: 13, bold: true, color: THEME.accent });
      CONSUMABLE_ORDER.forEach((id, i) => {
        const r = consumableCell(i);
        roundRect(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = '#20263a';
        ctx.fill();
        ctx.strokeStyle = THEME.panelBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        const n = h.consumables[id];
        ctx.globalAlpha = n > 0 ? 1 : 0.3;
        drawConsumableIcon(ctx, id, r.x + r.w / 2, r.y + r.h / 2 - 2, r.w * 0.62);
        ctx.globalAlpha = 1;
        drawText(ctx, `${n}`, r.x + r.w - 4, r.y + r.h - 7, { size: 11, bold: true, align: 'right', color: n > 0 ? THEME.text : THEME.textMuted });
      });
      drawText(ctx, 'Швидкі слоти (у бою):', BAG_X, QUICK_Y + CONS_CELL / 2, { size: 13, bold: true, color: THEME.accent });
      QUICK_SLOTS.labels.forEach((key, i) => {
        const r = quickCell(i);
        const id = h.quickSlots[i] ?? null;
        const target = drag?.moved && ((drag.kind === 'consumable' && isHeal(drag.id)) || drag.kind === 'quick');
        roundRect(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = id ? '#1f3324' : '#1a1f2d';
        ctx.fill();
        ctx.lineWidth = target ? 2.5 : 1.5;
        ctx.strokeStyle = target ? THEME.good : id ? THEME.good : THEME.panelBorder;
        if (!id) ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const dragged = drag?.kind === 'quick' && drag.slot === i && drag.moved;
        if (id && !dragged) {
          drawConsumableIcon(ctx, id, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6);
          drawText(ctx, `${h.consumables[id]}`, r.x + r.w - 4, r.y + r.h - 7, { size: 11, bold: true, align: 'right' });
        }
        drawText(ctx, key, r.x + 6, r.y + 9, { size: 11, bold: true, color: THEME.textDim });
      });

      const s = h.stats;
      const summary = [
        `HP ${h.maxHp}`,
        `Атака ${Math.round(s.attack)}`,
        `Броня ${Math.round(s.armor)}`,
        `Крит ${Math.round(s.critChance * 100)}%`,
        `Атак/с ${s.attackSpeed.toFixed(2)}`,
        `Рух ${Math.round(s.moveSpeed)}`,
        `Золото ${app.state.gold}`,
      ].join('  ·  ');
      drawText(ctx, summary, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 20, { size: 13, align: 'center' });
      if (messageTime > 0) {
        ctx.globalAlpha = Math.min(1, messageTime);
        drawText(ctx, message, FIG_X, PANEL.y + PANEL.h - 48, { size: 13, bold: true, align: 'center', color: THEME.bad });
        ctx.globalAlpha = 1;
      }

      const m = app.input.mouse;
      if (drag?.moved) {
        ctx.globalAlpha = 0.85;
        if (drag.kind === 'consumable') drawConsumableIcon(ctx, drag.id, m.x, m.y, 40);
        else if (drag.kind === 'quick') {
          const id = h.quickSlots[drag.slot];
          if (id) drawConsumableIcon(ctx, id, m.x, m.y, 40);
        } else {
          const item = drag.kind === 'bag' ? h.bag[drag.index] : h.equipment[drag.slot];
          if (item) drawItem(ctx, item, m.x, m.y, 46);
        }
        ctx.globalAlpha = 1;
      } else if (menu) {
        drawMenu(ctx, menu, m);
      } else {
        drawHoverTooltip(ctx, app, m);
      }
    },
  };
}

function drawHoverTooltip(ctx: CanvasRenderingContext2D, app: App, m: { x: number; y: number }): void {
  const h = app.state.hero;
  const W = app.view.width;
  const H = app.view.height;
  for (const slot of ITEM_SLOTS) {
    const item = h.equipment[slot.id];
    if (item && inRect(SLOT_LAYOUT[slot.id].box, m.x, m.y)) {
      drawTooltip(ctx, itemTooltip(item, ['ПКМ — зняти · перетягніть у сумку']), m.x, m.y, W, H);
      return;
    }
  }
  for (let i = 0; i < h.bag.length && i < BAG_COLS * BAG_ROWS; i++) {
    const item = h.bag[i]!;
    if (!inRect(bagCell(i), m.x, m.y)) continue;
    const worn = h.equipment[item.slot];
    const extra = [item.identified ? (worn ? `Замінить «${worn.name}»` : 'Слот вільний') : '', 'ПКМ — меню · перетягніть на фігуру'].filter(Boolean);
    drawTooltip(ctx, itemTooltip(item, extra), m.x, m.y, W, H);
    return;
  }
  CONSUMABLE_ORDER.forEach((id, i) => {
    if (!inRect(consumableCell(i), m.x, m.y)) return;
    const def = CONSUMABLES[id];
    const where = def.price > 0 ? `Торговець: ${def.price} зол.` : 'Росте на арені — підберіть';
    const hint = id === 'magnifier' ? 'Перетягніть на нерозпізнану річ' : 'Перетягніть на слот Z / X / C або ПКМ';
    drawTooltip(ctx, [def.name, describeConsumable(id), `У вас: ${h.consumables[id]} / ${def.max}`, where, hint], m.x, m.y, W, H);
  });
  QUICK_SLOTS.labels.forEach((key, i) => {
    if (!inRect(quickCell(i), m.x, m.y)) return;
    const id = h.quickSlots[i];
    const lines = id
      ? [`${key}: ${CONSUMABLES[id].name}`, describeConsumable(id), 'Перетягніть на інший слот або геть, щоб прибрати']
      : [`Слот ${key} порожній`, 'Перетягніть сюди траву чи зілля'];
    drawTooltip(ctx, lines, m.x, m.y, W, H);
  });
}

function drawMenu(ctx: CanvasRenderingContext2D, menu: { x: number; y: number; options: MenuOption[] }, m: { x: number; y: number }): void {
  const h = menu.options.length * MENU_ROW;
  roundRect(ctx, menu.x, menu.y, MENU_W, h, 6);
  ctx.fillStyle = 'rgba(12, 14, 20, 0.97)';
  ctx.fill();
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  menu.options.forEach((o, i) => {
    const y = menu.y + i * MENU_ROW;
    const hover = m.x >= menu.x && m.x <= menu.x + MENU_W && m.y >= y && m.y < y + MENU_ROW;
    if (hover && o.enabled) {
      ctx.fillStyle = 'rgba(242, 193, 78, 0.15)';
      ctx.fillRect(menu.x + 2, y + 2, MENU_W - 4, MENU_ROW - 4);
    }
    drawText(ctx, o.label, menu.x + 12, y + MENU_ROW / 2 + 1, { size: 13, color: o.enabled ? THEME.text : THEME.textMuted });
  });
}

function drawCell(ctx: CanvasRenderingContext2D, r: Rect, item: Item | null, emptySlot: ItemSlot | null, highlight = false): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = item ? '#262d42' : '#1a1f2d';
  ctx.fill();
  ctx.lineWidth = highlight ? 3 : item ? 2 : 1;
  ctx.strokeStyle = highlight ? THEME.good : item ? RARITIES[item.rarity].color : THEME.panelBorder;
  ctx.stroke();
  if (item) drawItem(ctx, item, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.66);
  else if (emptySlot) drawItemIcon(ctx, emptySlot, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.55, 'rgba(120, 128, 150, 0.25)');
}

/** A simple person made of shapes, wearing whatever is equipped. */
function drawFigure(ctx: CanvasRenderingContext2D, eq: Partial<Record<ItemSlot, Item>>, t: number): void {
  const x = FIG_X;
  const y = FIG_Y;
  const skin = '#d9b99b';
  const cloth = '#4a5068';
  const breathe = Math.sin(t * 2) * 1.5;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 300, 70, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = cloth;
  ctx.fillRect(x - 30, y + 170, 24, 115);
  ctx.fillRect(x + 6, y + 170, 24, 115);
  // Arms.
  ctx.fillStyle = skin;
  ctx.save();
  ctx.translate(x - 48, y + 70 + breathe);
  ctx.rotate(0.18);
  ctx.fillRect(-9, 0, 18, 92);
  ctx.restore();
  ctx.save();
  ctx.translate(x + 48, y + 70 + breathe);
  ctx.rotate(-0.25);
  ctx.fillRect(-9, 0, 18, 92);
  ctx.restore();
  // Torso: plain clothes, or the armor drawn big over it.
  ctx.fillStyle = cloth;
  roundRect(ctx, x - 44, y + 60 + breathe, 88, 118, 14);
  ctx.fill();
  if (eq.armor) drawItem(ctx, eq.armor, x, y + 118 + breathe, 120);
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y + 28 + breathe, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(x - 9, y + 26 + breathe, 3, 0, Math.PI * 2);
  ctx.arc(x + 9, y + 26 + breathe, 3, 0, Math.PI * 2);
  ctx.fill();
  if (eq.hat) drawItem(ctx, eq.hat, x, y + 4 + breathe, 70);
  if (eq.boots) {
    drawItem(ctx, eq.boots, x - 20, y + 280, 40);
    drawItem(ctx, eq.boots, x + 22, y + 280, 40);
  } else {
    ctx.fillStyle = '#3a3329';
    ctx.fillRect(x - 32, y + 280, 28, 12);
    ctx.fillRect(x + 4, y + 280, 28, 12);
  }
  if (eq.weapon) drawItem(ctx, eq.weapon, x + 72, y + 140 + breathe, 84);
  ctx.restore();
}
