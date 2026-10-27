import { Input, bindInput } from './core/input';
import { resolveSeed, resolveWorldKind } from './core/seed';
import { App, type SettingsStore, type VersionStore } from './render/app';
import { createView, toLogical } from './render/canvas';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createView(canvas);
const input = new Input();
bindInput(input, window, canvas, (x, y) => toLogical(view, x, y));
// Right click opens the in-game item menu, not the browser one.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
// The last game version the player has seen, for the "Що нового" window. Storage may be
// unavailable (private mode, blocked site data): then the window simply shows every time.
const VERSION_KEY = 'expedition.lastSeenVersion';
const versions: VersionStore = {
  load: () => {
    try {
      return window.localStorage.getItem(VERSION_KEY);
    } catch {
      return null;
    }
  },
  save: (v) => {
    try {
      window.localStorage.setItem(VERSION_KEY, v);
    } catch {
      // Not critical.
    }
  },
};
// Game speed ×1/×2 (PLAN.md 6.5); without storage the game simply starts at ×1.
const SPEED_KEY = 'expedition.speed';
const settings: SettingsStore = {
  loadSpeed: () => {
    try {
      const v = Number(window.localStorage.getItem(SPEED_KEY));
      return v === 1 || v === 2 ? v : null;
    } catch {
      return null;
    }
  },
  saveSpeed: (speed) => {
    try {
      window.localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      // Not critical.
    }
  },
};
const url = window.location.href;
const app = new App(view, input, resolveSeed(url), { dev: import.meta.env.DEV, reducedMotion, versions, world: resolveWorldKind(url), settings });
app.start();
canvas.focus();

if (import.meta.env.DEV) {
  (window as unknown as { __app: App }).__app = app;
}
