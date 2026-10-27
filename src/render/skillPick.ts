// After the class choice: pick the free starting skills from the first row of the tree (2 of 3).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { PROGRESSION, RANKS } from '../data/balance';
import { getClass } from '../data/classes';
import { startingSkills } from '../systems/talents';
import { describeSkillFull, getSkill } from '../data/skills';
import type { App } from './app';
import { drawSkillIcon } from './icons';
import { THEME, font } from './theme';
import { skillTooltip } from './skillText';
import { Button, ButtonGroup, type Rect, drawText, drawTooltip, fitFontSize, inRect, roundRect, wrapLines } from './ui';

const COLS = 3;
const CARD_W = 210;
const CARD_H = 160;
const GAP = 14;
const TOP = 96;

function cardRect(i: number, viewW: number): Rect {
  const total = COLS * CARD_W + (COLS - 1) * GAP;
  const x0 = (viewW - total) / 2;
  return { x: x0 + (i % COLS) * (CARD_W + GAP), y: TOP + Math.floor(i / COLS) * (CARD_H + GAP), w: CARD_W, h: CARD_H };
}

export function createSkillPickModal(app: App, classId: string, onDone: (picks: string[]) => void): Modal<CanvasRenderingContext2D> {
  const c = { ...getClass(classId), skills: startingSkills(classId) };
  const need = PROGRESSION.startingSkillPicks;
  const picks: string[] = [];
  let hovered = -1;
  const toggle = (i: number): void => {
    const id = c.skills[i];
    if (!id) return;
    const at = picks.indexOf(id);
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length < need) picks.push(id);
  };
  const confirm = new Button({
    label: '',
    rect: { x: app.view.width / 2 - 150, y: TOP + CARD_H + GAP + 40, w: 300, h: 44 },
    hotkey: 'Enter',
    onClick: () => {
      if (picks.length === need) onDone([...picks]);
    },
  });
  const buttons = new ButtonGroup([confirm]);

  return {
    id: 'skillPick',
    update() {
      confirm.enabled = picks.length === need;
      confirm.label = confirm.enabled ? 'Почати з цими скілами' : `Оберіть ще ${need - picks.length}`;
    },
    onInput(e: InputEvent) {
      if (e.type === 'mousemove') hovered = c.skills.findIndex((_, i) => inRect(cardRect(i, app.view.width), e.x, e.y));
      else if (e.type === 'mousedown' && e.button === 0) {
        const i = c.skills.findIndex((_, k) => inRect(cardRect(k, app.view.width), e.x, e.y));
        if (i >= 0) {
          toggle(i);
          return;
        }
      } else if (e.type === 'key' && /^Digit[1-3]$/.test(e.code)) {
        toggle(Number(e.code.slice(5)) - 1);
        return;
      }
      confirm.enabled = picks.length === need;
      buttons.handle(e);
    },
    render(ctx) {
      const W = app.view.width;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.82)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawText(ctx, `${c.name}: оберіть ${need} скіли з ${c.skills.length}`, W / 2, 40, { size: 26, bold: true, align: 'center' });
      drawText(ctx, `Безкоштовно. Решту скілів відкриєш у дереві талантів (T) за очки рівнів · клік або 1–${c.skills.length} · обрано ${picks.length}/${need}`, W / 2, 70, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });
      c.skills.forEach((id, i) => {
        const r = cardRect(i, W);
        const def = getSkill(id);
        const order = picks.indexOf(id);
        const selected = order >= 0;
        roundRect(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = selected ? '#1f3324' : '#1b2030';
        ctx.fill();
        ctx.lineWidth = selected ? 3 : hovered === i ? 2.5 : 1.5;
        ctx.strokeStyle = selected ? THEME.good : hovered === i ? THEME.accent : THEME.panelBorder;
        ctx.stroke();
        drawSkillIcon(ctx, def.icon, r.x + 30, r.y + 30, 34, selected ? THEME.good : '#f4f1e8');
        // Long names (Ланцюгова блискавка) shrink to fit the card.
        drawText(ctx, def.name, r.x + 56, r.y + 24, { size: fitFontSize(ctx, def.name, r.w - 56 - 12, 16, true), bold: true });
        drawText(ctx, `[${i + 1}]${def.aimable ? ' · наводиться мишею' : ''}`, r.x + 56, r.y + 42, { size: 11, color: THEME.textDim });
        ctx.font = font(12);
        ctx.fillStyle = THEME.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapLines(ctx, describeSkillFull(id, 1), r.w - 24)
          .slice(0, 5)
          .forEach((l, k) => ctx.fillText(l, r.x + 12, r.y + 60 + k * 16));
        drawText(ctx, `Ранги 1–${RANKS.max} · наведіть, щоб побачити всі`, r.x + 12, r.y + r.h - 14, { size: 10, color: '#e8c48a' });
        if (selected) {
          ctx.fillStyle = THEME.good;
          ctx.beginPath();
          ctx.arc(r.x + r.w - 18, r.y + 18, 12, 0, Math.PI * 2);
          ctx.fill();
          drawText(ctx, String(order + 1), r.x + r.w - 18, r.y + 19, { size: 13, bold: true, align: 'center', color: '#0d1016' });
        }
      });
      buttons.draw(ctx);
      const m = app.input.mouse;
      const id = hovered >= 0 && inRect(cardRect(hovered, W), m.x, m.y) ? c.skills[hovered] : undefined;
      if (id) {
        const tip = skillTooltip(id, 0);
        drawTooltip(ctx, tip.lines, m.x, m.y, W, app.view.height, tip.colors);
      }
    },
  };
}
