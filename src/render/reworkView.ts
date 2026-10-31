// The "Реворк: Ліс" mode (ROADMAP 20.1–20.13, dev only): the new core grows here next to the old
// game. A class is chosen, then the run: the Forest map with herbs, shrines and altars, the flood
// of beasts and elites, the automatic attack, skills on keys 1–4 aimed at the cursor, passives,
// evolutions, the dodge on Space, the spirit's fog, the task with its arrow, and the boss in the
// living ring — the camera pulls back for the duel. Death or victory, and a restart.
// A small panel keeps the stress test of 20.1 and the frame rate.

import type { Screen } from '../core/screens';
import { Rng } from '../core/rng';
import { PASSIVE_SLOTS, REWORK_BOSS, REWORK_LIVES, REWORK_LOCATIONS, REWORK_PICKUPS, REWORK_PATH, REWORK_POINTERS, REWORK_SPIRIT, REWORK_TASKS, REWORK_CARDS, REWORK_CLASSES, REWORK_STRESS, type ReworkClassId } from '../data/rework';
import { EVOLUTIONS, REWORK_SKILLS, SKILL_SLOTS, skillParams } from '../data/reworkSkills';
import { bossIn } from '../systems/rework/boss';
import { altarNear, altarPrice, useAltar } from '../systems/rework/pickups';
import { sightRadius } from '../systems/rework/spirit';
import { pullSegments } from '../systems/rework/spinner';
import { taskLine } from '../systems/rework/task';
import { type DeathOutcome, type Expedition, loseLife, newExpedition, reachCheckpoint } from '../systems/rework/expedition';
import { dodge } from '../systems/rework/hero';
import { chooseCard, passivesTaken, reroll, rerollPrice, xpToNext } from '../systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../systems/rework/run';
import { castSkill, effectiveParams, evolutionReady, passiveNotes } from '../systems/rework/skills';
import type { CardOffer, Obstacle, Run } from '../systems/rework/types';
import type { Vec } from '../systems/entities';
import type { App } from './app';
import { type HeroAnimState, drawHeroDust, drawHeroFx, drawHeroFrames, heroAnimAttack, heroAnimCast, heroAnimDodge, newHeroAnim, stepHeroAnim } from './heroAnim';
import { DodgeFx } from './dodgeFx';
import { BEAST_ANIM } from '../data/beastAnim';
import { HERO_FX } from '../data/heroAnim';
import { drawGround, propSet } from './forestArt';
import { beastSheet, beastSize, type Corpse, corpseLife, drawCorpse, lastSide } from './beastAnim';
import { CROWN_FADE, crownBox, obstacleLayers, drawAltar, drawBossWarning, drawChest, drawCoin, drawEnemy, drawEnemyWarning, drawGem, drawHerb, drawHeroFigure, drawLumberjack, drawBranch, drawCocoonRemains, drawGhost, drawHazard, drawShade, drawPath, drawPull, drawRingWall, drawThreads, drawWebPatch, drawWrap, drawShadow, drawShot, drawShrine, drawSpirit, drawTaskGround, drawTrap, drawZone } from './reworkDraw';
import { THEME, font } from './theme';
import { Button, ButtonGroup, drawPanel, drawText, drawWrapped } from './ui';

interface Patch {
  x: number;
  y: number;
  r: number;
  shade: string;
}

/** An arrow to something to find: its place, how high over its foot to point, its name. */
interface Pointer {
  key: string;
  pos: Vec;
  lift: number;
  label: string;
  color: string;
}

/** The Berehynia's voice from the sign. */
const SIGN_VOICE = '#e8dcae';

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  /** A note (a chest, a task, a shrine) is bigger and stays longer than a number. */
  size?: number;
  life?: number;
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
  /** Dead beasts lying a moment where they fell. */
  let corpses: Corpse[] = [];
  /** Seconds since the last level-up's pillar of light began (negative — none). */
  let levelFx = -1;
  /** The new location's name over the screen for a moment. */
  let banner: { text: string; age: number } | null = null;
  /** When each arrow first showed (screen time, so it settles while the run is still): a new one pulses. */
  const pointerSeen = new Map<string, number>();
  /** Effects of the dodge on Space; `dodging` — a dodge was in flight last frame. */
  const dodgeFx = new DodgeFx();
  let dodging = false;
  let seed = 1;
  /** The camera of the last frame and its zoom (pulled back for the duel): the cursor's world point is read through them. */
  let cam = { x: 0, y: 0 };
  let zoom = 1;
  let fogCanvas: HTMLCanvasElement | null = null;
  // Frame rate and the cost of one logic step, averaged over half a second.
  let frames = 0;
  let frameClock = 0;
  let fps = 0;
  let stepMs = 0;
  let stepSum = 0;
  let stepCount = 0;

  /** The expedition (lives, checkpoint); standing at the biome's point between runs; what the last death or the checkpoint said. */
  let expedition: Expedition | null = null;
  let atPoint = false;
  let death: DeathOutcome | null = null;
  let checkpoint: string | null = null;

  /** A new expedition with the class: to the Forest's point on the map. */
  const begin = (id: ReworkClassId): void => {
    classId = id;
    expedition = newExpedition(id);
    run = null;
    atPoint = true;
    death = null;
  };

  /** Back to the biome's point (after a death); the run that was is gone. */
  const toPoint = (): void => {
    run = null;
    atPoint = true;
  };

  const start = (id: ReworkClassId): void => {
    classId = id;
    atPoint = false;
    death = null;
    checkpoint = null;
    seed += 1;
    const r = createRun(app.state.seed + seed, id);
    run = r;
    // Dev: the run is reachable from the console as window.__rework.
    if (app.debug && typeof window !== 'undefined') (window as unknown as { __rework?: Run }).__rework = r;
    anim = newHeroAnim();
    floaters = [];
    swings = [];
    flashes = [];
    corpses = [];
    banner = { text: REWORK_LOCATIONS[0]!.name, age: 0 };
    pointerSeen.clear();
    levelFx = -1;
    dodgeFx.reset();
    dodging = false;
    zoom = 1;
    const g = new Rng(app.state.seed).fork('reworkGround');
    patches = Array.from({ length: 900 }, () => ({ x: g.next() * r.width, y: g.next() * r.height, r: 18 + g.next() * 60, shade: PATCH_SHADES[Math.floor(g.next() * PATCH_SHADES.length)]! }));
  };

  const classButtons = new ButtonGroup(
    CLASS_ORDER.map((id, i) => new Button({ label: `${REWORK_CLASSES[id].name} [${i + 1}]`, rect: { x: W / 2 - 330 + i * 225, y: H / 2 - 10, w: 210, h: 46 }, fontSize: 17, hotkey: `Digit${i + 1}`, onClick: () => begin(id) })),
  );
  const newExpeditionButton = (): Button => new Button({ label: 'Нова експедиція [C]', rect: { x: W / 2 + 10, y: H / 2 + 90, w: 220, h: 44 }, fontSize: 16, hotkey: 'KeyC', onClick: () => ((expedition = null), (run = null), (atPoint = false)) });
  const deathButtons = new ButtonGroup([
    new Button({ label: 'До точки Лісу [Enter]', rect: { x: W / 2 - 230, y: H / 2 + 90, w: 220, h: 44 }, fontSize: 16, hotkey: 'Enter', onClick: toPoint }),
    newExpeditionButton(),
  ]);
  const victoryButtons = new ButtonGroup([
    new Button({ label: 'Ще раз [Enter]', rect: { x: W / 2 - 230, y: H / 2 + 90, w: 220, h: 44 }, fontSize: 16, hotkey: 'Enter', onClick: () => begin(classId) }),
    newExpeditionButton(),
  ]);
  const pointButtons = new ButtonGroup([
    new Button({ label: 'Увійти в Ліс [Enter]', rect: { x: W / 2 - 230, y: H / 2 + 90, w: 220, h: 44 }, fontSize: 16, hotkey: 'Enter', onClick: () => start(classId) }),
    newExpeditionButton(),
  ]);
  const cardRect = (i: number): { x: number; y: number; w: number; h: number } => ({ x: W / 2 - 375 + i * 255, y: H / 2 - 110, w: 240, h: 200 });
  const debug = new ButtonGroup([
    ...REWORK_STRESS.counts.map((n, i) => new Button({ label: `+${n}`, rect: { x: W - 316 + i * 62, y: H - 46, w: 56, h: 28 }, fontSize: 12, onClick: () => run && stressSpawn(run, n) })),
    new Button({ label: 'Безсмертя', rect: { x: W - 126, y: H - 46, w: 110, h: 28 }, fontSize: 12, onClick: () => run && (run.hero.immortal = !run.hero.immortal) }),
  ]);
  const exitBtn = new ButtonGroup([
    new Button({ label: 'Вийти [Esc]', rect: { x: W - 126, y: 12, w: 110, h: 30 }, fontSize: 13, hotkey: 'Escape', onClick: () => app.screens.go('title') }),
    new Button({ label: 'Налаштування', rect: { x: W - 252, y: 12, w: 120, h: 30 }, fontSize: 13, onClick: () => app.openSettings() }),
  ]);

  const readEvents = (r: Run): void => {
    for (const e of r.events) {
      if (e.type === 'hit') floaters.push({ x: e.pos.x + (r.rng.next() - 0.5) * 10, y: e.pos.y - 30, text: String(Math.max(1, Math.round(e.amount))), color: e.byHero ? '#ffffff' : '#ff6b5e', age: 0 });
      else if (e.type === 'location') {
        // The next location: its name over the screen; what lay on the old field is gone.
        banner = { text: REWORK_LOCATIONS[e.index]!.name, age: 0 };
        corpses = [];
        floaters = [];
        swings = [];
        flashes = [];
        pointerSeen.clear();
        dodgeFx.reset();
        dodging = false;
      } else if (e.type === 'kill') {
        corpses.push({ def: e.def, x: e.pos.x, y: e.pos.y, side: lastSide(e.id), size: beastSize(e.def, e.radius), boss: e.boss, age: 0 });
        if (corpses.length > BEAST_ANIM.maxCorpses) corpses.shift();
      } else if (e.type === 'swing') {
        swings.push({ x: e.pos.x, y: e.pos.y, angle: e.angle, reach: e.reach, arc: e.arc, age: 0 });
      } else if (e.type === 'attack') heroAnimAttack(anim, r.hero.classId);
      else if (e.type === 'dodge') {
        heroAnimDodge(anim);
        dodgeFx.start(REWORK_CLASSES[r.hero.classId].dodge.kind, e.from, e.to);
        dodging = true;
      }
      else if (e.type === 'cast') heroAnimCast(anim, r.hero.classId, e.skill);
      else if (e.type === 'blast') flashes.push({ kind: 'ring', points: [e.pos], radius: e.radius, color: e.color, age: 0 });
      else if (e.type === 'chain') flashes.push({ kind: 'chain', points: e.points, radius: 0, color: '#bfe3ff', age: 0 });
      else if (e.type === 'levelUp') {
        floaters.push({ x: r.hero.pos.x, y: r.hero.pos.y - 80, text: `Рівень ${e.level}!`, color: THEME.accent, age: -0.2 });
        levelFx = 0;
      }
      else if (e.type === 'note') floaters.push({ x: e.pos.x, y: e.pos.y, text: e.text, color: e.color, age: 0, size: 16, life: 2.2 });
      else if (e.type === 'evolve') floaters.push({ x: r.hero.pos.x, y: r.hero.pos.y - 100, text: `Еволюція: ${EVOLUTIONS[e.skill]!.name}!`, color: '#ffd27a', age: 0, size: 20, life: 2.5 });
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
        if (expedition && atPoint) pointButtons.handle(e);
        else classButtons.handle(e);
        return;
      }
      if (debug.handle(e)) return;
      if (run.hero.dead) {
        deathButtons.handle(e);
        return;
      }
      if (run.phase === 'won' && !run.path) {
        victoryButtons.handle(e);
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
      // The dodge goes towards the cursor or along the walk — as the player set it.
      if (e.type === 'key' && e.code === 'Space') dodge(run, app.input.moveVector(), app.settings.dodgeToCursor ? cursorWorld() : null);
      if (e.type === 'key' && /^Digit[1-4]$/.test(e.code)) castSkill(run, Number(e.code.slice(5)) - 1, cursorWorld());
      if (e.type === 'key' && e.code === 'KeyE') useAltar(run);
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
        if (expedition && atPoint) drawPoint(ctx, expedition);
        else drawClassChoice(ctx);
        exitBtn.draw(ctx);
        return;
      }
      const r = run;
      // A death costs a sign once; beating the biome's boss is a checkpoint once.
      if (expedition && r.hero.dead && !death) death = loseLife(expedition);
      if (expedition && r.phase === 'won' && !r.path && !checkpoint) checkpoint = reachCheckpoint(expedition);
      readEvents(r);
      const paused = runPaused(r);
      const h = r.hero;
      // The duel: the camera eases back and holds the ring; otherwise it follows the hero.
      const duel = r.phase === 'ring' || r.phase === 'won';
      zoom += ((duel ? REWORK_BOSS.zoom : 1) - zoom) * Math.min(1, dt * 3);
      const vw = W / zoom;
      const vh = H / zoom;
      const focus = duel ? r.ringCenter : h.pos;
      cam = { x: clampCam(focus.x - vw / 2, r.width - vw), y: clampCam(focus.y - vh / 2 - 30, r.height - vh) };
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-cam.x, -cam.y);
      const onScreen = (x: number, y: number, m: number): boolean => x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m * 2;
      // Ground (the texture; patches of code until it loads), things lying on it, warnings.
      const ground = drawGround(ctx, cam.x, cam.y, vw, vh, propSet(REWORK_LOCATIONS[r.location]!.map).ground);
      for (const p of ground ? [] : patches) {
        if (!onScreen(p.x, p.y, p.r)) continue;
        ctx.fillStyle = p.shade;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The deeper forest: the ground under the dense crowns is darker.
      const L = REWORK_LOCATIONS[r.location]!;
      if (L.dark > 0) {
        ctx.fillStyle = `rgba(6, 12, 16, ${L.dark})`;
        ctx.fillRect(cam.x, cam.y, vw, vh);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, r.width, r.height);
      for (const w of r.webs) if (onScreen(w.pos.x, w.pos.y, w.radius)) drawWebPatch(ctx, w);
      if (r.path) drawPath(ctx, r.path, REWORK_PATH.radius, animTime);
      for (const g of r.herbs) if (onScreen(g.pos.x, g.pos.y, 20)) drawHerb(ctx, g, r.time);
      if (r.task) drawTaskGround(ctx, r.task, r.time);
      if (duel) drawRingWall(ctx, r.ringCenter, r.time);
      for (const g of r.gems) if (onScreen(g.pos.x, g.pos.y, 10)) drawGem(ctx, g, r.time);
      for (const c of r.coins) if (onScreen(c.pos.x, c.pos.y, 10)) drawCoin(ctx, c);
      for (const z of r.zones) if (onScreen(z.pos.x, z.pos.y, z.radius)) drawZone(ctx, z, r.time);
      for (const t of r.traps) if (onScreen(t.pos.x, t.pos.y, 20)) drawTrap(ctx, t);
      for (const c of corpses) {
        c.age += paused ? 0 : dt;
        if (!onScreen(c.x, c.y, 60)) continue;
        if (c.def === 'cocoon') drawCocoonRemains(ctx, c, corpseLife(c));
        else drawCorpse(ctx, c);
      }
      corpses = corpses.filter((c) => c.age < corpseLife(c));
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 200)) drawEnemyWarning(ctx, e);
      for (const e of r.enemies) if (e.boss) drawBossWarning(ctx, e, h.pos);
      if (r.shade) drawShade(ctx, r.shade.pos, REWORK_BOSS.enat.shade.radius, animTime);
      // Strikes on the ground; roots and spikes that burst out stand among the bodies (below).
      const standing = (z: (typeof r.hazards)[number]): boolean => z.struck && (z.kind === 'root' || z.kind === 'spike');
      for (const z of r.hazards) if (!standing(z)) drawHazard(ctx, z);
      drawThreads(ctx, r.threads, r.pull);
      if (r.pull) drawPull(ctx, pullSegments(r), pullSegments(r, true), r.pull.time < 0);
      drawSwings(ctx, paused ? 0 : dt);
      if (r.spin) drawSpin(ctx, r);
      drawHeroDust(ctx, anim);
      // The dodge: a trail while it flies, its landing when it is over.
      const fdt = paused ? 0 : dt;
      if (dodging && h.dash) dodgeFx.follow(h.pos, fdt);
      else if (dodging) {
        dodgeFx.end(h.pos);
        dodging = false;
      }
      dodgeFx.update(fdt);
      dodgeFx.drawUnder(ctx);
      dodgeFx.drawGhosts(ctx, (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        drawHeroFrames(ctx, anim, h.classId, 2, false, 'ghost');
        ctx.restore();
      });

      // Bodies and obstacles sorted by their foot: lower on the screen is in front.
      const items: { y: number; draw: () => void }[] = [];
      // Who could stand hidden behind a tree: the hero and the beasts on screen (foot and height).
      const bodies = [{ x: h.pos.x, y: h.pos.y, tall: 70 }];
      for (const e of r.enemies) {
        if (!onScreen(e.pos.x, e.pos.y, 40)) continue;
        const sh = beastSheet(e.def);
        bodies.push({ x: e.pos.x, y: e.pos.y, tall: sh ? sh.height * beastSize(e.def, e.radius) : e.radius * 2.6 });
      }
      for (const o of r.obstacles) {
        if (!onScreen(o.pos.x, o.pos.y, o.height + 80)) continue;
        for (const l of obstacleLayers(o)) items.push({ y: l.y, draw: () => l.draw(ctx, treeAlpha(o, bodies)) });
      }
      for (const e of r.enemies) if (onScreen(e.pos.x, e.pos.y, 40)) items.push({ y: e.pos.y, draw: () => drawEnemy(ctx, e, r.time) });
      for (const c of r.chests) if (onScreen(c.pos.x, c.pos.y, 30)) items.push({ y: c.pos.y, draw: () => drawChest(ctx, c, r.time) });
      for (const s of r.shrines) if (onScreen(s.pos.x, s.pos.y, 60)) items.push({ y: s.pos.y, draw: () => drawShrine(ctx, s, r.time) });
      const altarHere = altarNear(r);
      for (const a of r.altars) if (onScreen(a.pos.x, a.pos.y, 40)) items.push({ y: a.pos.y, draw: () => drawAltar(ctx, a, r.time, a === altarHere) });
      const task = r.task;
      if (task) items.push({ y: task.man.y, draw: () => drawLumberjack(ctx, task, r.time, h.pos) });
      items.push({ y: h.pos.y, draw: () => drawHero(ctx, r, paused ? 0 : dt) });
      for (const z of r.hazards) if (standing(z)) items.push({ y: z.pos.y + 6, draw: () => drawHazard(ctx, z) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      for (const s of r.shots) if (onScreen(s.pos.x, s.pos.y, 20)) drawShot(ctx, s, r.time);
      for (const e of r.enemies) if (e.def === 'enat') drawBranch(ctx, e, h.pos);
      // Before the lair's fight: the Old Enat's ghost by the hero, asking for help.
      if (r.ghost > 0) {
        const a = Math.min(1, r.ghost / 1, (REWORK_BOSS.enat.ghostTime - r.ghost) / 0.8);
        drawGhost(ctx, { x: h.pos.x + 170, y: h.pos.y - 20 }, a);
        ctx.save();
        ctx.globalAlpha = a;
        outlinedText(ctx, `«${REWORK_BOSS.enat.ghost}»`, h.pos.x + 170, h.pos.y - 205, 16, '#d8f0d0');
        ctx.restore();
      }
      dodgeFx.drawOver(ctx);
      drawFlashes(ctx, paused ? 0 : dt);
      ctx.restore();
      // The deeper forest's gloom over everything.
      if (L.dark > 0) {
        ctx.fillStyle = `rgba(4, 8, 14, ${L.dark * 0.35})`;
        ctx.fillRect(0, 0, W, H);
      }

      // The fog: the field beyond the hero's sight is veiled; the spirit is seen through it.
      if (r.fog > 0.01) {
        // Painted at a quarter of the size and stretched: the fog is soft anyway, and a full-screen
        // gradient every frame is costly.
        const q = 4;
        if (!fogCanvas) {
          fogCanvas = document.createElement('canvas');
          fogCanvas.width = Math.ceil(W / q);
          fogCanvas.height = Math.ceil(H / q);
        }
        const fc = fogCanvas.getContext('2d')!;
        const sx = ((h.pos.x - cam.x) * zoom) / q;
        const sy = ((h.pos.y - 30 - cam.y) * zoom) / q;
        const rad = (sightRadius(r.fog) * zoom) / q;
        const g = fc.createRadialGradient(sx, sy, rad * 0.55, sx, sy, rad);
        const a = Math.min(0.9, r.fog);
        g.addColorStop(0, 'rgba(150, 165, 150, 0)');
        g.addColorStop(1, `rgba(150, 165, 150, ${a})`);
        fc.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
        fc.fillStyle = g;
        fc.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(fogCanvas, 0, 0, W, H);
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-cam.x, -cam.y);
        for (const e of r.enemies) if (e.def === 'spirit') drawSpirit(ctx, e, r.time);
        ctx.restore();
      }
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-cam.x, -cam.y);
      drawFloaters(ctx, paused ? 0 : dt);
      ctx.restore();

      drawHud(ctx, r);
      drawTaskHud(ctx, r);
      drawPointers(ctx, r);
      drawBossHud(ctx, r);
      if (altarHere && !r.offer && !duel) drawText(ctx, `E — вівтар: картка за ${altarPrice(r)} зол. (є ${r.gold})`, W / 2, H - 112, { size: 14, bold: true, align: 'center', color: r.gold >= altarPrice(r) ? '#ffe08a' : THEME.textMuted });
      if (r.offer && r.phase !== 'won') drawOffer(ctx, r);
      if (h.dead) drawDeath(ctx, r);
      else if (r.phase === 'won' && !r.path) drawVictory(ctx, r);
      // The location's name waits for the card choice to close.
      if (banner && !r.offer && !h.dead) drawBanner(ctx, dt);
      drawSkillTooltip(ctx, r);
      debug.draw(ctx);
      drawText(ctx, `${Math.round(fps)} к/с · ${r.enemies.length} звірів · логіка ${stepMs.toFixed(2)} мс${h.immortal ? ' · безсмертя' : ''}`, W - 16, H - 56, { size: 11, align: 'right', color: fps >= 55 ? THEME.good : THEME.bad });
      exitBtn.draw(ctx);
    },
  };

  /** The cursor on the field, or null when it is off the canvas. */
  function cursorWorld(): Vec | null {
    const m = app.input.mouse;
    if (m.x < 0 || m.y < 0) return null;
    return { x: m.x / zoom + cam.x, y: m.y / zoom + cam.y };
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
    stepHeroAnim(anim, h.classId, h, dt, -Infinity);
    const flash = r.time - h.hitAt < 0.1;
    drawShadow(ctx, h.pos.x, h.pos.y, h.radius);
    // The dodge shows only its own frames and dust: no blinking for the invulnerability.
    ctx.save();
    ctx.translate(h.pos.x, h.pos.y);
    const drawn = drawHeroFrames(ctx, anim, h.classId, 2, flash);
    ctx.restore();
    if (!drawn) drawHeroFigure(ctx, h, anim.side, flash);
    if (h.root > 0 && REWORK_LOCATIONS[r.location]!.boss !== 'enat') drawWrap(ctx, h.pos, r.time);
    drawHeroEffects(ctx, r, dt);
  }

  /** On the hero: healing leaves while a herb heals, the golden shell while a shrine's shield holds, the pillar of a new level. */
  function drawHeroEffects(ctx: CanvasRenderingContext2D, r: Run, dt: number): void {
    const h = r.hero;
    const stage = (k: number, edge: number): number => (k < edge ? 0 : k > 1 - edge ? 2 : 1);
    if (h.regen) drawHeroFx(ctx, 'heal', stage(1 - h.regen.time / REWORK_PICKUPS.herbTime, 0.15), h.pos.x, h.pos.y);
    if (h.shield > 0 && h.shrine?.kind === 'shield') {
      const t = h.shrine.time;
      const s = t > REWORK_PICKUPS.shrineBuff - HERO_FX.shieldEdge ? 0 : t < HERO_FX.shieldEdge ? 2 : 1;
      drawHeroFx(ctx, 'shield', s, h.pos.x, h.pos.y, 0.85 + 0.15 * Math.sin(animTime * 4));
    }
    if (levelFx >= 0) {
      levelFx += dt;
      const [a, b, c] = HERO_FX.levelTimes as [number, number, number];
      if (levelFx >= a + b + c) levelFx = -1;
      else drawHeroFx(ctx, 'level', levelFx < a ? 0 : levelFx < a + b ? 1 : 2, h.pos.x, h.pos.y);
    }
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
      const life = f.life ?? 0.8;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.age - life * 0.6) / (life * 0.4));
      if (f.size) {
        // A note: outlined so it reads on any ground.
        ctx.font = font(f.size, 'bold');
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(f.text, f.x, f.y - f.age * 14);
      }
      drawText(ctx, f.text, f.x, f.y - f.age * (f.size ? 14 : 30), { size: f.size ?? 14, bold: true, align: 'center', color: f.color });
    }
    ctx.globalAlpha = 1;
    floaters = floaters.filter((f) => f.age < (f.life ?? 0.8));
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
    // The Berehynia's signs — the lives — under the HP.
    if (expedition) drawSigns(ctx, 30, 84, death ? death.lives : expedition.lives, 9);
    // Timer — top centre.
    const toBoss = bossIn(r);
    const warn = r.phase === 'warning';
    drawText(ctx, mmss(r.time), W / 2, 30, { size: 26, bold: true, align: 'center', color: warn ? (Math.floor(r.time * 4) % 2 ? '#ff6b5e' : '#ffb0a0') : r.phase === 'flood' && toBoss < 30 ? '#ffb27a' : THEME.text });
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
      // A ready evolution: the slot glows gold.
      if (sk.evolved || evolutionReady(r, sk)) {
        ctx.strokeStyle = sk.evolved ? '#ffd27a' : `rgba(255, 210, 122, ${0.5 + 0.5 * Math.sin(r.time * 6)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
      }
      if (sk.cooldown > 0) {
        const full = Math.max(0.5, effectiveParams(r, sk).cooldown);
        const hgt = size * Math.min(1, sk.cooldown / full);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y + size - hgt, size, hgt);
        drawText(ctx, sk.cooldown.toFixed(1), x + size / 2, y + size / 2, { size: 15, bold: true, align: 'center' });
      }
    }
    // Passives — five small slots left of the skills.
    const taken = passivesTaken(r);
    const px0 = x0 - 12 - 3 * 40;
    for (let i = 0; i < PASSIVE_SLOTS; i++) {
      const x = px0 + (i % 3) * 40;
      const y = H - size - 18 + Math.floor(i / 3) * 34;
      const id = taken[i];
      drawPanel(ctx, { x, y, w: 36, h: 30 }, id ? 'rgba(30, 34, 48, 0.9)' : 'rgba(14, 16, 24, 0.55)');
      if (!id) continue;
      drawText(ctx, REWORK_CARDS[id].name.slice(0, 4), x + 18, y + 11, { size: 9, bold: true, align: 'center' });
      drawText(ctx, String(r.cards[id]), x + 18, y + 23, { size: 10, bold: true, align: 'center', color: THEME.accent });
    }
    // A shrine's buff.
    if (h.shrine) drawText(ctx, `${h.shrine.kind === 'speed' ? 'Швидкість' : h.shrine.kind === 'magnet' ? 'Магніт' : `Щит ${Math.ceil(h.shield)}`} · ${Math.ceil(h.shrine.time)} с`, 24, 82, { size: 12, bold: true, color: '#ffe08a' });
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
    if (c.kind === 'evolve') {
      const evo = EVOLUTIONS[c.id]!;
      return { kind: 'ЕВОЛЮЦІЯ', name: evo.name, rank: `${REWORK_SKILLS[c.id].name} + ${REWORK_CARDS[evo.needs].name}`, text: evo.text, isNew: true };
    }
    if (c.kind === 'passive') {
      const d = REWORK_CARDS[c.id];
      const fresh = c.rank === 1 && run ? ` · слот ${passivesTaken(run).length + 1}/${PASSIVE_SLOTS}` : '';
      return { kind: c.rank === 1 ? 'нова пасивка' : 'пасивка', name: d.name, rank: `ранг ${c.rank} з ${d.ranks}${fresh}`, text: d.text.replace('{v}', String(d.value)), isNew: false };
    }
    const d = REWORK_SKILLS[c.id];
    if (c.rank === 1) return { kind: 'новий скіл', name: d.name, rank: `перезарядка ${skillParams(c.id, 1).cooldown} с`, text: d.text, isNew: true };
    return { kind: 'скіл', name: d.name, rank: `ранг ${c.rank} з ${d.ranks.length + 1}`, text: `${d.name}: ${d.ranks[c.rank - 2]!.text}`, isNew: false };
  }

  /** The task's line under the timer. */
  function drawTaskHud(ctx: CanvasRenderingContext2D, r: Run): void {
    const t = r.task;
    // Shown while it runs and after, until the boss comes.
    if (!t || r.phase === 'ring' || r.phase === 'won') return;
    drawPanel(ctx, { x: W / 2 - 200, y: 64, w: 400, h: 26 }, 'rgba(14, 16, 24, 0.75)', t.state === 'done' ? '#ffd27a' : undefined);
    drawText(ctx, taskLine(t), W / 2, 77, { size: 13, bold: true, align: 'center', color: t.state === 'failed' ? THEME.textMuted : '#ffd27a' });
  }

  /** What the arrows point at: each den, the lumberjack (then the way out), the spirit. */
  function pointers(r: Run): Pointer[] {
    const out: Pointer[] = [];
    const way = REWORK_LOCATIONS[r.location]!.path;
    if (r.phase === 'won' && r.path && way) out.push({ key: 'path', pos: r.path, lift: 20, label: way.label, color: '#ffe0a0' });
    if (r.phase === 'ring' || r.phase === 'won') return out;
    const t = r.task;
    if (t?.state === 'active') {
      if (t.kind === 'nests') {
        for (const e of r.enemies) if (t.dens.includes(e.id)) out.push({ key: `den${e.id}`, pos: e.pos, lift: 80, label: REWORK_TASKS.nests.pointer, color: '#ffd27a' });
      } else if (t.kind === 'webs') {
        for (const e of r.enemies) if (t.dens.includes(e.id)) out.push({ key: `den${e.id}`, pos: e.pos, lift: 60, label: REWORK_TASKS.webs.pointer, color: '#ffd27a' });
      } else if (t.following) out.push({ key: 'exit', pos: t.exit, lift: 20, label: REWORK_TASKS.rescue.pointerExit, color: '#ffd27a' });
      else out.push({ key: 'man', pos: t.man, lift: 80, label: REWORK_TASKS.rescue.pointer, color: '#ffd27a' });
    }
    for (const e of r.enemies) if (e.def === 'spirit') out.push({ key: `spirit${e.id}`, pos: e.pos, lift: 120, label: REWORK_SPIRIT.name, color: '#cfe8c4' });
    return out;
  }

  /**
   * An arrow to each thing to find, with its name: over it when it is on screen, at the screen's
   * edge pointing the way when not. A new arrow pulses big for a few seconds, then holds its size.
   */
  function drawPointers(ctx: CanvasRenderingContext2D, r: Run): void {
    const P = REWORK_POINTERS;
    for (const p of pointers(r)) {
      const first = pointerSeen.get(p.key) ?? animTime;
      pointerSeen.set(p.key, first);
      const age = animTime - first;
      const k = age < P.pulseTime ? 1 + P.pulseScale * (1 - age / P.pulseTime) * (0.7 + 0.3 * Math.sin(age * 10)) : 1;
      const gx = (p.pos.x - cam.x) * zoom;
      const foot = (p.pos.y - cam.y) * zoom;
      // On screen by its feet; the marker over it stays below the HUD on top.
      const inside = gx > 30 && gx < W - 30 && foot > 110 && foot < H - 90;
      const gy = inside ? Math.max(118, foot - p.lift * zoom) : foot - p.lift * zoom;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 2;
      if (inside) {
        // Over it, bobbing; the name above the marker.
        const y = gy - 10 + Math.sin(r.time * 5) * 4;
        ctx.save();
        ctx.translate(gx, y);
        ctx.scale(k, k);
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(-9, -4);
        ctx.lineTo(9, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        outlinedText(ctx, p.label, gx, y - 14 * k, 13 * Math.sqrt(k), p.color);
      } else {
        // At the screen's edge, pointing the way; the name on the screen's side of it.
        const hx = (r.hero.pos.x - cam.x) * zoom;
        const hy = (r.hero.pos.y - cam.y) * zoom;
        const a = Math.atan2(gy - hy, gx - hx);
        const reach = Math.min((W / 2 - 40) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 110) / Math.abs(Math.sin(a) || 1e-6));
        const ax = W / 2 + Math.cos(a) * reach;
        const ay = H / 2 + Math.sin(a) * reach;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.scale(k, k);
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, -11);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-8, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        const tx = ax - Math.cos(a) * 34 * k;
        const ty = ay - Math.sin(a) * 26 * k;
        ctx.font = font(13 * Math.sqrt(k), 'bold');
        const half = ctx.measureText(p.label).width / 2 + 8;
        outlinedText(ctx, p.label, Math.max(half, Math.min(W - half, tx)), ty, 13 * Math.sqrt(k), p.color);
      }
      ctx.restore();
    }
  }

  function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
    ctx.font = font(size, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, x, y);
    drawText(ctx, text, x, y, { size, bold: true, align: 'center', color });
  }

  /** The boss's warning and its health bar. */
  function drawBossHud(ctx: CanvasRenderingContext2D, r: Run): void {
    if (r.phase === 'warning') {
      const left = Math.max(0, Math.ceil(bossIn(r)));
      drawText(ctx, `Земля тремтить… ${left}`, W / 2, 120, { size: 24, bold: true, align: 'center', color: '#ff8a6a' });
      return;
    }
    const boss = r.enemies.find((e) => e.boss);
    if (!boss || r.phase !== 'ring') return;
    const w = 420;
    drawPanel(ctx, { x: W / 2 - w / 2 - 10, y: 64, w: w + 20, h: 40 }, 'rgba(14, 10, 10, 0.85)', '#a03a2a');
    const spinner = boss.def === 'spinner';
    const name = boss.def === 'enat' ? `${REWORK_BOSS.enat.name} · фаза ${r.bossPhase + 1} з 3` : spinner ? REWORK_BOSS.spinner.name : REWORK_BOSS.alpha.name;
    drawText(ctx, name, W / 2, 76, { size: 13, bold: true, align: 'center', color: '#ffb0a0' });
    ctx.fillStyle = '#2a1416';
    ctx.fillRect(W / 2 - w / 2, 86, w, 10);
    ctx.fillStyle = boss.act.kind === 'rest' || (boss.def === 'enat' && r.bossPhase === 2) ? '#ffd27a' : '#d0453c';
    ctx.fillRect(W / 2 - w / 2, 86, w * Math.max(0, boss.hp / boss.maxHp), 10);
    const weak = spinner ? [r.noBrood && 'без павучат', r.rescued && 'лісоруб'].filter(Boolean).join(' · ') : r.noHowl ? 'без зграї' : '';
    if (weak) drawText(ctx, weak, W / 2 + w / 2, 76, { size: 10, align: 'right', color: '#9fd08a' });
  }

  /** Under the cursor over a skill slot: its numbers, what the passives give it, its evolution. */
  function drawSkillTooltip(ctx: CanvasRenderingContext2D, r: Run): void {
    if (r.offer || r.hero.dead) return;
    const m = app.input.mouse;
    const size = 64;
    const x0 = W / 2 - (SKILL_SLOTS * (size + 8) - 8) / 2;
    const y = H - size - 18;
    if (m.y < y || m.y > y + size) return;
    const i = Math.floor((m.x - x0) / (size + 8));
    const sk = r.skills[i];
    if (!sk || m.x - x0 - i * (size + 8) > size) return;
    const d = REWORK_SKILLS[sk.id];
    const p = effectiveParams(r, sk);
    const evo = EVOLUTIONS[sk.id];
    const lines = [
      `${sk.evolved && evo ? evo.name : d.name} · ранг ${sk.rank}`,
      sk.evolved && evo ? evo.text : d.text,
      `шкода ${Math.round(p.damage)} · перезарядка ${p.cooldown.toFixed(1)} с`,
      ...passiveNotes(r, sk),
    ];
    if (evo && !sk.evolved) lines.push(`Еволюція: ${evo.name} — ранг 5 + ${REWORK_CARDS[evo.needs].name}${evolutionReady(r, sk) ? ' (готова!)' : ''}`);
    const w = 330;
    const hgt = 14 + lines.length * 17;
    const tx = Math.min(W - w - 8, Math.max(8, m.x - w / 2));
    drawPanel(ctx, { x: tx, y: y - hgt - 8, w, h: hgt }, 'rgba(14, 16, 24, 0.95)');
    lines.forEach((l, k) => drawText(ctx, l, tx + 10, y - hgt + 4 + k * 17, { size: k === 0 ? 13 : 11, bold: k === 0, color: k === 0 ? THEME.accent : l.startsWith('Еволюція') ? '#ffd27a' : THEME.text }));
  }

  function drawVictory(ctx: CanvasRenderingContext2D, r: Run): void {
    ctx.fillStyle = 'rgba(20, 16, 0, 0.55)';
    ctx.fillRect(0, 0, W, H);
    const boss = REWORK_LOCATIONS[r.location]!.boss;
    drawText(ctx, REWORK_BOSS[boss].victory, W / 2, H / 2 - 50, { size: 32, bold: true, align: 'center', color: '#ffd27a' });
    // Freed, the Old Enat speaks in his true voice.
    if (boss === 'enat') drawText(ctx, `«${REWORK_BOSS.enat.freed}»`, W / 2, H / 2 - 100, { size: 18, align: 'center', color: '#d8f0d0' });
    drawText(ctx, `${mmss(r.time)} · рівень ${r.level} · звірів убито: ${r.kills}`, W / 2, H / 2, { size: 16, align: 'center' });
    // The biome's boss: a checkpoint — her words, the signs back.
    if (checkpoint && expedition) {
      drawText(ctx, `«${checkpoint}»`, W / 2, H / 2 + 34, { size: 16, align: 'center', color: SIGN_VOICE });
      drawSigns(ctx, W / 2 - 30, H / 2 + 62, expedition.lives, 10);
    }
    victoryButtons.draw(ctx);
  }

  /** The location's name, fading in and out over the screen. */
  function drawBanner(ctx: CanvasRenderingContext2D, dt: number): void {
    const b = banner!;
    b.age += dt;
    const T = REWORK_PATH.bannerTime;
    if (b.age >= T) {
      banner = null;
      return;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.age / 0.4, (T - b.age) / 0.8);
    outlinedText(ctx, b.text, W / 2, H / 2 - 150, 34, '#f0e2b8');
    ctx.restore();
  }

  /** A death: her words from the sign, the signs left, what it costs. */
  function drawDeath(ctx: CanvasRenderingContext2D, r: Run): void {
    ctx.fillStyle = 'rgba(20, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'Загинув', W / 2, H / 2 - 110, { size: 36, bold: true, align: 'center', color: THEME.bad });
    drawText(ctx, `${mmss(r.time)} · рівень ${r.level} · звірів убито: ${r.kills}`, W / 2, H / 2 - 70, { size: 14, align: 'center', color: THEME.textDim });
    if (death) {
      drawText(ctx, `«${death.line}»`, W / 2, H / 2 - 22, { size: 20, align: 'center', color: SIGN_VOICE });
      drawSigns(ctx, W / 2 - 30, H / 2 + 14, death.lives, 10);
      const what = death.rollback
        ? 'Знаки згасли: назад до останнього чекпоінта — початку експедиції. На кладовищі — надгробок.'
        : `Лишилось знаків: ${death.lives}. Біом — з першої локації, з 1-го рівня; здобуте в цій спробі втрачено.`;
      drawText(ctx, what, W / 2, H / 2 + 50, { size: 14, align: 'center', color: THEME.text });
    }
    deathButtons.draw(ctx);
  }

  /** The Berehynia's signs in a row: lit — lives left, dim — lost. */
  function drawSigns(ctx: CanvasRenderingContext2D, x: number, y: number, lit: number, r: number): void {
    for (let i = 0; i < REWORK_LIVES.max; i++) {
      const cx = x + i * r * 3;
      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i < lit ? '#ffd27a' : 'rgba(120, 110, 90, 0.35)';
      ctx.strokeStyle = i < lit ? '#fff0c0' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.restore();
    }
  }

  /** The biome's point on the map (a stand-in for the scene): the Forest, the signs, what the last death cost. */
  function drawPoint(ctx: CanvasRenderingContext2D, exp: Expedition): void {
    drawText(ctx, 'Ліс', W / 2, H / 2 - 140, { size: 36, bold: true, align: 'center', color: '#cfe8c4' });
    drawText(ctx, 'Точка біому на карті · сцена буде тут (етап 21)', W / 2, H / 2 - 104, { size: 13, align: 'center', color: THEME.textMuted });
    drawText(ctx, `${REWORK_CLASSES[exp.classId].name} · знаки Берегині:`, W / 2 - 60, H / 2 - 50, { size: 15, align: 'right', color: THEME.text });
    drawSigns(ctx, W / 2 - 40, H / 2 - 50, exp.lives, 10);
    const lines = ['Біом — один забіг: Ліс → Глибина лісу → Лігво Ената.', 'Загинув — знак гасне, біом з початку. Знаки згасли — назад до чекпоінта.'];
    lines.forEach((l, i) => drawText(ctx, l, W / 2, H / 2 - 4 + i * 22, { size: 14, align: 'center', color: THEME.textDim }));
    if (death) drawText(ctx, `«${death.line}»`, W / 2, H / 2 + 60, { size: 16, align: 'center', color: SIGN_VOICE });
    if (exp.tombstones > 0) drawText(ctx, `Надгробків на кладовищі: ${exp.tombstones}`, W / 2, H / 2 + 150, { size: 12, align: 'center', color: THEME.textMuted });
    pointButtons.draw(ctx);
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
    drawText(ctx, 'WASD — ходити · атака сама · 1–4 — скіли (цілять у курсор) · Пробіл — ухил · E — вівтар · у виборі: 1–3, R — перекинути', W / 2, H - 30, { size: 12, align: 'center', color: THEME.textMuted });
  }
}

const clampCam = (v: number, max: number): number => Math.max(0, Math.min(Math.max(0, max), v));
