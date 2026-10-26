// "Що нового": updates since the player's last visit, one version per page.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import type { ChangelogEntry } from '../data/changelog';
import type { App } from './app';
import { THEME, font } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, wrapLines } from './ui';

export function createChangelogModal(app: App, entries: ChangelogEntry[], onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 320, y: 40, w: 640, h: 460 };
  let page = 0;
  const go = (d: number): void => {
    page = Math.max(0, Math.min(entries.length - 1, page + d));
  };
  // Pages run newest → oldest: "Раніше" goes to older updates.
  const older = new Button({
    label: '← Раніше',
    rect: { x: panel.x + 24, y: panel.y + panel.h - 60, w: 130, h: 40 },
    hotkey: 'ArrowLeft',
    fontSize: 14,
    onClick: () => go(1),
  });
  const newer = new Button({
    label: 'Новіше →',
    rect: { x: panel.x + panel.w - 154, y: panel.y + panel.h - 60, w: 130, h: 40 },
    hotkey: 'ArrowRight',
    fontSize: 14,
    onClick: () => go(-1),
  });
  const ok = new Button({
    label: 'Зрозуміло',
    rect: { x: W / 2 - 100, y: panel.y + panel.h - 60, w: 200, h: 40 },
    hotkey: 'Enter',
    onClick: onClose,
  });
  const buttons = new ButtonGroup([older, ok, newer]);

  return {
    id: 'changelog',
    update() {
      older.enabled = page < entries.length - 1;
      newer.enabled = page > 0;
    },
    onInput(e: InputEvent) {
      if (e.type === 'key' && (e.code === 'Escape' || e.code === 'Space')) {
        onClose();
        return;
      }
      buttons.handle(e);
    },
    render(ctx) {
      const entry = entries[page];
      ctx.fillStyle = 'rgba(5, 6, 10, 0.82)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel, 'rgba(20, 23, 33, 0.98)');
      drawText(ctx, 'Що нового', W / 2, panel.y + 32, { size: 26, bold: true, align: 'center' });
      if (entries.length > 1) {
        drawText(ctx, `Оновлень з вашого останнього візиту: ${entries.length}`, W / 2, panel.y + 60, { size: 13, align: 'center', color: THEME.textDim });
      }
      if (!entry) return;
      drawText(ctx, `${entry.title}`, panel.x + 32, panel.y + 96, { size: 19, bold: true, color: THEME.accent });
      drawText(ctx, `версія ${entry.version} · ${formatDate(entry.date)}`, panel.x + panel.w - 32, panel.y + 96, {
        size: 13,
        align: 'right',
        color: THEME.textDim,
      });
      let y = panel.y + 128;
      ctx.font = font(14);
      for (const item of entry.items) {
        const lines = wrapLines(ctx, item, panel.w - 84);
        drawText(ctx, '•', panel.x + 36, y, { size: 14, bold: true, color: THEME.accent });
        lines.forEach((l, i) => drawText(ctx, l, panel.x + 52, y + i * 19, { size: 14 }));
        y += lines.length * 19 + 8;
      }
      if (entries.length > 1) {
        drawText(ctx, `${page + 1} / ${entries.length}`, W / 2, panel.y + panel.h - 76, { size: 12, align: 'center', color: THEME.textMuted });
      }
      buttons.draw(ctx);
    },
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
