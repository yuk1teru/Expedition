import { Input, bindInput } from './core/input';
import { GameLoop } from './core/loop';
import { ScreenManager } from './core/screens';
import { resolveSeed } from './core/seed';
import { LOOP } from './data/balance';
import { beginFrame, createView, endFrame, toLogical } from './render/canvas';
import { THEME } from './render/theme';
import { drawText } from './render/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createView(canvas);
const input = new Input();
bindInput(input, window, canvas, (x, y) => toLogical(view, x, y));

const seed = resolveSeed(window.location.href);
const screens = new ScreenManager<CanvasRenderingContext2D>();
screens.register('map', {
  update() {},
  render(ctx) {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    drawText(ctx, 'Експедиція', view.width / 2, view.height / 2 - 20, { size: 40, bold: true, align: 'center' });
    drawText(ctx, `Карта світу · seed ${seed}`, view.width / 2, view.height / 2 + 24, {
      size: 16,
      align: 'center',
      color: THEME.textDim,
    });
  },
  onInput() {},
});
screens.go('map');

const loop = new GameLoop(
  {
    fixedUpdate: (dt) => screens.update(dt),
    frameUpdate: () => {
      for (const e of input.drain()) screens.onInput(e);
    },
    render: () => {
      beginFrame(view, THEME.letterbox);
      screens.render(view.ctx);
      endFrame(view);
    },
  },
  { requestFrame: (cb) => requestAnimationFrame(cb) },
  { step: LOOP.step, maxFrame: LOOP.maxFrame },
);
loop.start();
canvas.focus();
