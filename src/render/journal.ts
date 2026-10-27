// Quest journal (ROADMAP 11.2, key J): the quests in work with what to do now, and how
// many are done.

import type { Modal } from '../core/screens';
import { fillNames, resolveName } from '../data/names';
import { QUESTS, QUEST_KINDS } from '../data/quests';
import { currentObjective, objectiveText, turnInNpc } from '../systems/quests';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, wrapLines } from './ui';

export function createJournalModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  const panel = { x: W / 2 - 340, y: 20, w: 680, h: H - 40 };
  const buttons = new ButtonGroup([
    new Button({ label: 'Закрити [J / Esc]', rect: { x: W / 2 - 100, y: panel.y + panel.h - 48, w: 200, h: 34 }, fontSize: 13, hotkey: 'Escape', onClick: onClose }),
  ]);
  return {
    id: 'journal',
    update() {},
    onInput(e) {
      if (e.type === 'key' && e.code === 'KeyJ') onClose();
      else buttons.handle(e);
    },
    render(ctx) {
      const state = app.state;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, panel);
      drawText(ctx, 'Журнал квестів', W / 2, panel.y + 28, { size: 22, bold: true, align: 'center' });
      drawText(ctx, `Виконано: ${state.quests.done.length}`, panel.x + panel.w - 24, panel.y + 28, { size: 12, align: 'right', color: THEME.textDim });
      let y = panel.y + 66;
      if (state.quests.active.length === 0) {
        drawText(ctx, 'Активних квестів немає. Шукай «!» над головами жителів.', W / 2, y + 20, { size: 15, align: 'center', color: THEME.textDim });
      }
      for (const qs of state.quests.active) {
        if (y > panel.y + panel.h - 90) break;
        const q = QUESTS[qs.id];
        if (!q) continue;
        const o = currentObjective(qs);
        const kind = QUEST_KINDS[q.kind].name;
        drawText(ctx, fillNames(q.name), panel.x + 28, y, { size: 16, bold: true, color: q.kind === 'main' ? THEME.accent : THEME.text });
        drawText(ctx, kind, panel.x + panel.w - 28, y, { size: 11, align: 'right', color: THEME.textMuted });
        y += 22;
        const now = o ? `→ ${objectiveText(o, qs.count)}` : `✔ Здати: ${resolveName('npc', turnInNpc(q)) ?? ''}`;
        ctx.font = `14px ${THEME.font}`;
        for (const line of wrapLines(ctx, now, panel.w - 70)) {
          drawText(ctx, line, panel.x + 44, y, { size: 14, color: o ? '#9fd3ff' : THEME.good });
          y += 19;
        }
        drawText(ctx, `Крок ${Math.min(qs.step + 1, q.objectives.length)} з ${q.objectives.length}`, panel.x + 44, y, { size: 11, color: THEME.textMuted });
        y += 28;
      }
      buttons.draw(ctx);
    },
  };
}
