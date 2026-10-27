// Entering a location cleared before: go through it again (all its arenas) or, when coming
// from elsewhere, just cross it with one wave.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import type { MapNode } from '../systems/mapgen';
import { canPassThrough } from '../systems/run';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

/** `onPick`: 'again' — the whole location, 'pass' — a one-wave crossing, null — stay on the map. */
export function createWaveStartModal(app: App, node: MapNode, onPick: (choice: 'again' | 'pass' | null) => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 250, y: 130, w: 500, h: 240 };
  const canPass = canPassThrough(app.state, node.id);
  const buttons = new ButtonGroup([
    new Button({
      label: 'Пройти локацію знову [1]',
      rect: { x: panel.x + 50, y: panel.y + 100, w: canPass ? 195 : 400, h: 42 },
      hotkey: 'Digit1',
      fontSize: 14,
      onClick: () => onPick('again'),
    }),
    ...(canPass
      ? [
          new Button({
            label: 'Пройти (1 хвиля) [2]',
            rect: { x: panel.x + 255, y: panel.y + 100, w: 195, h: 42 },
            hotkey: 'Digit2',
            fontSize: 14,
            onClick: () => onPick('pass'),
          }),
        ]
      : []),
    new Button({ label: 'Скасувати [Esc]', rect: { x: panel.x + 50, y: panel.y + 170, w: 400, h: 34 }, hotkey: 'Escape', fontSize: 14, onClick: () => onPick(null) }),
  ]);
  return {
    id: 'waveStart',
    update() {},
    onInput(e: InputEvent) {
      buttons.handle(e);
    },
    render(ctx) {
      ctx.fillStyle = 'rgba(5, 6, 10, 0.7)';
      ctx.fillRect(0, 0, W, app.view.height);
      drawPanel(ctx, panel, 'rgba(20, 23, 33, 0.98)');
      drawText(ctx, node.name, W / 2, panel.y + 32, { size: 24, bold: true, align: 'center' });
      drawText(ctx, `Пройдено разів: ${node.timesCleared}`, W / 2, panel.y + 62, { size: 14, align: 'center', color: THEME.textDim });
      buttons.draw(ctx);
    },
  };
}
