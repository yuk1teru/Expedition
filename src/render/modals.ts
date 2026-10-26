// Modal windows: class choice (level 3) and card choice (levels 4+).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CLASS_ORDER, getClass } from '../data/classes';
import { describePassive, describeSkill, getPassive, getSkill } from '../data/skills';
import type { Card } from '../systems/cards';
import type { App } from './app';
import { drawClassIcon, drawPassiveIcon, drawSkillIcon } from './icons';
import { THEME, font } from './theme';
import { type Rect, drawText, inRect, roundRect, wrapLines } from './ui';

const CARD_W = 250;
const CARD_H = 320;
const CARD_GAP = 30;
const CARD_Y = 120;

function cardRects(viewW: number, n: number): Rect[] {
  const total = n * CARD_W + (n - 1) * CARD_GAP;
  const x0 = (viewW - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H }));
}

function dim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
  ctx.fillRect(0, 0, w, h);
}

interface CardFace {
  title: string;
  kindLabel: string;
  kindColor: string;
  rankLine: string;
  body: string;
  extra: string;
  drawIcon: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  locked: boolean;
  accent: string;
}

function drawCard(ctx: CanvasRenderingContext2D, r: Rect, face: CardFace, hovered: boolean, hotkey: number, t: number): void {
  const lift = hovered && !face.locked ? -6 : 0;
  const y = r.y + lift;
  ctx.save();
  ctx.globalAlpha = face.locked ? 0.55 : 1;
  roundRect(ctx, r.x, y, r.w, r.h, 14);
  ctx.fillStyle = '#1b2030';
  ctx.fill();
  ctx.lineWidth = hovered && !face.locked ? 3 : 1.5;
  ctx.strokeStyle = hovered && !face.locked ? face.accent : THEME.panelBorder;
  ctx.stroke();
  // Icon disc.
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2, y + 74, 46, 0, Math.PI * 2);
  ctx.fill();
  face.drawIcon(ctx, r.x + r.w / 2, y + 74);
  drawText(ctx, face.kindLabel, r.x + r.w / 2, y + 140, { size: 12, bold: true, align: 'center', color: face.kindColor });
  drawText(ctx, face.title, r.x + r.w / 2, y + 164, { size: 21, bold: true, align: 'center' });
  if (face.rankLine) drawText(ctx, face.rankLine, r.x + r.w / 2, y + 190, { size: 14, align: 'center', color: THEME.accent, bold: true });
  ctx.font = font(14);
  ctx.fillStyle = THEME.textDim;
  ctx.textAlign = 'center';
  const lines = wrapLines(ctx, face.body, r.w - 36);
  ctx.textBaseline = 'top';
  lines.slice(0, 5).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, y + 206 + i * 19));
  if (face.extra) {
    ctx.font = font(13, 'bold');
    ctx.fillStyle = THEME.good;
    const ex = wrapLines(ctx, face.extra, r.w - 36);
    ex.slice(0, 2).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, y + 206 + Math.min(lines.length, 5) * 19 + 6 + i * 18));
  }
  ctx.restore();
  if (face.locked) {
    ctx.save();
    ctx.translate(r.x + r.w / 2, y + 112);
    ctx.rotate(-0.18);
    roundRect(ctx, -90, -20, 180, 40, 8);
    ctx.fillStyle = 'rgba(20, 20, 26, 0.92)';
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, 'Незабаром', 0, 1, { size: 20, bold: true, align: 'center', color: THEME.accent });
    ctx.restore();
  } else {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    drawText(ctx, `[${hotkey}]`, r.x + r.w / 2, y + r.h - 18, {
      size: 13,
      align: 'center',
      color: hovered ? THEME.accent : `rgba(154, 163, 184, ${pulse})`,
    });
  }
}

export function createClassChoiceModal(app: App, onChosen: (classId: string) => void): Modal<CanvasRenderingContext2D> {
  const rects = cardRects(app.view.width, CLASS_ORDER.length);
  let hovered = -1;
  let t = 0;
  const choose = (i: number): void => {
    const id = CLASS_ORDER[i];
    if (!id || getClass(id).locked) return;
    onChosen(id);
  };
  return {
    id: 'classChoice',
    update(dt) {
      t += dt;
    },
    onInput(e: InputEvent) {
      if (e.type === 'mousemove') hovered = rects.findIndex((r) => inRect(r, e.x, e.y));
      else if (e.type === 'mousedown') {
        const i = rects.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) choose(i);
      } else if (/^Digit[1-3]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
    },
    render(ctx) {
      dim(ctx, app.view.width, app.view.height);
      drawText(ctx, 'Рівень 3 — оберіть клас', app.view.width / 2, 62, { size: 28, bold: true, align: 'center' });
      drawText(ctx, 'Клас дає базову атаку і перший скіл', app.view.width / 2, 92, {
        size: 15,
        align: 'center',
        color: THEME.textDim,
      });
      CLASS_ORDER.forEach((id, i) => {
        const c = getClass(id);
        const r = rects[i] as Rect;
        drawCard(
          ctx,
          r,
          {
            title: c.name,
            kindLabel: c.role.toUpperCase(),
            kindColor: c.color,
            rankLine: `Стартовий скіл: ${c.startingSkillName}`,
            body: c.description,
            extra: c.locked ? '' : `HP ×${c.hpMult}`,
            drawIcon: (cx, x, y) => drawClassIcon(cx, c.icon, x, y, 64, c.color),
            locked: c.locked,
            accent: c.color,
          },
          hovered === i,
          i + 1,
          t,
        );
      });
    },
  };
}

function cardFace(card: Card): CardFace {
  if (card.kind === 'passive') {
    const p = getPassive(card.passiveId);
    return {
      title: p.name,
      kindLabel: 'ПАСИВКА',
      kindColor: '#9b8cff',
      rankLine: `Стак ${card.stacks} → ${card.stacks + 1} (макс. ${p.maxStacks})`,
      body: describePassive(p.id),
      extra: '',
      drawIcon: (ctx, x, y) => drawPassiveIcon(ctx, p.stat, x, y, 56, '#9b8cff'),
      locked: false,
      accent: '#9b8cff',
    };
  }
  const s = getSkill(card.skillId);
  if (card.kind === 'newSkill') {
    return {
      title: s.name,
      kindLabel: 'НОВИЙ СКІЛ',
      kindColor: THEME.good,
      rankLine: 'Ранг 1',
      body: describeSkill(s.id, 1),
      extra: '',
      drawIcon: (ctx, x, y) => drawSkillIcon(ctx, s.icon, x, y, 56, THEME.good),
      locked: false,
      accent: THEME.good,
    };
  }
  return {
    title: s.name,
    kindLabel: 'ПОКРАЩЕННЯ',
    kindColor: THEME.accent,
    rankLine: `Ранг ${card.fromRank} → ${card.toRank}`,
    body: card.toRank === 3 ? `Особливий модифікатор: ${s.rank3Modifier.text}` : '+30% шкоди, −10% перезарядки.',
    extra: '',
    drawIcon: (ctx, x, y) => drawSkillIcon(ctx, s.icon, x, y, 56, THEME.accent),
    locked: false,
    accent: THEME.accent,
  };
}

export function createCardChoiceModal(app: App, offer: Card[], level: number, onChosen: (card: Card) => void): Modal<CanvasRenderingContext2D> {
  const rects = cardRects(app.view.width, offer.length);
  let hovered = -1;
  let t = 0;
  const choose = (i: number): void => {
    const c = offer[i];
    if (c) onChosen(c);
  };
  return {
    id: 'cardChoice',
    update(dt) {
      t += dt;
    },
    onInput(e: InputEvent) {
      if (e.type === 'mousemove') hovered = rects.findIndex((r) => inRect(r, e.x, e.y));
      else if (e.type === 'mousedown') {
        const i = rects.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) choose(i);
      } else if (/^Digit[1-3]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
    },
    render(ctx) {
      dim(ctx, app.view.width, app.view.height);
      drawText(ctx, `Новий рівень ${level}! Оберіть картку`, app.view.width / 2, 62, { size: 28, bold: true, align: 'center' });
      drawText(ctx, 'Мишею або клавішами 1–3 · гра на паузі', app.view.width / 2, 92, {
        size: 15,
        align: 'center',
        color: THEME.textDim,
      });
      offer.forEach((card, i) => drawCard(ctx, rects[i] as Rect, cardFace(card), hovered === i, i + 1, t));
    },
  };
}
