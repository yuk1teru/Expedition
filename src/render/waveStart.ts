// Entering a location cleared before: continue from the next wave, start from wave 1
// or (when coming from elsewhere) just cross it without a battle.

import type { InputEvent } from '../core/input';
import type { Modal } from '../core/screens';
import { WAVES } from '../data/balance';
import type { MapNode } from '../systems/mapgen';
import { canPassThrough } from '../systems/run';
import { waveMult } from '../systems/waves';
import type { App } from './app';
import { THEME } from './theme';
import { Button, ButtonGroup, drawPanel, drawText } from './ui';

/** `onPick(startWave)`: waves to skip (0 = from the first), 'pass' to cross without a battle, or null to stay on the map. */
export function createWaveStartModal(app: App, node: MapNode, onPick: (startWave: number | 'pass' | null) => void): Modal<CanvasRenderingContext2D> {
  const W = app.view.width;
  const panel = { x: W / 2 - 250, y: 110, w: 500, h: 300 };
  const canPass = canPassThrough(app.state, node.id);
  const from = node.lastWave;
  const m = waveMult(from);
  const buttons = new ButtonGroup([
    new Button({
      label: `Продовжити з хвилі ${from + 1} [1]`,
      rect: { x: panel.x + 50, y: panel.y + 150, w: 400, h: 42 },
      hotkey: 'Digit1',
      onClick: () => onPick(from),
    }),
    new Button({
      label: 'Почати з 1-ї хвилі [2]',
      rect: { x: panel.x + 50, y: panel.y + 200, w: canPass ? 195 : 400, h: 38 },
      hotkey: 'Digit2',
      fontSize: 14,
      onClick: () => onPick(0),
    }),
    ...(canPass
      ? [
          new Button({
            label: 'Пройти (1 хвиля) [3]',
            rect: { x: panel.x + 255, y: panel.y + 200, w: 195, h: 38 },
            hotkey: 'Digit3',
            fontSize: 14,
            onClick: () => onPick('pass'),
          }),
        ]
      : []),
    new Button({
      label: 'Скасувати [Esc]',
      rect: { x: panel.x + 50, y: panel.y + 248, w: 400, h: 34 },
      hotkey: 'Escape',
      fontSize: 14,
      onClick: () => onPick(null),
    }),
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
      drawText(ctx, `Минулого разу пройдено хвиль: ${from}`, W / 2, panel.y + 66, { size: 15, align: 'center', color: THEME.textDim });
      drawText(ctx, `Хвиля ${from + 1}: шкода ворогів ×${m.damage.toFixed(1)}, HP ×${m.hp.toFixed(1)}, швидкість ×${m.speed.toFixed(2)}`, W / 2, panel.y + 94, {
        size: 14,
        align: 'center',
        color: THEME.accent,
      });
      drawText(ctx, `До порталу — ${WAVES.count} хвилі; нагорода росте з номером хвилі.`, W / 2, panel.y + 118, {
        size: 13,
        align: 'center',
        color: THEME.textDim,
      });
      buttons.draw(ctx);
    },
  };
}
