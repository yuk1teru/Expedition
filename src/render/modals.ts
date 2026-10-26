// Modal windows: class choice (level 3) and card choice (levels 4+).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { PROGRESSION, RANKS } from '../data/balance';
import { CLASS_ORDER, getClass } from '../data/classes';
import { describePassive, describeSkill, getPassive, getSkill } from '../data/skills';
import type { Card } from '../systems/cards';
import type { App } from './app';
import { drawClassIcon, drawPassiveIcon, drawSkillIcon } from './icons';
import { THEME, font } from './theme';
import { type Rect, drawText, drawTooltip, inRect, roundRect, wrapLines } from './ui';

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

const CLASS_CARD_Y = 84;
const CLASS_CARD_H = 424;
const LINE_H = 22;

interface ClassLine {
  name: string;
  note: string;
  skillId?: string;
  passiveId?: string;
  passiveStat?: string;
  /** Rect for hover tooltips. */
  rect: Rect;
}

/** Skill and passive lines of a class card (from data, or the preview for locked classes). */
function classLines(classId: string, r: Rect): { skills: ClassLine[]; passives: ClassLine[] } {
  const c = getClass(classId);
  const x = r.x + 16;
  const w = r.w - 32;
  const skillY = r.y + 186;
  const passiveY = skillY + PROGRESSION.skillSlots * LINE_H + 30;
  const skillNames = c.skills.length > 0 ? c.skills.map((id) => getSkill(id).name) : (c.preview?.skills ?? []);
  const skills: ClassLine[] = skillNames.map((name, i) => ({
    name,
    note: name === c.startingSkillName ? 'старт' : '',
    skillId: c.skills[i],
    rect: { x, y: skillY + i * LINE_H - LINE_H / 2, w, h: LINE_H },
  }));
  const passiveInfo =
    c.passives.length > 0
      ? c.passives.map((id) => {
          const p = getPassive(id);
          return { name: p.name, max: p.maxStacks, stat: p.stat as string | undefined, id: p.id as string | undefined };
        })
      : (c.preview?.passives ?? []).map((name) => ({ name, max: c.preview?.passiveMaxStacks ?? 0, stat: undefined, id: undefined }));
  const passives: ClassLine[] = passiveInfo.map((p, i) => ({
    name: p.name,
    note: `до ×${p.max}`,
    passiveId: p.id,
    passiveStat: p.stat,
    rect: { x, y: passiveY + i * LINE_H - LINE_H / 2, w, h: LINE_H },
  }));
  return { skills, passives };
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = THEME.textDim;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawClassCard(ctx: CanvasRenderingContext2D, classId: string, r: Rect, hovered: boolean, hotkey: number, t: number): void {
  const c = getClass(classId);
  const active = hovered && !c.locked;
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#1b2030';
  ctx.fill();
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.strokeStyle = active ? c.color : THEME.panelBorder;
  ctx.stroke();
  ctx.globalAlpha = c.locked ? 0.55 : 1;
  const cx = r.x + r.w / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(cx, r.y + 46, 32, 0, Math.PI * 2);
  ctx.fill();
  drawClassIcon(ctx, c.icon, cx, r.y + 46, 46, c.color);
  drawText(ctx, c.name, cx, r.y + 96, { size: 22, bold: true, align: 'center' });
  drawText(ctx, c.role, cx, r.y + 120, { size: 13, bold: true, align: 'center', color: c.color });
  drawText(ctx, c.description, cx, r.y + 142, { size: 13, align: 'center', color: THEME.textDim });

  const lines = classLines(classId, r);
  drawText(ctx, `Скіли · ${RANKS.max} ранги (${RANKS.max - 1} покращення)`, r.x + 16, r.y + 166, {
    size: 12,
    bold: true,
    color: THEME.accent,
  });
  for (const l of lines.skills) {
    const y = l.rect.y + LINE_H / 2;
    const def = l.skillId ? getSkill(l.skillId) : null;
    if (def) drawSkillIcon(ctx, def.icon, l.rect.x + 8, y, 15, THEME.text);
    else dot(ctx, l.rect.x + 8, y);
    drawText(ctx, l.name, l.rect.x + 22, y, { size: 14 });
    if (l.note) drawText(ctx, l.note, l.rect.x + l.rect.w - 34, y, { size: 11, align: 'right', color: THEME.good, bold: true });
    for (let k = 0; k < RANKS.max; k++) {
      ctx.fillStyle = THEME.accent;
      ctx.beginPath();
      ctx.arc(l.rect.x + l.rect.w - 22 + k * 8, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const passiveHeaderY = (lines.passives[0]?.rect.y ?? r.y) - 8;
  drawText(ctx, 'Пасивки · стаки', r.x + 16, passiveHeaderY, { size: 12, bold: true, color: '#9b8cff' });
  for (const l of lines.passives) {
    const y = l.rect.y + LINE_H / 2;
    if (l.passiveStat) drawPassiveIcon(ctx, l.passiveStat, l.rect.x + 8, y, 14, '#9b8cff');
    else dot(ctx, l.rect.x + 8, y);
    drawText(ctx, l.name, l.rect.x + 22, y, { size: 14 });
    drawText(ctx, l.note, l.rect.x + l.rect.w, y, { size: 12, align: 'right', color: THEME.textDim });
  }
  if (!c.locked) drawText(ctx, `HP ×${c.hpMult}`, cx, r.y + r.h - 42, { size: 13, bold: true, align: 'center', color: THEME.good });
  ctx.restore();

  if (c.locked) {
    ctx.save();
    ctx.translate(cx, r.y + 46);
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
    drawText(ctx, `[${hotkey}] обрати`, cx, r.y + r.h - 16, {
      size: 13,
      align: 'center',
      color: active ? THEME.accent : `rgba(154, 163, 184, ${pulse})`,
    });
  }
}

function skillTooltip(skillId: string): string[] {
  const def = getSkill(skillId);
  return [
    def.name,
    ...wrapPlain(`Ранг 1: ${describeSkill(skillId, 1)}`, 56),
    'Ранг 2: +30% шкоди, −10% перезарядки',
    ...wrapPlain(`Ранг 3: ${def.rank3Modifier.text}`, 56),
  ];
}

function passiveTooltip(passiveId: string): string[] {
  const p = getPassive(passiveId);
  return [p.name, ...wrapPlain(`За стак: ${describePassive(passiveId)}`, 56), `До ×${p.maxStacks} стаків, кожна картка пасивки дає +1`];
}

function wrapPlain(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (`${line} ${w}`.trim().length > max && line) {
      out.push(line);
      line = w;
    } else line = `${line} ${w}`.trim();
  }
  if (line) out.push(line);
  return out;
}

export function createClassChoiceModal(app: App, onChosen: (classId: string) => void): Modal<CanvasRenderingContext2D> {
  const rects = cardRects(app.view.width, CLASS_ORDER.length).map((r) => ({ ...r, y: CLASS_CARD_Y, h: CLASS_CARD_H }));
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
      } else if (e.type === 'key' && /^Digit[1-3]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
    },
    render(ctx) {
      dim(ctx, app.view.width, app.view.height);
      drawText(ctx, 'Рівень 3 — оберіть клас', app.view.width / 2, 34, { size: 26, bold: true, align: 'center' });
      drawText(ctx, 'Клас дає базову атаку і перший скіл; решту скілів і покращень дають картки на нових рівнях', app.view.width / 2, 62, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });
      CLASS_ORDER.forEach((id, i) => drawClassCard(ctx, id, rects[i] as Rect, hovered === i, i + 1, t));
      // Tooltip for the skill line under the mouse.
      const m = app.input.mouse;
      CLASS_ORDER.forEach((id, i) => {
        const lines = classLines(id, rects[i] as Rect);
        const sk = lines.skills.find((l) => inRect(l.rect, m.x, m.y));
        const ps = lines.passives.find((l) => inRect(l.rect, m.x, m.y));
        let tip: string[] | null = null;
        if (sk) tip = sk.skillId ? skillTooltip(sk.skillId) : [sk.name, 'Опис з’явиться разом із класом'];
        else if (ps) tip = ps.passiveId ? passiveTooltip(ps.passiveId) : [ps.name, 'Опис з’явиться разом із класом'];
        if (tip) drawTooltip(ctx, tip, m.x, m.y, app.view.width, app.view.height);
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
      } else if (e.type === 'key' && /^Digit[1-3]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
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
