// Inventory (Tab, or "Спорядження" in town): a figure wearing the items,
// slot boxes around it, the bag as an icon grid. Click a bag item to wear it,
// click a worn slot to take it off. The game is paused while it is open.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { ITEM_SLOTS, type ItemSlot, RARITIES } from '../data/items';
import { type Item, equipFromBag, formatStat, markItemsSeen, unequip } from '../systems/items';
import type { App } from './app';
import { drawItemIcon } from './icons';
import { THEME } from './theme';
import { type Rect, drawPanel, drawText, drawTooltip, inRect, roundRect } from './ui';

const PANEL: Rect = { x: 50, y: 34, w: 860, h: 472 };
const FIG_X = 250;
const FIG_Y = 120;
const SLOT_SIZE = 64;
const CELL = 58;
const BAG_COLS = 6;
const BAG_ROWS = 5;
const BAG_X = 500;
const BAG_Y = 110;

/** Slot boxes around the figure and the body point each one links to. */
const SLOT_LAYOUT: Record<ItemSlot, { box: Rect; anchor: { x: number; y: number } }> = {
  hat: { box: { x: FIG_X - 170, y: FIG_Y - 10, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X - 20, y: FIG_Y + 10 } },
  armor: { box: { x: FIG_X - 170, y: FIG_Y + 110, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X - 30, y: FIG_Y + 120 } },
  weapon: { box: { x: FIG_X + 106, y: FIG_Y + 70, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X + 62, y: FIG_Y + 150 } },
  boots: { box: { x: FIG_X + 106, y: FIG_Y + 220, w: SLOT_SIZE, h: SLOT_SIZE }, anchor: { x: FIG_X + 26, y: FIG_Y + 280 } },
};

function bagCell(i: number): Rect {
  return { x: BAG_X + (i % BAG_COLS) * CELL, y: BAG_Y + Math.floor(i / BAG_COLS) * CELL, w: CELL - 6, h: CELL - 6 };
}

function itemTooltip(item: Item, action: string): string[] {
  const slot = ITEM_SLOTS.find((s) => s.id === item.slot)?.name ?? '';
  return [item.name, `${slot} · ${RARITIES[item.rarity].name}`, ...item.stats.map(formatStat), action];
}

export function createInventoryModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  let t = 0;
  return {
    id: 'inventory',
    exit() {
      markItemsSeen(app.state.hero);
    },
    update(dt) {
      t += dt;
    },
    onInput(e: InputEvent) {
      if (e.type === 'key' && (e.code === 'Escape' || e.code === 'Tab')) {
        onClose();
        return;
      }
      if (e.type !== 'mousedown') return;
      const hero = app.state.hero;
      for (const slot of ITEM_SLOTS) {
        if (inRect(SLOT_LAYOUT[slot.id].box, e.x, e.y)) {
          unequip(hero, slot.id);
          return;
        }
      }
      for (let i = 0; i < hero.bag.length && i < BAG_COLS * BAG_ROWS; i++) {
        if (inRect(bagCell(i), e.x, e.y)) {
          equipFromBag(hero, i);
          return;
        }
      }
    },
    render(ctx) {
      const hero = app.state.hero;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.75)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(20, 23, 33, 0.98)');
      drawText(ctx, 'Інвентар', PANEL.x + PANEL.w / 2, PANEL.y + 24, { size: 22, bold: true, align: 'center' });
      drawText(ctx, 'Tab / Esc — закрити · гра на паузі', PANEL.x + PANEL.w - 16, PANEL.y + 24, {
        size: 12,
        align: 'right',
        color: THEME.textDim,
      });

      drawFigure(ctx, hero.equipment, t);
      for (const slot of ITEM_SLOTS) {
        const { box, anchor } = SLOT_LAYOUT[slot.id];
        const item = hero.equipment[slot.id];
        ctx.strokeStyle = 'rgba(160, 170, 195, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(box.x + box.w / 2, box.y + box.h / 2);
        ctx.lineTo(anchor.x, anchor.y);
        ctx.stroke();
        ctx.setLineDash([]);
        drawCell(ctx, box, item ?? null, slot.id);
        drawText(ctx, slot.name, box.x + box.w / 2, box.y + box.h + 12, { size: 12, align: 'center', color: THEME.textDim });
      }

      drawText(ctx, `Сумка (${hero.bag.length})`, BAG_X, BAG_Y - 22, { size: 15, bold: true, color: THEME.accent });
      drawText(ctx, 'клік — вдягнути', BAG_X + BAG_COLS * CELL - 6, BAG_Y - 22, { size: 12, align: 'right', color: THEME.textDim });
      for (let i = 0; i < BAG_COLS * BAG_ROWS; i++) {
        const item = hero.bag[i] ?? null;
        const cell = bagCell(i);
        drawCell(ctx, cell, item, null);
        if (item?.isNew) {
          const blink = 0.6 + 0.4 * Math.sin(t * 6);
          ctx.globalAlpha = blink;
          drawText(ctx, 'НОВЕ', cell.x + cell.w - 3, cell.y + 8, { size: 9, bold: true, align: 'right', color: THEME.accent });
          ctx.globalAlpha = 1;
        }
      }
      if (hero.bag.length > BAG_COLS * BAG_ROWS) {
        drawText(ctx, `…і ще ${hero.bag.length - BAG_COLS * BAG_ROWS}`, BAG_X, BAG_Y + BAG_ROWS * CELL + 8, { size: 12, color: THEME.textDim });
      }

      const s = hero.stats;
      const summary = [
        `HP ${hero.maxHp}`,
        `Атака ${Math.round(s.attack)}`,
        `Броня ${Math.round(s.armor)}`,
        `Крит ${Math.round(s.critChance * 100)}%`,
        `Атак/с ${s.attackSpeed.toFixed(2)}`,
        `Рух ${Math.round(s.moveSpeed)}`,
      ].join('   ·   ');
      drawText(ctx, summary, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 22, { size: 14, align: 'center' });

      // Tooltip.
      const m = app.input.mouse;
      for (const slot of ITEM_SLOTS) {
        const item = hero.equipment[slot.id];
        if (item && inRect(SLOT_LAYOUT[slot.id].box, m.x, m.y)) drawTooltip(ctx, itemTooltip(item, 'клік — зняти в сумку'), m.x, m.y, app.view.width, app.view.height);
      }
      for (let i = 0; i < hero.bag.length && i < BAG_COLS * BAG_ROWS; i++) {
        const item = hero.bag[i]!;
        if (inRect(bagCell(i), m.x, m.y)) {
          const worn = hero.equipment[item.slot];
          const lines = itemTooltip(item, worn ? `клік — вдягнути замість «${worn.name}»` : 'клік — вдягнути');
          drawTooltip(ctx, lines, m.x, m.y, app.view.width, app.view.height);
        }
      }
    },
  };
}

function drawCell(ctx: CanvasRenderingContext2D, r: Rect, item: Item | null, emptySlot: ItemSlot | null): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = item ? '#262d42' : '#1a1f2d';
  ctx.fill();
  ctx.lineWidth = item ? 2 : 1;
  ctx.strokeStyle = item ? RARITIES[item.rarity].color : THEME.panelBorder;
  ctx.stroke();
  if (item) drawItemIcon(ctx, item.slot, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62, RARITIES[item.rarity].color);
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
  // Shadow.
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
  // Torso.
  const armor = eq.armor;
  ctx.fillStyle = armor ? RARITIES[armor.rarity].color : cloth;
  roundRect(ctx, x - 44, y + 60 + breathe, 88, 118, 14);
  ctx.fill();
  if (armor) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 66 + breathe);
    ctx.lineTo(x, y + 170 + breathe);
    ctx.moveTo(x - 36, y + 110 + breathe);
    ctx.lineTo(x + 36, y + 110 + breathe);
    ctx.stroke();
  }
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
  // Hat.
  const hat = eq.hat;
  if (hat) drawItemIcon(ctx, 'hat', x, y + 2 + breathe, 70, RARITIES[hat.rarity].color);
  // Boots.
  const boots = eq.boots;
  if (boots) {
    drawItemIcon(ctx, 'boots', x - 20, y + 282, 38, RARITIES[boots.rarity].color);
    drawItemIcon(ctx, 'boots', x + 22, y + 282, 38, RARITIES[boots.rarity].color);
  } else {
    ctx.fillStyle = '#3a3329';
    ctx.fillRect(x - 32, y + 280, 28, 12);
    ctx.fillRect(x + 4, y + 280, 28, 12);
  }
  // Weapon in the right hand.
  const weapon = eq.weapon;
  if (weapon) drawItemIcon(ctx, 'weapon', x + 72, y + 140 + breathe, 80, RARITIES[weapon.rarity].color);
  ctx.restore();
}
