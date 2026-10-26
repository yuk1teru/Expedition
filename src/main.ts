import { Input, bindInput } from './core/input';
import { resolveSeed } from './core/seed';
import { App } from './render/app';
import { createView, toLogical } from './render/canvas';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createView(canvas);
const input = new Input();
bindInput(input, window, canvas, (x, y) => toLogical(view, x, y));

const app = new App(view, input, resolveSeed(window.location.href));
app.start();
canvas.focus();

if (import.meta.env.DEV) {
  (window as unknown as { __app: App }).__app = app;
}
