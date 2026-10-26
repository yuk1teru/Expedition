import { Input, bindInput } from './core/input';
import { resolveSeed } from './core/seed';
import { App } from './render/app';
import { createView, toLogical } from './render/canvas';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createView(canvas);
const input = new Input();
bindInput(input, window, canvas, (x, y) => toLogical(view, x, y));
// Right click opens the in-game item menu, not the browser one.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const app = new App(view, input, resolveSeed(window.location.href), { dev: import.meta.env.DEV, reducedMotion });
app.start();
canvas.focus();

if (import.meta.env.DEV) {
  (window as unknown as { __app: App }).__app = app;
}
