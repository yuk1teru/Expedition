// Combat HUD: HP, XP, level, class, gold, day, wave, pause/speed buttons, skill bar.

import type { InputEvent } from '../core/input';
import { ARENA, PROGRESSION } from '../data/balance';
import { FX } from '../data/fx';
import { describeSkill, getSkill } from '../data/skills';
import type { Battle } from '../systems/battle';
import { isMaxLevel, xpFraction } from '../systems/leveling';
import { slotCooldown, useSkill } from '../systems/skills';
import type { App } from './app';
import type { Fx } from './fx';
import { drawSkillIcon } from './icons';
import { className } from './names';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawBar, drawText, drawTooltip, inRect, roundRect } from './ui';

export interface Hud {
  reset(): void;
  update(dt: number): void;
  /** Returns true if the HUD consumed the input. */
  handle(e: InputEvent): boolean;
  draw(ctx: CanvasRenderingContext2D, b: Battle): void;
  useSlot(slot: number): void;
  noTarget(slot: number): void;
}

const SLOT = 56;
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
  const barY = ARENA.y + ARENA.h + (app.view.height - ARENA.y - ARENA.h - SLOT) / 2;
  for (let i = 0; i < n; i++) slots.push({ x: (W - total) / 2 + i * (SLOT + SLOT_GAP), y: barY, w: SLOT, h: SLOT });
  const noTargetT = new Array<number>(n).fill(0);
  let hoverSlot = -1;

  const hud: Hud = {
    reset() {
      noTargetT.fill(0);
    },
    update(dt) {
      for (let i = 0; i < n; i++) noTargetT[i] = Math.max(0, (noTargetT[i] ?? 0) - dt);
    },
    useSlot(slot) {
      if (app.battle) useSkill(app.battle, slot);
    },
    noTarget(slot) {
      noTargetT[slot] = FX.noTargetFlash;
    },
    handle(e) {
      if (e.type === 'mousemove') hoverSlot = slots.findIndex((r) => inRect(r, e.x, e.y));
      if (e.type === 'mousedown') {
        const i = slots.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) {
          if (!app.loop.paused) hud.useSlot(i);
          return true;
        }
      }
      return buttons.handle(e);
    },
    draw(ctx, b) {
      const state = app.state;
      const hero = state.hero;
      ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
      ctx.fillRect(0, 0, W, ARENA.y);
      ctx.fillRect(0, ARENA.y + ARENA.h, W, app.view.height - ARENA.y - ARENA.h);

      // Level badge.
      ctx.fillStyle = '#2a3145';
      ctx.beginPath();
      ctx.arc(32, 28, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, String(hero.level), 32, 29, { size: 18, bold: true, align: 'center' });

      drawBar(ctx, { x: 62, y: 9, w: 250, h: 20 }, hero.hp / hero.maxHp, THEME.hp, THEME.hpBack, `${Math.ceil(hero.hp)} / ${hero.maxHp}`);
      drawBar(ctx, { x: 62, y: 34, w: 250, h: 11 }, xpFraction(hero.level, hero.xp), THEME.xp, 'rgba(0,0,0,0.5)', isMaxLevel(hero.level) ? 'МАКС' : '');
      drawText(ctx, className(hero.classId), 324, 19, { size: 15, bold: true, color: hero.classId ? THEME.text : THEME.textDim });
      drawText(ctx, `Атака ${Math.round(hero.stats.attack)} · Броня ${Math.round(hero.stats.armor)}`, 324, 39, {
        size: 12,
        color: THEME.textDim,
      });

      if (b.waves) {
        const w = b.waves;
        drawText(ctx, `Хвиля ${Math.min(w.total, w.index + 1)}/${w.total}`, W / 2, 20, { size: 17, bold: true, align: 'center' });
        drawText(ctx, b.node.name, W / 2, 41, { size: 12, align: 'center', color: THEME.textDim });
      }

      drawText(ctx, `${state.gold}`, W - 240, 20, { size: 16, bold: true, align: 'right', color: THEME.accent });
      drawText(ctx, 'золото', W - 236, 20, { size: 11, color: THEME.textDim });
      drawText(ctx, `День ${state.day}`, W - 240, 40, { size: 12, align: 'right', color: THEME.textDim });

      pauseBtn.label = app.loop.paused ? 'Далі' : 'Пауза';
      speedBtn.label = `×${app.loop.speed}`;
      buttons.draw(ctx);

      drawSkillBar(ctx, b, slots, noTargetT, hoverSlot);
      drawText(ctx, '1–4 — скіли · Пробіл — пауза', W - 12, app.view.height - 12, { size: 11, align: 'right', color: THEME.textMuted });

      const hs = hoverSlot >= 0 ? hero.skills[hoverSlot] : undefined;
      if (hs) {
        const def = getSkill(hs.id);
        const lines = [
          `${def.name} — ранг ${hs.rank}`,
          ...wrapPlain(describeSkill(hs.id, hs.rank), 52),
          `Перезарядка: ${slotCooldown(b, hoverSlot).toFixed(1)} с`,
        ];
        if (hs.rank >= 3) lines.push(`Ранг 3: ${def.rank3Modifier.text}`);
        drawTooltip(ctx, lines, app.input.mouse.x, ARENA.y + ARENA.h - 150, W, app.view.height);
      }
    },
  };
  return hud;
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
    const s = hero.skills[i];
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
      drawText(ctx, 'Немає цілі', r.x + r.w / 2, r.y - 10, { size: 12, bold: true, align: 'center', color: THEME.bad });
      ctx.globalAlpha = 1;
    }
  });
}
