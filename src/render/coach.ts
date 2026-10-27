// «Швидка тарадайка» window (ROADMAP 10.5): towns reached on foot with the ride price;
// the ones not reached yet are listed greyed out.

import type { Modal } from '../core/screens';
import { coachDestinations, coachPrice, rideCoach } from '../systems/coach';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

export function createCoachModal(app: App, onClose: () => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const state = app.state;
  const towns = state.world.nodes.filter((n) => n.isTown && n.id !== state.currentNodeId);
  const open = new Set(coachDestinations(state));
  const panel = { x: W / 2 - 230, y: 70, w: 460, h: 130 + towns.length * 46 };
  const buttons = new ButtonGroup();
  towns.forEach((t, i) => {
    const price = coachPrice(state, t.id);
    const reached = open.has(t.id);
    buttons.add(
      new Button({
        label: reached ? `${t.name} — ${price} зол.` : `${t.name} — спершу дійди пішки`,
        rect: { x: panel.x + 40, y: panel.y + 70 + i * 46, w: panel.w - 80, h: 38 },
        fontSize: 15,
        enabled: reached && state.gold >= price,
        hotkey: `Digit${i + 1}`,
        onClick: () => {
          if (rideCoach(state, t.id)) {
            onClose();
            app.goTown();
          }
        },
      }),
    );
  });
  buttons.add(new Button({ label: 'Не зараз [Esc]', rect: { x: W / 2 - 90, y: panel.y + panel.h - 50, w: 180, h: 34 }, fontSize: 13, hotkey: 'Escape', onClick: onClose }));
  return {
    id: 'coach',
    update() {},
    onInput(e) {
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel);
      drawText(ctx, '«Швидка тарадайка»', W / 2, panel.y + 26, { size: 20, bold: true, align: 'center', color: THEME.accent });
      drawText(ctx, `Без днів і без боїв · у вас ${state.gold} зол.`, W / 2, panel.y + 50, { size: 13, align: 'center', color: THEME.textDim });
      buttons.draw(ctx);
    },
  };
}
