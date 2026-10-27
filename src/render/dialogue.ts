// Dialogue window: the NPC's line (typed out) and the player's options (click or 1–4).
// Options move through the NPC's dialogue graph or run an action (src/data/npcs.ts).

import type { Modal } from '../core/screens';
import { fillNames } from '../data/names';
import type { DialogueAction, NpcDef } from '../data/npcs';
import { type Conversation, chooseOption, currentNode, startConversation } from '../systems/town';
import type { App } from './app';
import { drawNpc } from './npcArt';
import { drawTombstone } from './tombstone';
import { THEME, font } from './theme';
import { type Rect, drawPanel, drawText, inRect, roundRect, wrapLines } from './ui';

const PANEL: Rect = { x: 110, y: 300, w: 740, h: 226 };
/** Characters per second of the typed-out line. */
const TYPE_SPEED = 70;
const OPTION_H = 28;

export function createDialogueModal(app: App, who: string | NpcDef, onAction: (action: DialogueAction | null) => void): Modal<CanvasRenderingContext2D> {
  const conv: Conversation = startConversation(who);
  let shown = 0;
  let hovered = -1;

  const textRect = { x: PANEL.x + 130, y: PANEL.y + 50, w: PANEL.w - 150 };
  const optionRect = (i: number): Rect => {
    const n = currentNode(conv).options.length;
    return { x: PANEL.x + 130, y: PANEL.y + PANEL.h - 14 - (n - i) * (OPTION_H + 4), w: PANEL.w - 150, h: OPTION_H };
  };
  const fullText = (): string => fillNames(currentNode(conv).text);
  const typing = (): boolean => shown < fullText().length;

  const pick = (i: number): void => {
    if (typing()) {
      shown = fullText().length;
      return;
    }
    if (i < 0 || i >= currentNode(conv).options.length) return;
    const res = chooseOption(conv, i);
    if (res.ended || res.action) {
      onAction(res.action ?? 'close');
      return;
    }
    shown = 0;
    hovered = -1;
  };

  return {
    id: 'dialogue',
    update(dt) {
      shown = Math.min(fullText().length, shown + TYPE_SPEED * dt);
    },
    onInput(e) {
      if (e.type === 'key') {
        if (e.code === 'Escape') onAction('close');
        else if (e.code.startsWith('Digit')) pick(Number(e.code.slice(5)) - 1);
        else if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && typing()) shown = fullText().length;
        return;
      }
      if (e.type === 'mousemove') {
        hovered = -1;
        currentNode(conv).options.forEach((_, i) => {
          if (inRect(optionRect(i), e.x, e.y)) hovered = i;
        });
        return;
      }
      if (e.type === 'mousedown' && e.button === 0) {
        if (!inRect(PANEL, e.x, e.y)) {
          onAction('close');
          return;
        }
        const i = currentNode(conv).options.findIndex((_, k) => inRect(optionRect(k), e.x, e.y));
        if (i >= 0) pick(i);
        else if (typing()) shown = fullText().length;
      }
    },
    render(ctx) {
      const node = currentNode(conv);
      const npc = conv.npc;
      drawPanel(ctx, PANEL);
      // Portrait.
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, PANEL.x + 14, PANEL.y + 14, 100, 110, 8);
      ctx.fill();
      ctx.restore();
      // A tombstone "speaks" with its own picture.
      if (npc.id === 'grave') drawTombstone(ctx, PANEL.x + 64, PANEL.y + 108, 1.5, '');
      else drawNpc(ctx, npc.look, PANEL.x + 64, PANEL.y + 82, 34, app.time);
      drawText(ctx, npc.name, PANEL.x + 64, PANEL.y + 140, { size: 14, bold: true, align: 'center', color: THEME.accent });
      drawText(ctx, npc.title, PANEL.x + 64, PANEL.y + 158, { size: 11, align: 'center', color: THEME.textDim });
      // The line, typed out.
      ctx.font = font(16);
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lines = wrapLines(ctx, fullText(), textRect.w);
      let left = Math.floor(shown);
      lines.forEach((line, i) => {
        if (left <= 0) return;
        ctx.fillText(line.slice(0, left), textRect.x, PANEL.y + 22 + i * 22);
        left -= line.length + 1;
      });
      // Options.
      if (!typing()) {
        node.options.forEach((opt, i) => {
          const r = optionRect(i);
          if (i === hovered) {
            ctx.fillStyle = THEME.buttonHover;
            roundRect(ctx, r.x - 6, r.y, r.w, r.h, 6);
            ctx.fill();
          }
          drawText(ctx, `${i + 1}. ${fillNames(opt.text)}`, r.x, r.y + r.h / 2 + 1, { size: 15, bold: i === hovered, color: opt.action === 'close' ? THEME.textDim : THEME.text });
        });
      } else {
        drawText(ctx, 'клік / пробіл — показати все', PANEL.x + PANEL.w - 16, PANEL.y + PANEL.h - 16, { size: 11, align: 'right', color: THEME.textMuted });
      }
    },
  };
}
