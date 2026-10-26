// Level-13 promotion: two big branch cards (mechanic, signature skill, passives).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CARDS, PROGRESSION, RANKS } from '../data/balance';
import { getClass } from '../data/classes';
import { type PromotionDef, classPromotions } from '../data/promotions';
import { describePassive, describeSkillFull, getPassive, getSkill } from '../data/skills';
import type { App } from './app';
import { drawRankDots } from './hud';
import { drawClassIcon, drawPassiveIcon, drawSkillIcon } from './icons';
import { dim, drawInputDelay } from './modals';
import { skillTooltip, wrapPlain } from './skillText';
import { THEME, font } from './theme';
import { type Rect, drawText, drawTooltip, inRect, roundRect, wrapLines } from './ui';

const CARD = { w: 380, h: 430, gap: 36, y: 86 };

function cardRects(viewW: number): Rect[] {
  const x0 = (viewW - (2 * CARD.w + CARD.gap)) / 2;
  return [0, 1].map((i) => ({ x: x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h }));
}

interface CardLayout {
  signature: Rect;
  passives: Rect[];
}

function layout(r: Rect, p: PromotionDef): CardLayout {
  return {
    signature: { x: r.x + 16, y: r.y + 212, w: r.w - 32, h: 104 },
    passives: p.passives.map((_, i) => ({ x: r.x + 16, y: r.y + 344 + i * 24, w: r.w - 32, h: 22 })),
  };
}

function drawBranchCard(ctx: CanvasRenderingContext2D, p: PromotionDef, r: Rect, hovered: boolean, hotkey: number, t: number): void {
  const c = getClass(p.classId);
  const cx = r.x + r.w / 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#1b2030';
  ctx.fill();
  ctx.lineWidth = hovered ? 3 : 1.5;
  ctx.strokeStyle = hovered ? p.color : THEME.panelBorder;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(cx, r.y + 44, 30, 0, Math.PI * 2);
  ctx.fill();
  drawClassIcon(ctx, c.icon, cx, r.y + 44, 44, p.color);
  drawText(ctx, `${c.name} → ${p.name}`, cx, r.y + 92, { size: 22, bold: true, align: 'center' });
  drawText(ctx, p.description, cx, r.y + 116, { size: 13, align: 'center', color: p.color, bold: true });
  ctx.font = font(13);
  wrapLines(ctx, p.mechanic, r.w - 36)
    .slice(0, 3)
    .forEach((l, i) => drawText(ctx, l, cx, r.y + 142 + i * 17, { size: 13, align: 'center', color: THEME.text }));

  const L = layout(r, p);
  const sig = getSkill(p.signature);
  drawText(ctx, 'Фірмовий скіл · окремий слот [R]', L.signature.x, L.signature.y - 12, { size: 12, bold: true, color: THEME.accent });
  roundRect(ctx, L.signature.x, L.signature.y, L.signature.w, L.signature.h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  drawSkillIcon(ctx, sig.icon, L.signature.x + 26, L.signature.y + 28, 30, p.color);
  drawText(ctx, sig.name, L.signature.x + 50, L.signature.y + 20, { size: 15, bold: true });
  drawRankDots(ctx, L.signature.x + L.signature.w - 34, L.signature.y + 20, 1, 7, 2.5);
  ctx.font = font(12);
  wrapLines(ctx, describeSkillFull(sig.id, 1), L.signature.w - 64)
    .slice(0, 4)
    .forEach((l, i) => drawText(ctx, l, L.signature.x + 50, L.signature.y + 40 + i * 15, { size: 12, color: THEME.textDim }));

  drawText(ctx, 'Пасивки гілки · картки з подвійною вагою', L.signature.x, (L.passives[0]?.y ?? r.y) - 10, { size: 12, bold: true, color: '#9b8cff' });
  p.passives.forEach((id, i) => {
    const pr = L.passives[i]!;
    const def = getPassive(id);
    drawPassiveIcon(ctx, def.stat, pr.x + 8, pr.y + pr.h / 2, 12, '#9b8cff');
    drawText(ctx, def.name, pr.x + 22, pr.y + pr.h / 2, { size: 13 });
    drawText(ctx, `до ×${def.maxStacks}`, pr.x + pr.w, pr.y + pr.h / 2, { size: 12, align: 'right', color: THEME.textDim });
  });
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  drawText(ctx, `[${hotkey}] обрати`, cx, r.y + r.h - 16, { size: 13, align: 'center', color: hovered ? THEME.accent : `rgba(154, 163, 184, ${pulse})` });
}

export function createPromotionModal(app: App, onChosen: (branchId: string) => void): Modal<CanvasRenderingContext2D> {
  const classId = app.state.hero.classId ?? '';
  const branches = classPromotions(classId);
  const rects = cardRects(app.view.width);
  let hovered = -1;
  let t = 0;
  const choose = (i: number): void => {
    const p = branches[i];
    if (!p || t < CARDS.inputDelay) return;
    onChosen(p.id);
  };
  return {
    id: 'promotion',
    update(dt) {
      t += dt;
    },
    onInput(e: InputEvent) {
      if (e.type === 'mousemove') hovered = rects.findIndex((r) => inRect(r, e.x, e.y));
      else if (e.type === 'mousedown') {
        const i = rects.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) choose(i);
      } else if (e.type === 'key' && /^Digit[1-2]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
    },
    render(ctx) {
      const W = app.view.width;
      dim(ctx, W, app.view.height);
      drawText(ctx, `Рівень ${PROGRESSION.promotionLevel} — підвищення класу`, W / 2, 30, { size: 26, bold: true, align: 'center' });
      drawText(ctx, `Гілка дає пасивну механіку, фірмовий скіл (${RANKS.max} рангів) і свої картки до рівня ${PROGRESSION.maxLevel}`, W / 2, 56, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });
      branches.forEach((p, i) => drawBranchCard(ctx, p, rects[i]!, hovered === i, i + 1, t));
      drawInputDelay(ctx, W / 2, 72, t);
      const m = app.input.mouse;
      branches.forEach((p, i) => {
        const L = layout(rects[i]!, p);
        if (inRect(L.signature, m.x, m.y)) {
          const tip = skillTooltip(p.signature, 0);
          drawTooltip(ctx, tip.lines, m.x, m.y, W, app.view.height, tip.colors);
        }
        p.passives.forEach((id, k) => {
          if (!inRect(L.passives[k]!, m.x, m.y)) return;
          const def = getPassive(id);
          drawTooltip(ctx, [def.name, ...wrapPlain(`За стак: ${describePassive(id)}`, 56), `До ×${def.maxStacks} стаків`], m.x, m.y, W, app.view.height);
        });
      });
    },
  };
}
