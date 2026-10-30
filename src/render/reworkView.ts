// The "Реворк: Ліс" mode (ROADMAP 20.1–20.5, dev only): the new core grows here next to the old
// game. A class is chosen, then the run: the Forest map, the flood of beasts, the automatic
// attack, the dodge on Space, experience and the choice of 1 of 3 cards, death and a restart.
// A small panel keeps the stress test of 20.1 and the frame rate.

import type { Screen } from '../core/screens';
import { Rng } from '../core/rng';
import { REWORK_CARDS, REWORK_CLASSES, REWORK_FLOOD, REWORK_STRESS, type ReworkClassId } from '../data/rework';
import { dodge } from '../systems/rework/hero';
import { chooseCard, reroll, rerollPrice, xpToNext } from '../systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../systems/rework/run';
import type { Obstacle, Run } from '../systems/rework/types';
import type { App } from './app';
import { type HeroAnimState, drawHeroDust, drawWarrior, heroAnimAttack, newHeroAnim, stepHeroAnim } from './heroAnim';
import { CROWN_FADE, crownBox, drawCoin, drawEnemy, drawEnemyWarning, drawGem, drawHeroFigure, drawObstacle, drawShadow, drawShot } from './reworkDraw';
import { THEME, font } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, drawWrapped } from './ui';

interface Patch {
  x: number;
  y: number;
  r: number;
  shade: string;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

interface Swing {
  x: number;
  y: number;
  angle: number;
  reach: number;
  arc: number;
  age: number;
}

const PATCH_SHADES = ['#3c5232', '#41583a', '#36492c', '#46603c'];
const CLASS_ORDER: ReworkClassId[] = ['warrior', 'mage', 'archer'];

const mmss = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createReworkScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  let run: Run | null = null;
  let classId: ReworkClassId = 'warrior';
  let anim: HeroAnimState = newHeroAnim();
  let animTime = 0;
  let patches: Patch[] = [];
  let floaters: Floater[] = [];
  let swings: Swing[] = [];
  let seed = 1;
  // Frame rate and the cost of one logic step, averaged over half a second.
  let frames = 0;
  let frameClock = 0;
  let fps = 0;
  let stepMs = 0;
  let stepSum = 0;
  let stepCount = 0;

  const start = (id: ReworkClassId): void => {
    classId = id;
    seed += 1;
    const r = createRun(app.state.seed + seed, id);
    run = r;
    anim = newHeroAnim();
    floaters = [];
    swings = [];
    const g = new Rng(app.state.seed).fork('reworkGround');
    patches = Array.from({ length: 900 }, () => ({ x: g.next() * r.width, y: g.next() * r.height, r: 18 + g.next() * 60, shade: PATCH_SHADES[Math.floor(g.next() * PATCH_SHADES.length)]! }));
  };

  const classButtons = new ButtonGroup(
    CLASS_ORDER.map((id, i) => new Button({ label: `${REWORK_CLASSES[id].name} [${i + 1}]`, rect: { x: W / 2 - 330 + i * 225, y: H / 2 - 10, w: 210, h: 46 }, fontSize: 17, hotkey: `Digit${i + 1}`, onClick: () => start(id) })),
  );
  const deathButtons = new ButtonGroup([
    new Button({ label: 'Ще раз [Enter]', rect: { x: W / 2 - 230, y: H / 2 + 60, w: 220, h: 44 }, fontSize: 16, hotkey: 'Enter', onClick: () => start(classId) }),
    new Button({ label: 'Інший клас [C]', rect: { x: W / 2 + 10, y: H / 2 + 60, w: 220, h: 44 }, fontSize: 16, hotkey: 'KeyC', onClick: () => (run = null) }),
  ]);
  const cardRect = (i: number): { x: number; y: number; w: number; h: number } => ({ x: W / 2 - 375 + i * 255, y: H / 2 - 110, w: 240, h: 200 });
  const debug = new ButtonGroup([
    ...REWORK_STRESS.counts.map((n, i) => new Button({ label: `+${n}`, rect: { x: W - 316 + i * 62, y: H - 46, w: 56, h: 28 }, fontSize: 12, onClick: () => run && stressSpawn(run, n) })),
    new Button({ label: 'Безсмертя', rect: { x: W - 126, y: H - 46, w: 110, h: 28 }, fontSize: 12, onClick: () => run && (run.hero.immortal = !run.hero.immortal) }),
  ]);
  const exitBtn = new ButtonGroup([new Button({ label: 'Вийти [Esc]', rect: { x: W - 126, y: 12, w: 110, h: 30 }, fontSize: 13, hotkey: 'Escape', onClick: () => app.screens.go('title') })]);

  const readEvents = (r: Run): void => {
    for (const e of r.events) {
      if (e.type === 'hit') floaters.push({ x: e.pos.x + (r.rng.next() - 0.5) * 10, y: e.pos.y - 30, text: String(Math.max(1, Math.round(e.amount))), color: e.byHero ? '#ffffff' : '#ff6b5e', age: 0 });
      else if (e.type === 'swing') {
        swings.push({ x: e.pos.x, y: e.pos.y, angle: e.angle, reach: e.reach, arc: e.arc, age: 0 });
        heroAnimAttack(anim);
      } else if (e.type === 'levelUp') floaters.push({ x: r.hero.pos.x, y: r.hero.pos.y - 80, text: `Рівень ${e.level}!`, color: THEME.accent, age: -0.2 });
    }
    r.events = [];
  };

  return {
    enter() {
      run = null;
      animTime = app.time;
    },

    update(dt) {
      if (!run) return;
      const t0 = performance.now();
      stepRun(run, dt, app.input.moveVector());
      stepSum += performance.now() - t0;
      stepCount += 1;
    },

    onInput(e) {
      if (exitBtn.handle(e)) return;
      if (!run) {
        classButtons.handle(e);
        return;
      }
      if (debug.handle(e)) return;
      if (run.hero.dead) {
        deathButtons.handle(e);
        return;
      }
      if (run.offer) {
        if (e.type === 'key' && /^Digit[1-3]$/.test(e.code)) chooseCard(run, Number(e.code.slice(5)) - 1);
        else if (e.type === 'key' && e.code === 'KeyR') reroll(run);
        else if (e.type === 'mousedown') {
          const r = run;
          r.offer!.forEach((_, i) => {
            const c = cardRect(i);
            if (e.x >= c.x && e.x <= c.x + c.w && e.y >= c.y && e.y <= c.y + c.h) chooseCard(r, i);
          });
        }
        return;
      }
      if (e.type === 'key' && e.code === 'Space') dodge(run, app.input.moveVector());
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
        frames = frameClock = stepSum = stepCount = 0;
      }
      ctx.fillStyle = '#3a4f30';
      ctx.fillRect(0, 0, W, H);
      if (!run) {
        drawClassChoice(ctx);
        exitBtn.draw(ctx);
        return;
      }
      const r = run;
      readEvents(r);
      const paused = runPaused(r);
      const h = r.hero;
      const cam = { x: clampCam(h.pos.x - W / 2, r.width - W), y: clampCam(h.pos.y - H / 2 - 30, r.height - H) };
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      const onScreen = (x: number, y: number, m: number): boolean => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;
      // Ground, things lying on it, warnings.
      for (const p of patches) {
        if (!onScreen(p.x, p.y, p.r)) continue;
        ctx.fillStyle = p.shade;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, r.width, r.height);
      for (const g of r.gems) if (onScreen(g.pos.x, g.pos.y, 10)) drawGem(ctx, g, r.time);
      for (const c of r.coins) if (onScreen(c.pos.x, c.pos.y, 10)) drawCoin(ctx, c);
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 200)) drawEnemyWarning(ctx, e);
      drawSwings(ctx, paused ? 0 : dt);
      if (h.classId === 'warrior') drawHeroDust(ctx, anim);

      // Bodies and obstacles sorted by their foot: lower on the screen is in front.
      const items: { y: number; draw: () => void }[] = [];
      for (const o of r.obstacles) if (onScreen(o.pos.x, o.pos.y, o.height + 80)) items.push({ y: o.pos.y, draw: () => drawObstacle(ctx, o, crownAlpha(o, h.pos)) });
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 40)) items.push({ y: e.pos.y, draw: () => drawEnemy(ctx, e, r.time) });
      items.push({ y: h.pos.y, draw: () => drawHero(ctx, r, paused ? 0 : dt) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      for (const s of r.shots) if (onScreen(s.pos.x, s.pos.y, 20)) drawShot(ctx, s);
      drawFloaters(ctx, paused ? 0 : dt);
      ctx.restore();

      drawHud(ctx, r);
      if (r.offer) drawOffer(ctx, r);
      if (h.dead) drawDeath(ctx, r);
      debug.draw(ctx);
      drawText(ctx, `${Math.round(fps)} к/с · ${r.enemies.length} звірів · логіка ${stepMs.toFixed(2)} мс${h.immortal ? ' · безсмертя' : ''}`, W - 16, H - 56, { size: 11, align: 'right', color: fps >= 55 ? THEME.good : THEME.bad });
      exitBtn.draw(ctx);
    },
  };

  /** A tree crown the hero walks behind fades, so the hero stays visible. */
  function crownAlpha(o: Obstacle, hero: { x: number; y: number }): number {
    const c = crownBox(o);
    if (!c || hero.y >= o.pos.y) return 1;
    return Math.abs(hero.x - c.x) < c.r && hero.y > c.y - c.r && hero.y - 70 < c.y + c.r ? CROWN_FADE : 1;
  }

  function drawHero(ctx: CanvasRenderingContext2D, r: Run, dt: number): void {
    const h = r.hero;
    if (h.dead) return;
    stepHeroAnim(anim, h, dt, -Infinity);
    const flash = r.time - h.hitAt < 0.1;
    drawShadow(ctx, h.pos.x, h.pos.y, h.radius);
    // Invulnerable after a dodge: a faint blink.
    ctx.globalAlpha = h.invuln > 0 && Math.floor(r.time * 30) % 2 === 0 ? 0.55 : 1;
    if (h.classId === 'warrior') {
      ctx.save();
      ctx.translate(h.pos.x, h.pos.y);
      drawWarrior(ctx, anim, 2, flash);
      ctx.restore();
    } else drawHeroFigure(ctx, h, anim.side, flash);
    ctx.globalAlpha = 1;
  }

  function drawSwings(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const s of swings) {
      s.age += dt;
      const k = s.age / 0.2;
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.reach, s.reach * 0.6, 0, s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.ellipse(s.x, s.y, s.reach * 0.45, s.reach * 0.27, 0, s.angle + s.arc / 2, s.angle - s.arc / 2, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    swings = swings.filter((s) => s.age < 0.2);
  }

  function drawFloaters(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const f of floaters) {
      f.age += dt;
      if (f.age < 0) continue;
      ctx.globalAlpha = Math.max(0, 1 - f.age / 0.8);
      drawText(ctx, f.text, f.x, f.y - f.age * 30, { size: 14, bold: true, align: 'center', color: f.color });
    }
    ctx.globalAlpha = 1;
    floaters = floaters.filter((f) => f.age < 0.8);
  }

  function drawHud(ctx: CanvasRenderingContext2D, r: Run): void {
    const h = r.hero;
    // HP — top left.
    drawPanel(ctx, { x: 12, y: 10, w: 260, h: 58 }, 'rgba(14, 16, 24, 0.75)');
    drawText(ctx, `${REWORK_CLASSES[h.classId].name} · рівень ${r.level}`, 24, 28, { size: 14, bold: true });
    ctx.fillStyle = '#2a1416';
    ctx.fillRect(24, 40, 236, 16);
    ctx.fillStyle = '#d0453c';
    ctx.fillRect(24, 40, 236 * (h.hp / h.maxHp), 16);
    drawText(ctx, `${Math.ceil(h.hp)} / ${h.maxHp}`, 142, 49, { size: 12, bold: true, align: 'center' });
    // Timer — top centre.
    drawText(ctx, mmss(r.time), W / 2, 30, { size: 26, bold: true, align: 'center', color: r.time >= REWORK_FLOOD.runTime ? THEME.accent : THEME.text });
    drawText(ctx, `звірів убито: ${r.kills} · золото: ${r.gold}`, W / 2, 54, { size: 12, align: 'center', color: THEME.textDim });
    // Experience — along the bottom.
    const need = xpToNext(r.level);
    ctx.fillStyle = 'rgba(10, 14, 22, 0.8)';
    ctx.fillRect(0, H - 10, W, 10);
    ctx.fillStyle = '#5fb3e0';
    ctx.fillRect(0, H - 10, W * Math.min(1, r.xp / need), 10);
    // The dodge — bottom left.
    const d = REWORK_CLASSES[h.classId].dodge;
    const ready = h.dodgeTimer <= 0;
    drawPanel(ctx, { x: 12, y: H - 58, w: 190, h: 40 }, 'rgba(14, 16, 24, 0.75)');
    drawText(ctx, `Пробіл — ${d.name}`, 22, H - 44, { size: 12, bold: true, color: ready ? THEME.text : THEME.textMuted });
    ctx.fillStyle = '#2a2f3e';
    ctx.fillRect(22, H - 34, 170, 6);
    ctx.fillStyle = ready ? THEME.good : '#7a8299';
    ctx.fillRect(22, H - 34, 170 * (1 - h.dodgeTimer / d.cooldown), 6);
  }

  function drawOffer(ctx: CanvasRenderingContext2D, r: Run): void {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'Новий рівень: оберіть одне', W / 2, H / 2 - 140, { size: 22, bold: true, align: 'center', color: THEME.accent });
    r.offer!.forEach((c, i) => {
      const rect = cardRect(i);
      const def = REWORK_CARDS[c.id];
      drawPanel(ctx, rect, 'rgba(24, 28, 40, 0.95)');
      drawText(ctx, `[${i + 1}]`, rect.x + 12, rect.y + 20, { size: 12, color: THEME.textMuted });
      drawText(ctx, def.name, rect.x + rect.w / 2, rect.y + 50, { size: 20, bold: true, align: 'center' });
      drawText(ctx, `ранг ${c.rank} з ${def.ranks}`, rect.x + rect.w / 2, rect.y + 76, { size: 12, align: 'center', color: THEME.textDim });
      ctx.font = font(13);
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'center';
      drawWrapped(ctx, def.text.replace('{v}', String(def.value)), rect.x + rect.w / 2, rect.y + 108, rect.w - 28, 18);
    });
    const price = rerollPrice(r);
    drawText(ctx, `R — перекинути за ${price} зол. (є ${r.gold})`, W / 2, H / 2 + 120, { size: 14, align: 'center', color: r.gold >= price ? THEME.text : THEME.textMuted });
  }

  function drawDeath(ctx: CanvasRenderingContext2D, r: Run): void {
    ctx.fillStyle = 'rgba(20, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'Загинув', W / 2, H / 2 - 50, { size: 36, bold: true, align: 'center', color: THEME.bad });
    drawText(ctx, `${mmss(r.time)} · рівень ${r.level} · звірів убито: ${r.kills}`, W / 2, H / 2, { size: 16, align: 'center' });
    deathButtons.draw(ctx);
  }

  function drawClassChoice(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, 'Реворк: Ліс', W / 2, H / 2 - 120, { size: 32, bold: true, align: 'center', color: THEME.accent });
    drawText(ctx, 'Оберіть клас', W / 2, H / 2 - 80, { size: 16, align: 'center', color: THEME.textDim });
    CLASS_ORDER.forEach((id, i) => {
      const c = REWORK_CLASSES[id];
      const kind = c.attack.kind === 'arc' ? 'удар дугою' : c.attack.kind === 'bolt' ? 'вогняний снаряд' : 'стріла крізь ворога';
      drawText(ctx, `${c.hp} HP · ${kind}`, W / 2 - 225 + i * 225, H / 2 + 56, { size: 12, align: 'center', color: THEME.textDim });
      drawText(ctx, `ухил: ${c.dodge.name}`, W / 2 - 225 + i * 225, H / 2 + 74, { size: 12, align: 'center', color: THEME.textDim });
    });
    classButtons.draw(ctx);
    drawText(ctx, 'WASD — ходити · атака сама · Пробіл — ухил · 1–3 — картка, R — перекинути', W / 2, H - 30, { size: 12, align: 'center', color: THEME.textMuted });
  }
}

const clampCam = (v: number, max: number): number => Math.max(0, Math.min(Math.max(0, max), v));
