// The "Реворк: Ліс" mode (ROADMAP 20.1–20.6, dev only): the new core grows here next to the old
// game. A class is chosen, then the run: the Forest map, the flood of beasts, the automatic
// attack, skills on keys 1–4 aimed at the cursor, the dodge on Space, experience and the choice
// of 1 of 3 cards, death and a restart.
// A small panel keeps the stress test of 20.1 and the frame rate.

import type { Screen } from '../core/screens';
import { Rng } from '../core/rng';
import { REWORK_CARDS, REWORK_CLASSES, REWORK_FLOOD, REWORK_STRESS, type ReworkClassId } from '../data/rework';
import { REWORK_SKILLS, SKILL_SLOTS, skillParams } from '../data/reworkSkills';
import { dodge } from '../systems/rework/hero';
import { chooseCard, reroll, rerollPrice, xpToNext } from '../systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../systems/rework/run';
import { castSkill } from '../systems/rework/skills';
import type { CardOffer, Obstacle, Run } from '../systems/rework/types';
import type { Vec } from '../systems/entities';
import type { App } from './app';
import { type HeroAnimState, drawHeroDust, drawWarrior, heroAnimAttack, heroAnimCast, newHeroAnim, stepHeroAnim } from './heroAnim';
import { CROWN_FADE, crownBox, drawCoin, drawEnemy, drawEnemyWarning, drawGem, drawHeroFigure, drawObstacle, drawShadow, drawShot, drawTrap, drawZone } from './reworkDraw';
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

/** A flash of a skill: a ring that grows and fades, or a lightning chain. */
interface Flash {
  kind: 'ring' | 'chain';
  points: Vec[];
  radius: number;
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

/**
 * The rework's cursor: a gold pointer with a dark outline in the game's style (the colour of the
 * sign on the hero's chest). A browser cursor, not drawn on the field, so it never lags behind the
 * mouse — skills fly to its tip.
 */
const CURSOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
  '<path d="M3 2 L3 22 L8.5 16.5 L12.5 25 L16 23.5 L12 15 L20 15 Z" fill="#f2c14e" stroke="#1a1410" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M5.5 6.5 L5.5 16 L8.5 13 Z" fill="#fff3c4" opacity="0.7"/>' +
  '</svg>';
const CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}") 3 2, auto`;

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
  let flashes: Flash[] = [];
  let seed = 1;
  /** The camera of the last frame: the cursor's world point is read through it. */
  let cam = { x: 0, y: 0 };
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
    // Dev: the run is reachable from the console as window.__rework.
    if (app.debug && typeof window !== 'undefined') (window as unknown as { __rework?: Run }).__rework = r;
    anim = newHeroAnim();
    floaters = [];
    swings = [];
    flashes = [];
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
      } else if (e.type === 'cast') heroAnimCast(anim, e.skill);
      else if (e.type === 'blast') flashes.push({ kind: 'ring', points: [e.pos], radius: e.radius, color: e.color, age: 0 });
      else if (e.type === 'chain') flashes.push({ kind: 'chain', points: e.points, radius: 0, color: '#bfe3ff', age: 0 });
      else if (e.type === 'levelUp') floaters.push({ x: r.hero.pos.x, y: r.hero.pos.y - 80, text: `Рівень ${e.level}!`, color: THEME.accent, age: -0.2 });
    }
    r.events = [];
  };

  return {
    enter() {
      run = null;
      animTime = app.time;
      app.view.canvas.style.cursor = CURSOR;
    },

    exit() {
      app.view.canvas.style.cursor = '';
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
      if (e.type === 'key' && /^Digit[1-4]$/.test(e.code)) castSkill(run, Number(e.code.slice(5)) - 1, cursorWorld());
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
      cam = { x: clampCam(h.pos.x - W / 2, r.width - W), y: clampCam(h.pos.y - H / 2 - 30, r.height - H) };
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
      for (const z of r.zones) if (onScreen(z.pos.x, z.pos.y, z.radius)) drawZone(ctx, z, r.time);
      for (const t of r.traps) if (onScreen(t.pos.x, t.pos.y, 20)) drawTrap(ctx, t);
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 200)) drawEnemyWarning(ctx, e);
      drawSwings(ctx, paused ? 0 : dt);
      if (r.spin) drawSpin(ctx, r);
      if (h.classId === 'warrior') drawHeroDust(ctx, anim);

      // Bodies and obstacles sorted by their foot: lower on the screen is in front.
      const items: { y: number; draw: () => void }[] = [];
      // Who could stand hidden behind a tree: the hero and the beasts on screen (foot and height).
      const bodies = [{ x: h.pos.x, y: h.pos.y, tall: 70 }];
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 40)) bodies.push({ x: e.pos.x, y: e.pos.y, tall: e.radius * 2.6 });
      for (const o of r.obstacles) if (onScreen(o.pos.x, o.pos.y, o.height + 80)) items.push({ y: o.pos.y, draw: () => drawObstacle(ctx, o, treeAlpha(o, bodies)) });
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 40)) items.push({ y: e.pos.y, draw: () => drawEnemy(ctx, e, r.time) });
      items.push({ y: h.pos.y, draw: () => drawHero(ctx, r, paused ? 0 : dt) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      for (const s of r.shots) if (onScreen(s.pos.x, s.pos.y, 20)) drawShot(ctx, s, r.time);
      drawFlashes(ctx, paused ? 0 : dt);
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

  /** The cursor on the field, or null when it is off the canvas. */
  function cursorWorld(): Vec | null {
    const m = app.input.mouse;
    if (m.x < 0 || m.y < 0) return null;
    return { x: m.x + cam.x, y: m.y + cam.y };
  }

  function drawSpin(ctx: CanvasRenderingContext2D, r: Run): void {
    const sp = r.spin!;
    const h = r.hero;
    ctx.strokeStyle = 'rgba(235, 240, 255, 0.55)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = r.time * 14 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(h.pos.x, h.pos.y - 10, sp.radius, sp.radius * 0.6, 0, a, a + 1.2);
      ctx.stroke();
    }
  }

  function drawFlashes(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const f of flashes) {
      f.age += dt;
      const k = f.age / 0.3;
      ctx.strokeStyle = f.color;
      if (f.kind === 'ring') {
        const p = f.points[0]!;
        const rr = f.radius * (0.6 + 0.4 * Math.min(1, k * 2));
        ctx.lineWidth = 4;
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.max(0, 0.25 * (1 - k));
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rr, rr * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.lineWidth = 3;
        ctx.beginPath();
        f.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x + (i % 2 ? 4 : -4), p.y)));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    flashes = flashes.filter((f) => f.age < 0.3);
  }

  /** A tree fades when the hero or a beast stands behind it, so nobody is hidden. */
  function treeAlpha(o: Obstacle, bodies: { x: number; y: number; tall: number }[]): number {
    const c = crownBox(o);
    if (!c) return 1;
    const behind = bodies.some((b) => b.y < o.pos.y && Math.abs(b.x - c.x) < c.r + 8 && b.y > c.y - c.r && b.y - b.tall < c.y + c.r);
    return behind ? CROWN_FADE : 1;
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
    // Skills — bottom centre, keys 1–4.
    const size = 64;
    const x0 = W / 2 - (SKILL_SLOTS * (size + 8) - 8) / 2;
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const x = x0 + i * (size + 8);
      const y = H - size - 18;
      const sk = r.skills[i];
      drawPanel(ctx, { x, y, w: size, h: size }, sk ? 'rgba(30, 34, 48, 0.9)' : 'rgba(14, 16, 24, 0.55)');
      drawText(ctx, String(i + 1), x + 7, y + 10, { size: 11, bold: true, color: THEME.textMuted });
      if (!sk) continue;
      // The name fits the slot (shrinks if long) and dims while the skill recharges.
      const words = REWORK_SKILLS[sk.id].name.split(' ');
      ctx.globalAlpha = sk.cooldown > 0 ? 0.35 : 1;
      words.forEach((w, j) => {
        ctx.font = font(11, 'bold');
        const fit = Math.min(11, (11 * (size - 8)) / ctx.measureText(w).width);
        drawText(ctx, w, x + size / 2, y + 30 + j * 13 - (words.length - 1) * 6, { size: fit, bold: true, align: 'center' });
      });
      ctx.globalAlpha = 1;
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k < sk.rank ? THEME.accent : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 9 + k * 10, y + size - 10, 7, 4);
      }
      if (sk.cooldown > 0) {
        const full = Math.max(0.5, skillParams(sk.id, sk.rank).cooldown);
        const hgt = size * Math.min(1, sk.cooldown / full);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y + size - hgt, size, hgt);
        drawText(ctx, sk.cooldown.toFixed(1), x + size / 2, y + size / 2, { size: 15, bold: true, align: 'center' });
      }
    }
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
      const card = cardText(c);
      drawPanel(ctx, rect, card.isNew ? 'rgba(40, 34, 18, 0.96)' : 'rgba(24, 28, 40, 0.95)', card.isNew ? THEME.accent : undefined);
      drawText(ctx, `[${i + 1}]`, rect.x + 12, rect.y + 20, { size: 12, color: THEME.textMuted });
      drawText(ctx, card.kind, rect.x + rect.w - 12, rect.y + 20, { size: 11, align: 'right', color: card.isNew ? THEME.accent : THEME.textMuted });
      drawText(ctx, card.name, rect.x + rect.w / 2, rect.y + 52, { size: 20, bold: true, align: 'center' });
      drawText(ctx, card.rank, rect.x + rect.w / 2, rect.y + 78, { size: 12, align: 'center', color: THEME.textDim });
      ctx.font = font(13);
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'center';
      drawWrapped(ctx, card.text, rect.x + rect.w / 2, rect.y + 104, rect.w - 28, 18);
    });
    const price = rerollPrice(r);
    drawText(ctx, `R — перекинути за ${price} зол. (є ${r.gold})`, W / 2, H / 2 + 120, { size: 14, align: 'center', color: r.gold >= price ? THEME.text : THEME.textMuted });
  }

  /** What a card says: a new skill, a skill's next rank or a passive's next rank. */
  function cardText(c: CardOffer): { kind: string; name: string; rank: string; text: string; isNew: boolean } {
    if (c.kind === 'passive') {
      const d = REWORK_CARDS[c.id];
      return { kind: 'пасивка', name: d.name, rank: `ранг ${c.rank} з ${d.ranks}`, text: d.text.replace('{v}', String(d.value)), isNew: false };
    }
    const d = REWORK_SKILLS[c.id];
    if (c.rank === 1) return { kind: 'новий скіл', name: d.name, rank: `перезарядка ${skillParams(c.id, 1).cooldown} с`, text: d.text, isNew: true };
    return { kind: 'скіл', name: d.name, rank: `ранг ${c.rank} з ${d.ranks.length + 1}`, text: `${d.name}: ${d.ranks[c.rank - 2]!.text}`, isNew: false };
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
    drawText(ctx, 'WASD — ходити · атака сама · 1–4 — скіли (цілять у курсор) · Пробіл — ухил · у виборі: 1–3, R — перекинути', W / 2, H - 30, { size: 12, align: 'center', color: THEME.textMuted });
  }
}

const clampCam = (v: number, max: number): number => Math.max(0, Math.min(Math.max(0, max), v));
