// The brewer's window (ROADMAP 14.2): the recipes this NPC knows — what each gives, the parts
// and gold it takes (what the bag holds), and "Зварити". The active elixir is shown on top.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { fillNames } from '../data/names';
import { TROPHIES } from '../data/trophies';
import { brew, brewBlock, getRecipe, recipeKnown, recipesAt } from '../systems/alchemy';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

const PANEL = { x: 80, y: 40, w: 800, h: 460 };
const ROW_Y = PANEL.y + 92;
const ROW_H = 44;

export function createAlchemyModal(app: App, npcId: string, title: string, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const recipes = recipesAt(npcId);
  let flash = '';
  let flashTime = 0;
  const brewButtons = recipes.map(
    (r, i) =>
      new Button({
        label: 'Зварити',
        rect: { x: PANEL.x + PANEL.w - 130, y: ROW_Y + i * ROW_H + 6, w: 110, h: 30 },
        fontSize: 13,
        onClick: () => {
          if (brew(app.state, r.id)) {
            flash = r.result.kind === 'elixir' ? `${r.name}: випито — діє ${r.result.arenas} арен` : `Зварено: ${r.name}`;
            flashTime = 2;
          }
        },
      }),
  );
  const closeBtn = new Button({
    label: 'Назад [Esc]',
    rect: { x: PANEL.x + PANEL.w / 2 - 90, y: PANEL.y + PANEL.h - 44, w: 180, h: 32 },
    hotkey: 'Escape',
    fontSize: 14,
    onClick: onClose,
  });
  const buttons = new ButtonGroup([...brewButtons, closeBtn]);
  return {
    id: 'alchemy',
    update(dt) {
      flashTime = Math.max(0, flashTime - dt);
      recipes.forEach((r, i) => (brewButtons[i]!.enabled = brewBlock(app.state, r) === null));
    },
    onInput(e: InputEvent) {
      buttons.handle(e);
    },
    render(ctx) {
      const st = app.state;
      ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawPanel(ctx, PANEL, 'rgba(20, 28, 22, 0.98)', '#5a8a5a');
      drawText(ctx, title, PANEL.x + PANEL.w / 2, PANEL.y + 26, { size: 22, bold: true, align: 'center' });
      drawText(ctx, `Золото: ${st.gold}`, PANEL.x + PANEL.w - 20, PANEL.y + 26, { size: 15, bold: true, align: 'right', color: THEME.accent });
      const e = st.hero.elixir;
      const active = e ? getRecipe(e.recipe) : undefined;
      drawText(
        ctx,
        active ? `Діє: ${active.name} — ще ${e!.arenas} арен. Новий еліксир замінить його.` : 'Еліксир діє кілька арен; одночасно — лише один. Частини — трофеї з монстрів.',
        PANEL.x + 20,
        PANEL.y + 56,
        { size: 12, color: active ? THEME.good : THEME.textDim },
      );
      recipes.forEach((r, i) => {
        const y = ROW_Y + i * ROW_H;
        const known = recipeKnown(st, r);
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(PANEL.x + 10, y, PANEL.w - 20, ROW_H - 2);
        }
        ctx.globalAlpha = known ? 1 : 0.45;
        drawText(ctx, r.name, PANEL.x + 20, y + 13, { size: 14, bold: true });
        drawText(ctx, known ? r.text : 'Рецепт ще не відомий', PANEL.x + 20, y + 31, { size: 11, color: THEME.textDim });
        const needs = r.needs
          .map((n) => {
            const have = st.hero.trophies[n.trophy] ?? 0;
            return `${fillNames(TROPHIES[n.trophy]?.name ?? n.trophy)} ${Math.min(have, n.count)}/${n.count}`;
          })
          .join(' · ');
        drawText(ctx, needs, PANEL.x + 250, y + 13, { size: 12 });
        const block = brewBlock(st, r);
        drawText(ctx, `${r.gold} зол.${block && known ? ` — ${block}` : ''}`, PANEL.x + 250, y + 31, { size: 11, color: block ? THEME.bad : THEME.accent });
        ctx.globalAlpha = 1;
      });
      buttons.draw(ctx);
      if (flashTime > 0) {
        ctx.globalAlpha = Math.min(1, flashTime);
        drawText(ctx, flash, PANEL.x + 20, PANEL.y + PANEL.h - 28, { size: 14, bold: true, color: THEME.good });
        ctx.globalAlpha = 1;
      }
    },
  };
}
