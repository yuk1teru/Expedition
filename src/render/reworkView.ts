// The "Реворк: Ліс" mode (ROADMAP 20.1, dev only): the new core grows here next to the old game.
// For now — the warrior walking a big field with the camera on him, and a stress test: the
// buttons put 100 / 300 / 500 dummies that run at him, and the corner shows the frame rate.

import type { Screen } from '../core/screens';
import { Rng } from '../core/rng';
import { REWORK_FIELD, REWORK_STRESS } from '../data/rework';
import { WARRIOR_ANIM } from '../data/heroAnim';
import { type Field, createField, spawnDummies, stepField } from '../systems/rework/field';
import type { App } from './app';
import { type HeroAnimState, drawWarrior, newHeroAnim, stepHeroAnim } from './heroAnim';
import { THEME } from './theme';
import { Button, ButtonGroup, drawText } from './ui';

interface Patch {
  x: number;
  y: number;
  r: number;
  shade: string;
}

const PATCH_SHADES = ['#3c5232', '#41583a', '#36492c', '#46603c'];

export function createReworkScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  let field: Field = createField(1);
  let anim: HeroAnimState = newHeroAnim();
  let animTime = 0;
  let patches: Patch[] = [];
  // Frame rate and the cost of one logic step, averaged over half a second.
  let frames = 0;
  let frameClock = 0;
  let fps = 0;
  let stepMs = 0;
  let stepSum = 0;
  let stepCount = 0;

  const buttons = new ButtonGroup([
    ...REWORK_STRESS.counts.map(
      (n, i) => new Button({ label: `${n} ворогів [${i + 1}]`, rect: { x: 16 + i * 128, y: 16, w: 120, h: 32 }, fontSize: 13, hotkey: `Digit${i + 1}`, onClick: () => spawnDummies(field, n) }),
    ),
    new Button({ label: 'Прибрати [0]', rect: { x: 16 + REWORK_STRESS.counts.length * 128, y: 16, w: 110, h: 32 }, fontSize: 13, hotkey: 'Digit0', onClick: () => spawnDummies(field, 0) }),
    new Button({ label: 'Вийти [Esc]', rect: { x: W - 126, y: 16, w: 110, h: 32 }, fontSize: 13, hotkey: 'Escape', onClick: () => app.screens.go('title') }),
  ]);

  const walkSheet = (): HTMLImageElement | null => {
    const img = sheets.get(WARRIOR_ANIM.sheets.walk.src);
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  };
  const sheets = new Map<string, HTMLImageElement>();

  return {
    enter() {
      field = createField(app.state.seed);
      anim = newHeroAnim();
      animTime = app.time;
      const r = new Rng(app.state.seed).fork('reworkGround');
      patches = Array.from({ length: REWORK_FIELD.patches }, () => ({
        x: r.next() * field.width,
        y: r.next() * field.height,
        r: 18 + r.next() * 60,
        shade: PATCH_SHADES[Math.floor(r.next() * PATCH_SHADES.length)]!,
      }));
      if (typeof Image !== 'undefined' && !sheets.has(WARRIOR_ANIM.sheets.walk.src)) {
        const img = new Image();
        img.src = WARRIOR_ANIM.sheets.walk.src;
        sheets.set(WARRIOR_ANIM.sheets.walk.src, img);
      }
    },

    update(dt) {
      const t0 = performance.now();
      stepField(field, dt, app.input.moveVector());
      stepSum += performance.now() - t0;
      stepCount += 1;
    },

    onInput(e) {
      buttons.handle(e);
    },

    render(ctx) {
      const now = app.time;
      const dt = Math.max(0, now - animTime);
      animTime = now;
      frames += 1;
      frameClock += dt;
      if (frameClock >= 0.5) {
        fps = frames / frameClock;
        stepMs = stepCount > 0 ? stepSum / stepCount : 0;
        frames = 0;
        frameClock = 0;
        stepSum = 0;
        stepCount = 0;
      }

      const h = field.hero;
      const cam = { x: clampCam(h.pos.x - W / 2, field.width - W), y: clampCam(h.pos.y - H / 2, field.height - H) };
      ctx.fillStyle = '#3a4f30';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      // Ground: only the patches on screen.
      for (const p of patches) {
        if (p.x + p.r < cam.x || p.x - p.r > cam.x + W || p.y + p.r < cam.y || p.y - p.r > cam.y + H) continue;
        ctx.fillStyle = p.shade;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The edge of the location.
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, field.width, field.height);

      // Bodies sorted by height on the screen: lower is in front (three-quarter view).
      const img = walkSheet();
      const order = field.dummies.filter((d) => d.pos.x > cam.x - 60 && d.pos.x < cam.x + W + 60 && d.pos.y > cam.y - 20 && d.pos.y < cam.y + H + 80);
      order.sort((a, b) => a.pos.y - b.pos.y);
      let heroDrawn = false;
      const drawTheHero = (): void => {
        stepHeroAnim(anim, h, dt, -Infinity);
        ctx.save();
        ctx.translate(h.pos.x, h.pos.y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, h.radius * 0.7, h.radius, h.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!drawWarrior(ctx, anim, h.radius * 0.7, false)) {
          ctx.fillStyle = THEME.accent;
          ctx.beginPath();
          ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        heroDrawn = true;
      };
      for (const d of order) {
        if (!heroDrawn && d.pos.y > h.pos.y) drawTheHero();
        drawDummy(ctx, img, d, field.time);
      }
      if (!heroDrawn) drawTheHero();
      ctx.restore();

      // The stress test readout.
      buttons.draw(ctx);
      ctx.fillStyle = 'rgba(10, 12, 18, 0.7)';
      ctx.fillRect(W - 320, 54, 304, 52);
      const good = fps >= 55;
      drawText(ctx, `${Math.round(fps)} кадрів/с`, W - 16, 70, { size: 22, bold: true, align: 'right', color: good ? THEME.good : THEME.bad });
      drawText(ctx, `ворогів: ${field.dummies.length} · логіка: ${stepMs.toFixed(2)} мс на крок`, W - 16, 96, { size: 13, align: 'right', color: THEME.textDim });
      drawText(ctx, 'Реворк: Ліс · крок 20.1 · WASD — ходити', 16, H - 16, { size: 12, color: THEME.textMuted });
    },
  };
}

const clampCam = (v: number, max: number): number => Math.max(0, Math.min(Math.max(0, max), v));

/** A dummy: the warrior's walk frames, smaller and darker — the cost of a real enemy sprite. */
function drawDummy(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, d: { pos: { x: number; y: number }; vel: { x: number }; phase: number }, time: number): void {
  const S = REWORK_STRESS;
  if (!img) {
    ctx.fillStyle = '#5a5048';
    ctx.beginPath();
    ctx.arc(d.pos.x, d.pos.y, S.radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sh = WARRIOR_ANIM.sheets.walk;
  const frame = Math.floor((time * 1.6 + d.phase) * 8) % 8;
  const [cw, ch] = sh.cell;
  const scale = S.height / sh.frameHeight;
  ctx.save();
  ctx.translate(d.pos.x, d.pos.y + S.radius * 0.7);
  ctx.scale((d.vel.x < 0 ? -1 : 1) * scale, scale);
  ctx.drawImage(img, (frame % sh.columns) * cw, Math.floor(frame / sh.columns) * ch, cw, ch, -sh.anchor[0], -sh.anchor[1], cw, ch);
  ctx.restore();
}
