import { loadSpriteIndex } from './render/sprites';
import { Input, bindInput } from './core/input';
import { resolveSeed } from './core/seed';
import { App, type SaveFiles, type SaveStore, type SettingsStore, type VersionStore } from './render/app';
import { createView, toLogical } from './render/canvas';
import { setButtonSound } from './render/ui';

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
const SETTINGS_KEY = 'expedition.settings';
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
  load: () => {
    try {
      return window.localStorage.getItem(SETTINGS_KEY);
    } catch {
      return null;
    }
  },
  save: (text) => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, text);
    } catch {
      // Not critical.
    }
  },
};
// The hero's save slot. Without storage the game still runs, it just cannot be continued.
const SAVE_KEY = 'expedition.save';
const saves: SaveStore = {
  load: () => {
    try {
      return window.localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  },
  save: (text) => {
    try {
      window.localStorage.setItem(SAVE_KEY, text);
    } catch {
      // Not critical: the next checkpoint tries again.
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Not critical.
    }
  },
};
// What outlives heroes: the cemetery and records.
const META_KEY = 'expedition.meta';
const meta: SaveStore = {
  load: () => {
    try {
      return window.localStorage.getItem(META_KEY);
    } catch {
      return null;
    }
  },
  save: (text) => {
    try {
      window.localStorage.setItem(META_KEY, text);
    } catch {
      // Not critical.
    }
  },
  clear: () => {},
};
// Export / import of the save as a JSON file (to hand a hero to a friend).
const files: SaveFiles = {
  download: (name, text) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  pick: () =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) resolve(null);
        else file.text().then(resolve, () => resolve(null));
      });
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    }),
};
const url = window.location.href;
const app = new App(view, input, resolveSeed(url), { dev: import.meta.env.DEV, reducedMotion, versions, settings, saves, meta, files });
// Browsers allow sound only after a key or a click.
const unlockSound = (): void => app.sound.unlock();
window.addEventListener('keydown', unlockSound);
window.addEventListener('pointerdown', unlockSound);
setButtonSound(() => app.sound.play('ui'));
// Pictures for the sprite layer, if any were added (ROADMAP 19.1).
loadSpriteIndex(import.meta.env.BASE_URL);
app.start();
canvas.focus();

if (import.meta.env.DEV) {
  (window as unknown as { __app: App }).__app = app;
}
