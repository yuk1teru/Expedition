// The end of a hero (ROADMAP 9.6): the tombstone screen after the last life (or giving up),
// tombstones in the capital's cemetery and their epitaphs.

import type { Screen } from '../core/screens';
import { GRAVE } from '../data/death';
import { fillNames } from '../data/names';
import type { NpcDef } from '../data/npcs';
import { WORLD_NODES } from '../data/world';
import { type Grave, records } from '../systems/meta';
import type { App } from './app';
import { className } from './names';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, roundRect, wrapLines } from './ui';

/** The epitaph: who, how far they got and where the story ended. */
export function epitaph(g: Grave): string {
  const place = WORLD_NODES.find((n) => n.id === g.nodeId)?.name ?? '';
  const text = GRAVE.text
    .replace('{hero}', g.name)
    .replace('{class}', className(g.classId, g.promotion))
    .replace('{level}', String(g.level))
    .replace('{days}', String(g.days))
    .replace('{kills}', String(g.kills))
    .replace('{bosses}', String(g.bosses));
  return `${text} ${(g.abandoned ? GRAVE.abandoned : GRAVE.fell).replace('{place}', place)}`;
}

/** A tombstone in the cemetery as a one-node "conversation". */
/** `hint`: what the dead tell of the Amulet of life (ROADMAP 16.6), read under the epitaph. */
export function graveTalk(g: Grave, hint: string | null = null): NpcDef {
  return {
    id: 'grave',
    name: g.name,
    title: GRAVE.title,
    look: { body: '#8a8f99', accent: '#5a5f66', hat: 'none' },
    start: 'read',
    nodes: {
      read: {
        text: epitaph(g),
        options: [...(hint ? [{ text: 'Прочитати дрібний напис унизу.', next: 'hint' }] : []), { text: GRAVE.leave, action: 'close' as const }],
      },
      ...(hint ? { hint: { text: hint, options: [{ text: GRAVE.leave, action: 'close' as const }] } } : {}),
    },
  };
}

/** A tombstone with the hero's name (cemetery: small; end screen: big). */
export function drawTombstone(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, name: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9aa0aa';
  roundRect(ctx, -16, -40, 32, 46, 14);
  ctx.fill();
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#5a5f66';
  ctx.fillRect(-1.5, -32, 3, 14);
  ctx.fillRect(-6, -27, 12, 3);
  ctx.restore();
  if (name) drawText(ctx, name, x, y - 46 * scale - 8, { size: Math.max(11, Math.round(8 * scale)), bold: true, align: 'center', color: '#e8e4dc' });
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} год ${m} хв` : `${m} хв`;
}

/** After the last life or giving up: the hero's tombstone and the records of all heroes. */
export function createTombstoneScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  const panel = { x: W / 2 - 300, y: 24, w: 600, h: 492 };
  const buttons = new ButtonGroup([
    new Button({ label: 'Новий герой', rect: { x: panel.x + 100, y: panel.y + panel.h - 60, w: 230, h: 44 }, hotkey: 'Enter', onClick: () => app.newHero() }),
    new Button({ label: 'Головне меню', rect: { x: panel.x + 346, y: panel.y + panel.h - 60, w: 154, h: 44 }, fontSize: 14, onClick: () => app.toTitle() }),
  ]);
  return {
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = '#14161c';
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, panel);
      const g = app.lastGrave;
      drawText(ctx, GRAVE.screenTitle, W / 2, panel.y + 34, { size: 28, bold: true, align: 'center', color: THEME.bad });
      if (!g) {
        buttons.draw(ctx);
        return;
      }
      drawText(ctx, fillNames(g.abandoned ? GRAVE.screenAbandoned : GRAVE.screenDead), W / 2, panel.y + 64, { size: 13, align: 'center', color: THEME.textDim });
      drawTombstone(ctx, W / 2, panel.y + 186, 2.2, '');
      drawText(ctx, g.name, W / 2, panel.y + 214, { size: 22, bold: true, align: 'center' });
      ctx.font = `14px ${THEME.font}`;
      const lines = wrapLines(ctx, epitaph(g), panel.w - 80);
      lines.forEach((l, i) => drawText(ctx, l, W / 2, panel.y + 244 + i * 19, { size: 14, align: 'center', color: THEME.textDim }));
      drawText(ctx, `Час гри: ${formatTime(g.playTime)}`, W / 2, panel.y + 250 + lines.length * 19, { size: 13, align: 'center', color: THEME.textMuted });
      // Records of all the fallen heroes.
      const r = records(app.meta);
      const rec: string[] = [`Героїв на кладовищі: ${r.heroes}`];
      if (r.bestLevel) rec.push(`найвищий рівень — ${r.bestLevel.level} (${r.bestLevel.name})`);
      if (r.mostBosses && r.mostBosses.bosses > 0) rec.push(`босів — ${r.mostBosses.bosses} (${r.mostBosses.name})`);
      if (r.mostDays) rec.push(`днів — ${r.mostDays.days} (${r.mostDays.name})`);
      drawText(ctx, 'Рекорди', W / 2, panel.y + 334, { size: 14, bold: true, align: 'center', color: THEME.accent });
      ctx.font = `13px ${THEME.font}`;
      wrapLines(ctx, rec.join(' · '), panel.w - 80).forEach((l, i) => drawText(ctx, l, W / 2, panel.y + 356 + i * 18, { size: 13, align: 'center', color: THEME.textDim }));
      buttons.draw(ctx);
    },
  };
}
