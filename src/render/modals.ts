// Modal windows: class choice (level 3) and card choice (levels 4+).

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { CARDS, PROGRESSION, RANKS } from '../data/balance';
import { CLASS_ORDER, getClass } from '../data/classes';
import { describePassive, describeSkillFull, getPassive, getSkill, isSpecialRank, rankChanges } from '../data/skills';
import { type Card, rerollPrice, skipGold } from '../systems/cards';
import { skillInSlot } from '../systems/hero';
import type { App } from './app';
import { drawRankDots } from './hud';
import { skillTooltip, wrapPlain } from './skillText';
import { drawClassIcon, drawPassiveIcon, drawSkillIcon } from './icons';
import { THEME, font } from './theme';
import { Button, ButtonGroup, type Rect, drawText, drawTooltip, inRect, roundRect, wrapLines } from './ui';

const CARD_W = 250;
const CARD_H = 320;
const CARD_GAP = 30;
const CARD_Y = 120;

function cardRects(viewW: number, n: number): Rect[] {
  const total = n * CARD_W + (n - 1) * CARD_GAP;
  const x0 = (viewW - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H }));
}

export function dim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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
  ctx.font = font(13);
  ctx.fillStyle = THEME.textDim;
  ctx.textAlign = 'center';
  const lines = wrapLines(ctx, face.body, r.w - 28);
  ctx.textBaseline = 'top';
  lines.slice(0, 6).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, y + 204 + i * 16));
  if (face.extra) {
    ctx.font = font(13, 'bold');
    ctx.fillStyle = THEME.good;
    const ex = wrapLines(ctx, face.extra, r.w - 36);
    ex.slice(0, 2).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, y + 204 + Math.min(lines.length, 6) * 16 + 4 + i * 16));
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
    drawText(ctx, `[${hotkey}]`, r.x + r.w / 2, y + r.h - 11, {
      size: 13,
      align: 'center',
      color: hovered ? THEME.accent : `rgba(154, 163, 184, ${pulse})`,
    });
  }
}

const CLASS_CARD_Y = 80;
const CLASS_CARD_H = 448;
/** Compact list rows: the warrior pool has 8 skills. */
const LINE_H = 17;

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
  const skillY = r.y + 216;
  const skillNames = c.skills.length > 0 ? c.skills.map((id) => getSkill(id).name) : (c.preview?.skills ?? []);
  const passiveY = skillY + skillNames.length * LINE_H + 24;
  const skills: ClassLine[] = skillNames.map((name, i) => ({
    name,
    note: '',
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
  drawText(ctx, c.traitText, cx, r.y + 142, { size: 12, bold: true, align: 'center', color: '#9fdf7a' });
  ctx.font = font(12);
  wrapLines(ctx, `Автоатака: ${c.basicAttack.description}`, r.w - 28)
    .slice(0, 2)
    .forEach((l, i) => drawText(ctx, l, cx, r.y + 162 + i * 15, { size: 12, align: 'center', color: '#e8c48a' }));

  const lines = classLines(classId, r);
  const skillHeader =
    c.skills.length > 0
      ? `Скіли: оберете ${PROGRESSION.startingSkillPicks} з ${c.skills.length} · ранги 1–${RANKS.max}`
      : `Скіли · ${RANKS.max} рангів (${RANKS.max - 1} покращення)`;
  drawText(ctx, skillHeader, r.x + 16, r.y + 196, {
    size: 12,
    bold: true,
    color: THEME.accent,
  });
  for (const l of lines.skills) {
    const y = l.rect.y + LINE_H / 2;
    const def = l.skillId ? getSkill(l.skillId) : null;
    if (def) drawSkillIcon(ctx, def.icon, l.rect.x + 8, y, 13, THEME.text);
    else dot(ctx, l.rect.x + 8, y);
    drawText(ctx, l.name, l.rect.x + 22, y, { size: 13 });
    if (l.note) drawText(ctx, l.note, l.rect.x + l.rect.w - 44, y, { size: 11, align: 'right', color: THEME.good, bold: true });
    drawRankDots(ctx, l.rect.x + l.rect.w - 18, y, RANKS.max, 6, 2);
  }
  const passiveHeaderY = (lines.passives[0]?.rect.y ?? r.y) - 8;
  drawText(ctx, 'Пасивки · стаки', r.x + 16, passiveHeaderY, { size: 12, bold: true, color: '#9b8cff' });
  for (const l of lines.passives) {
    const y = l.rect.y + LINE_H / 2;
    if (l.passiveStat) drawPassiveIcon(ctx, l.passiveStat, l.rect.x + 8, y, 12, '#9b8cff');
    else dot(ctx, l.rect.x + 8, y);
    drawText(ctx, l.name, l.rect.x + 22, y, { size: 13 });
    drawText(ctx, l.note, l.rect.x + l.rect.w, y, { size: 12, align: 'right', color: THEME.textDim });
  }
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

function passiveTooltip(passiveId: string): string[] {
  const p = getPassive(passiveId);
  return [p.name, ...wrapPlain(`За стак: ${describePassive(passiveId)}`, 56), `До ×${p.maxStacks} стаків, кожна картка пасивки дає +1`];
}

export function createClassChoiceModal(app: App, onChosen: (classId: string) => void): Modal<CanvasRenderingContext2D> {
  const rects = cardRects(app.view.width, CLASS_ORDER.length).map((r) => ({ ...r, y: CLASS_CARD_Y, h: CLASS_CARD_H }));
  let hovered = -1;
  let t = 0;
  const choose = (i: number): void => {
    const id = CLASS_ORDER[i];
    if (!id || getClass(id).locked || t < CARDS.inputDelay) return;
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
      drawText(ctx, 'Клас дає автоатаку; далі ви оберете 3 скіли з 8, решту дадуть картки на нових рівнях', app.view.width / 2, 58, {
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
        if (sk?.skillId) {
          const tip = skillTooltip(sk.skillId, 0);
          drawTooltip(ctx, tip.lines, m.x, m.y, app.view.width, app.view.height, tip.colors);
          return;
        }
        let tip: string[] | null = null;
        if (sk) tip = [sk.name, 'Опис з’явиться разом із класом'];
        else if (ps) tip = ps.passiveId ? passiveTooltip(ps.passiveId) : [ps.name, 'Опис з’явиться разом із класом'];
        if (tip) drawTooltip(ctx, tip, m.x, m.y, app.view.width, app.view.height);
      });
      drawInputDelay(ctx, app.view.width / 2, 71, t);
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
      rankLine: `Ранг 1 з ${RANKS.max}`,
      body: describeSkillFull(s.id, 1),
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
    rankLine: `Ранг ${card.fromRank} → ${card.toRank} (з ${RANKS.max})`,
    body: rankChanges(s.id, card.toRank),
    extra: isSpecialRank(s.id, card.toRank) ? 'Особливий модифікатор' : '',
    drawIcon: (ctx, x, y) => drawSkillIcon(ctx, s.icon, x, y, 56, THEME.accent),
    locked: false,
    accent: THEME.accent,
  };
}

export interface CardChoiceHandlers {
  onChosen: (card: Card) => void;
  /** Pays for a new offer; null if the hero can't afford it. */
  onReroll: (rerolls: number) => Card[] | null;
  onSkip: () => void;
}

export function createCardChoiceModal(app: App, firstOffer: Card[], level: number, bossReward: boolean, h: CardChoiceHandlers): Modal<CanvasRenderingContext2D> {
  let offer = firstOffer;
  let rects = cardRects(app.view.width, offer.length);
  let hovered = -1;
  let t = 0;
  let rerolls = 0;
  const ready = (): boolean => t >= CARDS.inputDelay;
  const choose = (i: number): void => {
    const c = offer[i];
    if (c && ready()) h.onChosen(c);
  };
  const W = app.view.width;
  const ROW_Y = CARD_Y + CARD_H + 10;
  const rerollBtn = new Button({
    label: '',
    rect: { x: rects[0]?.x ?? 75, y: ROW_Y, w: 250, h: 34 },
    hotkey: 'KeyR',
    fontSize: 14,
    onClick: () => {
      if (!ready()) return;
      const next = h.onReroll(rerolls);
      if (!next || next.length === 0) return;
      rerolls += 1;
      offer = next;
      rects = cardRects(W, offer.length);
    },
  });
  const skip = CARDS.skip;
  const skipBtn = new Button({
    label: `Пропустити: +${skipGold(level)} зол. і баф`,
    rect: { x: W - (rects[0]?.x ?? 75) - 250, y: ROW_Y, w: 250, h: 34 },
    fontSize: 14,
    onClick: () => {
      if (ready()) h.onSkip();
    },
  });
  const buttons = new ButtonGroup([rerollBtn, skipBtn]);
  return {
    id: 'cardChoice',
    update(dt) {
      t += dt;
      const price = rerollPrice(rerolls);
      rerollBtn.label = `Перекинути [R] — ${price} зол.`;
      rerollBtn.enabled = ready() && app.state.gold >= price;
      skipBtn.enabled = ready();
    },
    onInput(e: InputEvent) {
      if (buttons.handle(e)) return;
      if (e.type === 'mousemove') hovered = rects.findIndex((r) => inRect(r, e.x, e.y));
      else if (e.type === 'mousedown') {
        const i = rects.findIndex((r) => inRect(r, e.x, e.y));
        if (i >= 0) choose(i);
      } else if (e.type === 'key' && /^Digit[1-3]$/.test(e.code)) choose(Number(e.code.slice(5)) - 1);
    },
    render(ctx) {
      dim(ctx, app.view.width, app.view.height);
      drawText(ctx, bossReward ? 'Нагорода за боса! Оберіть картку' : `Новий рівень ${level}! Оберіть картку`, app.view.width / 2, 62, { size: 28, bold: true, align: 'center', color: bossReward ? THEME.accent : THEME.text });
      drawText(ctx, 'Мишею або клавішами 1–3 · гра на паузі', app.view.width / 2, 92, {
        size: 15,
        align: 'center',
        color: THEME.textDim,
      });
      ctx.save();
      if (!ready()) ctx.globalAlpha = 0.55;
      offer.forEach((card, i) => drawCard(ctx, rects[i] as Rect, cardFace(card), ready() && hovered === i, i + 1, t));
      ctx.restore();
      drawInputDelay(ctx, W / 2, 106, t);
      buttons.draw(ctx);
      drawText(ctx, `Золото: ${app.state.gold}`, W / 2, ROW_Y + 17, { size: 14, bold: true, align: 'center', color: THEME.accent });
      if (inRect(skipBtn.rect, app.input.mouse.x, app.input.mouse.y)) {
        drawTooltip(
          ctx,
          [
            'Пропустити вибір',
            `+${skipGold(level)} золота`,
            `На ${skip.buff.duration} с: +${skip.buff.regen} HP/с, +${Math.round((skip.buff.damageMult - 1) * 100)}% шкоди, +${Math.round((skip.buff.moveSpeedMult - 1) * 100)}% швидкості руху`,
            'Поза боєм баф почнеться з наступним боєм',
          ],
          app.input.mouse.x,
          app.input.mouse.y - 110,
          W,
          app.view.height,
        );
      }
      drawCurrentSkills(ctx, app);
      // Hovering an offered skill card shows every rank of that skill.
      const card = hovered >= 0 ? offer[hovered] : undefined;
      if (card && card.kind !== 'passive' && inRect(rects[hovered] as Rect, app.input.mouse.x, app.input.mouse.y)) {
        const rank = app.state.hero.skills.find((x) => x.id === card.skillId)?.rank ?? 0;
        const tip = skillTooltip(card.skillId, rank);
        drawTooltip(ctx, tip.lines, app.input.mouse.x, app.input.mouse.y, W, app.view.height, tip.colors);
      }
    },
  };
}

/** One-line "choice in N s" bar: cards ignore input for a moment so skill keys don't pick one. */
export function drawInputDelay(ctx: CanvasRenderingContext2D, cx: number, y: number, t: number): void {
  if (t >= CARDS.inputDelay) return;
  const w = 140;
  const x = cx - w / 2 - 50;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y - 2, w, 4);
  ctx.fillStyle = THEME.accent;
  ctx.fillRect(x, y - 2, w * (t / CARDS.inputDelay), 4);
  drawText(ctx, `вибір через ${(CARDS.inputDelay - t).toFixed(1)} с`, x + w + 10, y, { size: 11, color: THEME.textDim });
}

const MINI_SLOT = 40;

/** The hero's current skill bar under the cards, with tooltips: what each skill does now. */
function drawCurrentSkills(ctx: CanvasRenderingContext2D, app: App): void {
  const hero = app.state.hero;
  // The signature slot (R) shows up after the promotion.
  const n = skillInSlot(hero, PROGRESSION.signatureSlot) ? PROGRESSION.signatureSlot + 1 : PROGRESSION.skillSlots;
  const gap = 10;
  const total = n * MINI_SLOT + (n - 1) * gap;
  const x0 = app.view.width / 2 - total / 2;
  const y = CARD_Y + CARD_H + 54;
  drawText(ctx, 'Ваші скіли зараз (наведіть, щоб подивитись):', x0 - 14, y + MINI_SLOT / 2, { size: 13, align: 'right', color: THEME.textDim });
  const m = app.input.mouse;
  let tip: ReturnType<typeof skillTooltip> | null = null;
  for (let i = 0; i < n; i++) {
    const r = { x: x0 + i * (MINI_SLOT + gap), y, w: MINI_SLOT, h: MINI_SLOT };
    const s = skillInSlot(hero, i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = s ? '#232a3b' : 'rgba(35, 42, 59, 0.4)';
    ctx.fill();
    ctx.strokeStyle = s ? THEME.accent : THEME.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!s) continue;
    const def = getSkill(s.id);
    drawSkillIcon(ctx, def.icon, r.x + r.w / 2, r.y + r.h / 2 - 3, r.w * 0.55, '#f4f1e8');
    drawRankDots(ctx, r.x + r.w / 2, r.y + r.h - 5, s.rank, 6, 2);
    if (inRect(r, m.x, m.y)) tip = skillTooltip(s.id, s.rank, [], hero.stats.cooldownMult);
  }
  if (tip) drawTooltip(ctx, tip.lines, m.x, 10, app.view.width, app.view.height, tip.colors);
}
