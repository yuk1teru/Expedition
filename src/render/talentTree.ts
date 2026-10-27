// The talent tree window (ROADMAP 12.7, key T): three rows of the class tree with prices,
// a click spends points (a fork rank asks which variant), the pin puts a learned skill on
// the panel 1–5 or takes it off. Out of battle only.

import type { Modal } from '../core/screens';
import { PROGRESSION, RANKS } from '../data/balance';
import { getPromotion } from '../data/promotions';
import { ELEMENTS } from '../data/elements';
import { describePassive, getPassive, getSkill } from '../data/skills';
import { TALENTS, TALENT_TREES } from '../data/talents';
import { BRANCH_ROW, type TalentNode, branchNodes, canLearn, learn, nextCost, nextFork, pointsSpent, rowOpen, setPanelSlot, treeNodes, firstFreeClassSlot } from '../systems/talents';
import type { App } from './app';
import { drawPassiveIcon, drawSkillIcon } from './icons';
import { skillTooltip } from './skillText';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, drawTooltip, fitFontSize, inRect, roundRect } from './ui';

const NODE_W = 132;
const NODE_H = 66;
const GAP = 12;
const ROW_H = 102;

export function createTalentTreeModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  const panel = { x: 16, y: 14, w: W - 32, h: H - 28 };
  const state = app.state;
  const hero = state.hero;
  const classId = hero.classId ?? '';
  const nodes = treeNodes(classId);
  let hovered: TalentNode | null = null;
  let note = '';
  let noteTime = 0;
  /** A fork waiting for the choice: the skill and the rank. */
  let fork: { node: TalentNode; rank: 3 | 5 } | null = null;
  const say = (text: string): void => {
    note = text;
    noteTime = 2.5;
  };

  /** Where a node sits: rows top to bottom, nodes left to right. */
  const rects = new Map<TalentNode, Rect>();
  const rowsCount = TALENT_TREES[classId]?.length ?? 0;
  for (let row = 1; row <= rowsCount; row++) {
    const inRow = nodes.filter((n) => n.row === row);
    inRow.forEach((n, i) => rects.set(n, { x: panel.x + 120 + i * (NODE_W + GAP), y: panel.y + 64 + (row - 1) * ROW_H, w: NODE_W, h: NODE_H }));
  }
  // The specialization: a column on the right (from level 12 on).
  const branchX = panel.x + panel.w - NODE_W - 24;
  branchNodes(hero).forEach((n, i) => rects.set(n, { x: branchX, y: panel.y + 64 + i * (NODE_H + 10), w: NODE_W, h: NODE_H }));
  /** The pin of a learned skill: on / off the panel. */
  const pinRect = (r: Rect): Rect => ({ x: r.x + r.w - 26, y: r.y + r.h - 22, w: 22, h: 18 });

  const forkButtons = new ButtonGroup();
  const openFork = (n: TalentNode, rank: 3 | 5): void => {
    fork = { node: n, rank };
    const opts = getSkill(n.id).forks!.find((f) => f.rank === rank)!.options;
    forkButtons.clear();
    opts.forEach((o, i) =>
      forkButtons.add(
        new Button({
          label: o.name,
          rect: { x: W / 2 - 290 + i * 300, y: H / 2 + 20, w: 280, h: 40 },
          fontSize: 15,
          hotkey: `Digit${i + 1}`,
          onClick: () => {
            if (learn(state, n, i as 0 | 1)) say(`${getSkill(n.id).name}: «${o.name}»`);
            fork = null;
          },
        }),
      ),
    );
    forkButtons.add(new Button({ label: 'Скасувати', rect: { x: W / 2 - 70, y: H / 2 + 76, w: 140, h: 32 }, fontSize: 13, hotkey: 'Escape', onClick: () => (fork = null) }));
  };

  const click = (n: TalentNode): void => {
    const check = canLearn(state, n);
    if (check === 'rowLocked') return say(`Ряд ${n.row} відкриється після ${TALENTS.rowUnlock[n.row - 1]} очок у дереві`);
    if (check === 'maxed') {
      if (n.kind === 'skill' && n.row === BRANCH_ROW && !hero.skills.some((x) => x.id === n.id)) return say(`Другий скіл гілки прийде на ${PROGRESSION.promotion2Level} рівні`);
      return say('Уже на максимумі');
    }
    if (check === 'noPoints') return say('Бракує очок таланту: вони приходять з рівнями й квестами');
    if (check !== 'ok') return;
    if (n.kind === 'skill') {
      const at = nextFork(hero, n.id);
      if (at) return openFork(n, at);
    }
    learn(state, n);
  };

  const close = new ButtonGroup([new Button({ label: 'Закрити [T / Esc]', rect: { x: panel.x + panel.w - 190, y: panel.y + panel.h - 46, w: 174, h: 34 }, fontSize: 13, hotkey: 'Escape', onClick: onClose })]);

  return {
    id: 'talents',
    update(dt) {
      noteTime = Math.max(0, noteTime - dt);
    },
    onInput(e) {
      if (fork) {
        forkButtons.handle(e);
        return;
      }
      if (e.type === 'key' && e.code === 'KeyT') return onClose();
      if (close.handle(e)) return;
      if (e.type === 'mousemove') {
        hovered = null;
        for (const [n, r] of rects) if (inRect(r, e.x, e.y)) hovered = n;
      } else if (e.type === 'mousedown' && e.button === 0) {
        for (const [n, r] of rects) {
          if (!inRect(r, e.x, e.y)) continue;
          const s = n.kind === 'skill' ? hero.skills.find((x) => x.id === n.id) : undefined;
          if (s && n.row !== BRANCH_ROW && inRect(pinRect(r), e.x, e.y)) {
            if (s.slot >= 0) setPanelSlot(hero, n.id, -1);
            else {
              const free = firstFreeClassSlot(hero);
              if (free < 0) say(`На панелі лише ${TALENTS.classSlots} скілів: спершу зніми якийсь`);
              else setPanelSlot(hero, n.id, free);
            }
            return;
          }
          click(n);
          return;
        }
      }
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, panel);
      drawText(ctx, 'Дерево талантів', panel.x + 20, panel.y + 26, { size: 22, bold: true });
      drawText(ctx, `Очок: ${state.talentPoints}`, panel.x + 260, panel.y + 26, { size: 18, bold: true, color: state.talentPoints > 0 ? THEME.accent : THEME.textDim });
      drawText(ctx, `У дереві: ${pointsSpent(hero)} · ряд 2 — від ${TALENTS.rowUnlock[1]}, ряд 3 — від ${TALENTS.rowUnlock[2]}`, panel.x + 400, panel.y + 26, { size: 13, color: THEME.textDim });
      if (hero.promotion) drawText(ctx, `Гілка: ${getPromotion(hero.promotion).name}`, branchX, panel.y + 52, { size: 13, bold: true, color: THEME.accent });
      else drawText(ctx, `Гілка — з ${PROGRESSION.promotionLevel} рівня`, branchX, panel.y + 80, { size: 13, color: THEME.textMuted });
      for (let row = 1; row <= rowsCount; row++) {
        const open = rowOpen(hero, row);
        const y = panel.y + 64 + (row - 1) * ROW_H;
        drawText(ctx, `Ряд ${row}`, panel.x + 24, y + 22, { size: 15, bold: true, color: open ? THEME.text : THEME.textMuted });
        if (!open) drawText(ctx, `від ${TALENTS.rowUnlock[row - 1]} очок`, panel.x + 24, y + 42, { size: 11, color: THEME.textMuted });
      }
      for (const [n, r] of rects) {
        const open = rowOpen(hero, n.row);
        const cost = nextCost(hero, n);
        const can = canLearn(state, n) === 'ok';
        let level = '';
        let name = '';
        let learned = false;
        if (n.kind === 'skill') {
          const s = hero.skills.find((x) => x.id === n.id);
          learned = !!s;
          level = s ? `${s.rank}/${RANKS.max}` : '—';
          name = getSkill(n.id).name;
        } else if (n.kind === 'passive') {
          const st = hero.passives[n.id] ?? 0;
          learned = st > 0;
          level = `${st}/${getPassive(n.id).maxStacks}`;
          name = getPassive(n.id).name;
        } else {
          learned = hero.arrows.includes(n.id);
          level = learned ? (hero.arrowElement === n.id ? 'на луку' : '✓') : '—';
          name = `Стріли: ${ELEMENTS[n.id].name}`;
        }
        roundRect(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = !open ? '#14171f' : learned ? '#1f2a22' : '#1b2030';
        ctx.fill();
        ctx.lineWidth = hovered === n ? 2.5 : 1.5;
        ctx.strokeStyle = can ? THEME.accent : learned ? THEME.good : THEME.panelBorder;
        ctx.stroke();
        const iconColor = !open ? THEME.textMuted : learned ? '#f4f1e8' : THEME.textDim;
        if (n.kind === 'skill') drawSkillIcon(ctx, getSkill(n.id).icon, r.x + 20, r.y + 22, 24, iconColor);
        else if (n.kind === 'passive') drawPassiveIcon(ctx, getPassive(n.id).stat, r.x + 20, r.y + 22, 24, iconColor);
        else {
          ctx.fillStyle = ELEMENTS[n.id].color;
          ctx.beginPath();
          ctx.arc(r.x + 20, r.y + 22, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        drawText(ctx, name, r.x + 38, r.y + 16, { size: fitFontSize(ctx, name, r.w - 44, 13, true, 9), bold: true, color: open ? THEME.text : THEME.textMuted });
        drawText(ctx, level, r.x + 38, r.y + 34, { size: 12, color: learned ? THEME.good : THEME.textDim });
        drawText(ctx, cost === null ? 'макс.' : `+${cost} очк.`, r.x + 8, r.y + r.h - 12, { size: 11, bold: true, color: can ? THEME.accent : THEME.textMuted });
        if (n.kind === 'skill' && learned && n.row === BRANCH_ROW) {
          const s = hero.skills.find((x) => x.id === n.id)!;
          drawText(ctx, s.slot === PROGRESSION.branchSlot2 ? 'F' : 'R', r.x + r.w - 15, r.y + r.h - 12, { size: 12, bold: true, color: THEME.accent, align: 'center' });
        } else if (n.kind === 'skill' && learned) {
          const s = hero.skills.find((x) => x.id === n.id)!;
          const p = pinRect(r);
          roundRect(ctx, p.x, p.y, p.w, p.h, 4);
          ctx.fillStyle = s.slot >= 0 ? '#3a4a2a' : '#2a2f3d';
          ctx.fill();
          drawText(ctx, s.slot >= 0 ? String(s.slot + 1) : '·', p.x + p.w / 2, p.y + p.h / 2 + 1, { size: 11, bold: true, align: 'center', color: s.slot >= 0 ? THEME.good : THEME.textDim });
        }
      }
      drawText(ctx, 'Клік — вкласти очко · маленька кнопка з цифрою — слот на панелі (клік знімає / ставить) · ранги 3 і 5 деяких скілів — розвилки', panel.x + 20, panel.y + panel.h - 30, { size: 11, color: THEME.textDim });
      if (noteTime > 0) drawText(ctx, note, W / 2, panel.y + panel.h - 60, { size: 14, bold: true, align: 'center', color: THEME.accent });
      close.draw(ctx);
      if (hovered && !fork) {
        const n = hovered;
        const m = app.input.mouse;
        if (n.kind === 'skill') {
          const s = hero.skills.find((x) => x.id === n.id);
          const tip = skillTooltip(n.id, s?.rank ?? 0, [], hero.stats.cooldownMult, s?.forks);
          drawTooltip(ctx, tip.lines, m.x, m.y, W, H, tip.colors);
        } else if (n.kind === 'passive') drawTooltip(ctx, [getPassive(n.id).name, describePassive(n.id), 'За кожне очко — ще один стак'], m.x, m.y, W, H);
        else drawTooltip(ctx, [`Стріли: ${ELEMENTS[n.id].name}`, 'Базова атака й скіли зі стрілами б’ють цією стихією.', 'Перемикання відкритих стріл у бою — клавіша Q.'], m.x, m.y, W, H);
      }
      if (fork) {
        const f = getSkill(fork.node.id).forks!.find((x) => x.rank === fork!.rank)!;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        const box = { x: W / 2 - 320, y: H / 2 - 110, w: 640, h: 240 };
        drawPanel(ctx, box, THEME.panel, THEME.accent);
        drawText(ctx, `${getSkill(fork.node.id).name}: ранг ${fork.rank} — оберіть одне`, W / 2, box.y + 30, { size: 18, bold: true, align: 'center' });
        f.options.forEach((o, i) => {
          const x = W / 2 - 290 + i * 300;
          const el = o.element ? ` (${ELEMENTS[o.element].name})` : '';
          ctx.font = '12px system-ui';
          drawText(ctx, `${o.text}${el}`, x + 140, box.y + 80, { size: 12, align: 'center', color: THEME.textDim });
        });
        drawText(ctx, 'Вибір назавжди (змінити можна лише скиданням дерева у вчителя)', W / 2, box.y + 108, { size: 11, align: 'center', color: THEME.textMuted });
        forkButtons.draw(ctx);
      }
    },
  };
}
