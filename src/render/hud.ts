// Combat HUD: HP, XP, level, class, gold, day, wave, pause/speed buttons, skill bar.

import type { InputEvent } from '../core/input';
import { ARENA, PROGRESSION } from '../data/balance';
import { FX } from '../data/fx';
import { describeSkill, getSkill } from '../data/skills';
import { heroAttackSpeed } from '../systems/ai';
import type { Battle } from '../systems/battle';
import { isMaxLevel, xpFraction } from '../systems/leveling';
import { xpToNext } from '../systems/scaling';
import { nextWaveIn, portalActive, wavesToPortal } from '../systems/waves';
import { moveSkill, skillInSlot } from '../systems/hero';
import { hasNewItems } from '../systems/items';
import { slotCooldown, useSkill } from '../systems/skills';
import type { App } from './app';
import { syncBattleInput } from './battleInput';
import type { Fx } from './fx';
import { drawBossBar } from './bossView';
import { drawConsumableIcon, drawSkillIcon } from './icons';
import { className } from './names';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawBar, drawText, drawTooltip, inRect, roundRect } from './ui';

export interface Hud {
  reset(): void;
  update(dt: number): void;
  /** Returns true if the HUD consumed the input. */
  handle(e: InputEvent): boolean;
  draw(ctx: CanvasRenderingContext2D, b: Battle): void;
  /** Tooltips; drawn last so they sit above the pause panel. */
  drawOverlay(ctx: CanvasRenderingContext2D, b: Battle): void;
  useSlot(slot: number): void;
  noTarget(slot: number): void;
}

const SLOT = 48;
/** XP bar sits in the bottom HUD right above the skill bar. */
const XP_BAR = { top: 6, h: 8 };
const LEVEL_BADGE_R = 19;
/** Centre of the wave/location block in the top band (left of it are hero stats). */
const CENTER_X = 588;
/** Width of the centre block (boss HP bar). */
const CENTER_W = 270;

function waveTitle(b: Battle): string {
  const w = b.waves;
  if (!w) return '';
  return `Хвиля ${w.index + 1}`;
}
const DRAG_THRESHOLD = 6;
const SLOT_GAP = 14;

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
  const slots: Rect[] = [];
  const n = PROGRESSION.skillSlots;
  const total = n * SLOT + (n - 1) * SLOT_GAP;
  const barY = ARENA.y + ARENA.h + XP_BAR.top + XP_BAR.h + 6;
  for (let i = 0; i < n; i++) slots.push({ x: (W - total) / 2 + i * (SLOT + SLOT_GAP), y: barY, w: SLOT, h: SLOT });
  const noTargetT = new Array<number>(n).fill(0);
  let hoverSlot = -1;
  /** Slot being dragged (skill reordering), -1 if none. */
  let dragFrom = -1;
  let dragStart = { x: 0, y: 0 };
  let dragMoved = false;

  const hud: Hud = {
    reset() {
      noTargetT.fill(0);
    },
    update(dt) {
      for (let i = 0; i < n; i++) noTargetT[i] = Math.max(0, (noTargetT[i] ?? 0) - dt);
    },
    useSlot(slot) {
      if (!app.battle) return;
      syncBattleInput(app.input, app.battle);
      useSkill(app.battle, slot);
    },
    noTarget(slot) {
      noTargetT[slot] = FX.noTargetFlash;
    },
    handle(e) {
      if (e.type === 'mousemove') {
        hoverSlot = slots.findIndex((r) => inRect(r, e.x, e.y));
        if (dragFrom >= 0 && Math.hypot(e.x - dragStart.x, e.y - dragStart.y) > DRAG_THRESHOLD) dragMoved = true;
      }
      if (e.type === 'mousedown') {
        const i = slots.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) {
          // Click (release on the same slot) uses the skill; dragging onto another slot reorders.
          if (skillInSlot(app.state.hero, i)) {
            dragFrom = i;
            dragStart = { x: e.x, y: e.y };
            dragMoved = false;
          }
          return true;
        }
      }
      if (e.type === 'mouseup' && dragFrom >= 0) {
        const from = dragFrom;
        dragFrom = -1;
        const to = slots.findIndex((r) => inRect(r, e.x, e.y));
        if (!dragMoved && to === from) {
          if (!app.loop.paused) hud.useSlot(from);
        } else if (to >= 0 && to !== from) {
          moveSkill(app.state.hero, from, to);
        }
        return true;
      }
      return buttons.handle(e);
    },
    draw(ctx, b) {
      const state = app.state;
      const hero = state.hero;
      ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
      ctx.fillRect(0, 0, W, ARENA.y);
      ctx.fillRect(0, ARENA.y + ARENA.h, W, app.view.height - ARENA.y - ARENA.h);

      drawText(ctx, className(hero.classId), 16, 19, { size: 15, bold: true, color: hero.classId ? THEME.text : THEME.textDim });
      drawText(ctx, `Атака ${Math.round(hero.stats.attack)} · ${heroAttackSpeed(hero).toFixed(2)}/с · Броня ${Math.round(hero.stats.armor)}`, 16, 39, {
        size: 12,
        color: THEME.textDim,
      });

      const bossLike = b.boss ?? b.enemies.find((e) => e.boss && !e.dead) ?? null;
      if (bossLike && !bossLike.dead) {
        // Boss / miniboss HP lives in the HUD, never over the arena.
        const top = b.waves ? `${waveTitle(b)} · ${b.node.name}` : 'Бій з босом';
        drawText(ctx, top, CENTER_X, 11, { size: 12, bold: true, align: 'center', color: b.waves ? THEME.textDim : THEME.bad });
        drawBossBar(ctx, bossLike, { x: CENTER_X - CENTER_W / 2, y: 21, w: CENTER_W, h: 24 });
      } else if (b.waves) {
        const w = b.waves;
        const breakNow = !w.started && w.cleared > 0;
        const title = portalActive(b) ? 'Перерва — портал відкрито' : breakNow ? 'Перерва' : `Хвиля ${w.index + 1}`;
        drawText(ctx, title, CENTER_X, 20, { size: 17, bold: true, align: 'center', color: portalActive(b) ? THEME.accent : THEME.text });
        const next = nextWaveIn(w);
        const toPortal = wavesToPortal(w);
        const sub =
          breakNow && next !== null && next > 0
            ? `Хвиля ${w.index + 1} через ${Math.ceil(next)} с`
            : toPortal === 1
              ? 'Портал — після цієї хвилі'
              : `Портал — через ${toPortal} хвилі`;
        drawText(ctx, sub, CENTER_X, 41, { size: 12, align: 'center', color: b.portal ? '#c9a8ff' : THEME.textDim });
        if (portalActive(b)) {
          const left = Math.ceil(nextWaveIn(w) ?? 0);
          drawText(ctx, `Портал відкритий ще ${left} с: підійдіть і натисніть «Увійти» (E). Залишитесь — прийде сильніша хвиля.`, W / 2, ARENA.y + ARENA.h - 14, {
            size: 13,
            bold: true,
            align: 'center',
            color: '#d9c2ff',
          });
        }
      }

      drawText(ctx, `${state.gold} зол.`, W - 162, 20, { size: 15, bold: true, align: 'right', color: THEME.accent });
      drawText(ctx, `День ${state.day}`, W - 162, 40, { size: 12, align: 'right', color: THEME.textDim });

      pauseBtn.label = app.loop.paused ? 'Далі' : 'Пауза';
      speedBtn.label = `×${app.loop.speed}`;
      buttons.draw(ctx);

      drawSkillBar(ctx, b, slots, noTargetT, hoverSlot);
      if (hasNewItems(hero)) drawNewItemHint(ctx, W - 14, ARENA.y + ARENA.h + 40, app.time, 'right');
      drawLevelAndXp(ctx, hero.level, hero.xp, slots, ARENA.y + ARENA.h + XP_BAR.top);
      drawHerbSlot(ctx, hero.consumables.herb, hero.herbCooldown, slots);
      if (dragFrom >= 0 && dragMoved) drawDragGhost(ctx, b, dragFrom, slots, app.input.mouse);

    },
    drawOverlay(ctx, b) {
      const hero = app.state.hero;
      const hs = hoverSlot >= 0 ? skillInSlot(hero, hoverSlot) : undefined;
      if (hs) {
        const def = getSkill(hs.id);
        const lines = [
          `${def.name} — ранг ${hs.rank}`,
          ...wrapPlain(describeSkill(hs.id, hs.rank), 52),
          `Перезарядка: ${slotCooldown(b, hoverSlot).toFixed(1)} с`,
        ];
        if (hs.rank >= 3) lines.push(`Ранг 3: ${def.rank3Modifier.text}`);
        if (def.aimable) lines.push('Напрямок — курсор миші на арені');
        lines.push('Перетягніть слот, щоб переставити');
        if (dragFrom < 0) drawTooltip(ctx, lines, app.input.mouse.x, ARENA.y + ARENA.h - 170, W, app.view.height);
      }
    },
  };
  return hud;
}

/** Blinking "new item" reminder. */
export function drawNewItemHint(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, align: CanvasTextAlign): void {
  ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.5));
  drawText(ctx, '★ Нова річ — Tab, щоб вдягнути', x, y, { size: 13, bold: true, align, color: THEME.accent });
  ctx.globalAlpha = 1;
}

/** Carried healing herbs, used with G, right of the skill bar. */
function drawHerbSlot(ctx: CanvasRenderingContext2D, count: number, cooldown: number, slots: Rect[]): void {
  const last = slots[slots.length - 1];
  if (!last) return;
  const r = { x: last.x + last.w + SLOT_GAP + 8, y: last.y, w: last.w, h: last.h };
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = count > 0 ? '#1f3324' : 'rgba(35, 42, 59, 0.4)';
  ctx.fill();
  ctx.strokeStyle = count > 0 && cooldown <= 0 ? THEME.good : THEME.panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = count > 0 ? 1 : 0.35;
  drawConsumableIcon(ctx, 'herb', r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6);
  ctx.globalAlpha = 1;
  drawText(ctx, 'G', r.x + 7, r.y + 10, { size: 11, bold: true, color: THEME.textDim });
  drawText(ctx, `×${count}`, r.x + r.w - 4, r.y + r.h - 8, { size: 12, bold: true, align: 'right' });
}

/** Level badge left of the skill bar and the XP bar above it. */
function drawLevelAndXp(ctx: CanvasRenderingContext2D, level: number, xp: number, slots: Rect[], y: number): void {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return;
  const cx = first.x - LEVEL_BADGE_R - 14;
  const cy = first.y + first.h / 2;
  ctx.fillStyle = '#2a3145';
  ctx.beginPath();
  ctx.arc(cx, cy, LEVEL_BADGE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, String(level), cx, cy + 1, { size: 17, bold: true, align: 'center' });
  const x0 = cx - LEVEL_BADGE_R;
  const x1 = last.x + last.w;
  drawBar(ctx, { x: x0, y, w: x1 - x0, h: XP_BAR.h }, xpFraction(level, xp), THEME.xp, 'rgba(255,255,255,0.08)');
  const label = isMaxLevel(level) ? 'МАКС' : `${Math.floor(xp)} / ${xpToNext(level)} досвіду`;
  drawText(ctx, label, x1 + 8, y + XP_BAR.h / 2 + 1, { size: 10, color: THEME.xp });
}

function drawDragGhost(ctx: CanvasRenderingContext2D, b: Battle, from: number, slots: Rect[], m: { x: number; y: number }): void {
  const s = skillInSlot(b.hero, from);
  if (!s) return;
  const target = slots.findIndex((r) => inRect(r, m.x, m.y));
  const t = slots[target];
  if (t && target !== from) {
    roundRect(ctx, t.x - 3, t.y - 3, t.w + 6, t.h + 6, 12);
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 0.8;
  roundRect(ctx, m.x - SLOT / 2, m.y - SLOT / 2, SLOT, SLOT, 10);
  ctx.fillStyle = '#2d3650';
  ctx.fill();
  drawSkillIcon(ctx, getSkill(s.id).icon, m.x, m.y, SLOT * 0.6, '#f4f1e8');
  ctx.globalAlpha = 1;
}

function wrapPlain(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max && line) {
      out.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function drawSkillBar(ctx: CanvasRenderingContext2D, b: Battle, slots: Rect[], noTarget: number[], hover: number): void {
  const hero = b.hero;
  slots.forEach((r, i) => {
    const s = skillInSlot(hero, i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = s ? '#232a3b' : 'rgba(35, 42, 59, 0.4)';
    ctx.fill();
    if (!s) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = THEME.panelBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, String(i + 1), r.x + 8, r.y + 10, { size: 11, color: THEME.textMuted });
      return;
    }
    const def = getSkill(s.id);
    const full = slotCooldown(b, i);
    const ready = s.cooldown <= 0;
    drawSkillIcon(ctx, def.icon, r.x + r.w / 2, r.y + r.h / 2 - 2, r.w * 0.6, ready ? '#f4f1e8' : '#7d8496');
    if (!ready && full > 0) {
      // Radial cooldown: dark wedge for the remaining part.
      const frac = Math.min(1, s.cooldown / full);
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2);
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawText(ctx, s.cooldown >= 1 ? String(Math.ceil(s.cooldown)) : s.cooldown.toFixed(1), r.x + r.w / 2, r.y + r.h / 2, {
        size: 17,
        bold: true,
        align: 'center',
      });
    }
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const nt = noTarget[i] ?? 0;
    ctx.lineWidth = nt > 0 ? 3 : hover === i ? 2.5 : 1.5;
    ctx.strokeStyle = nt > 0 ? THEME.bad : ready ? THEME.accent : THEME.panelBorder;
    ctx.stroke();
    // Key and rank dots.
    drawText(ctx, String(i + 1), r.x + 8, r.y + 10, { size: 11, bold: true, color: THEME.textDim });
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < s.rank ? THEME.accent : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2 + (k - 1) * 9, r.y + r.h - 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (nt > 0) {
      ctx.globalAlpha = Math.min(1, nt / (FX.noTargetFlash * 0.5));
      drawText(ctx, 'Немає цілі', r.x + r.w / 2, r.y - 24, { size: 12, bold: true, align: 'center', color: THEME.bad });
      ctx.globalAlpha = 1;
    }
  });
}
