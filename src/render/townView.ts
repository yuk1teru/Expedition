// Town scene (PLAN.md 8.4): arriving rests the hero (full heal + checkpoint), then the hero
// walks around the town (WASD or click), talks to NPCs (E / click) and leaves through the
// gate to the world map. The merchant's shop opens from the conversation. The town map is
// bigger than the screen: the camera follows the hero.

import type { Screen } from '../core/screens';
import { TOWN_SCENE } from '../data/balance';
import { fillNames } from '../data/names';
import type { DialogueAction } from '../data/npcs';
import { getNpc } from '../data/npcs';
import { type TownBuilding, type TownLayout, type TownPropKind, type TownRect, getInterior, getTownLayout } from '../data/towns';
import { WAKE } from '../data/death';
import { Rng } from '../core/rng';
import { getNode } from '../systems/mapgen';
import { leaveTown, restInTown } from '../systems/run';
import { forgetDeath, wakeTalk } from '../systems/death';
import { hasNewItems } from '../systems/items';
import { npcMark, withQuests } from '../systems/quests';
import type { Grave } from '../systems/meta';
import { drawTombstone, graveTalk } from './tombstone';
import { type TownWalker, atGate, createWalker, doorAt, doorStep, npcAt, npcInReach, stepWalker } from '../systems/town';
import type { App } from './app';
import { createDialogueModal } from './dialogue';
import { heroColor } from './names';
import { drawNpc } from './npcArt';
import { THEME, font } from './theme';
import { drawTopBar } from './topBar';
import { Button, ButtonGroup, drawText, roundRect } from './ui';

/** Seconds the "rested and saved" note stays visible after arriving. */
const TOWN_REST_FLASH = 3;

export function createTownScreen(app: App): Screen<CanvasRenderingContext2D> {
  const W = app.view.width;
  const H = app.view.height;
  /** The town outside, the layout the hero is in now (the town or a room) and the door of that room. */
  let town: TownLayout = getTownLayout('capital');
  let layout: TownLayout = town;
  let door: TownBuilding | null = null;
  let walker: TownWalker = createWalker(layout);
  /** The NPC being talked to (the merchant's goods). */
  let talkingTo: string | null = null;
  let restedFlash = 0;
  let leaving = false;
  /** Camera: the town-map point at the top-left corner of the view. */
  const cam = { x: 0, y: 0 };
  const viewTop = TOWN_SCENE.viewTop;
  const viewH = H - viewTop;
  /** The hero's position before the last logic step: frames draw between it and the current one. */
  let prevPos = { ...walker.pos };
  /** Where the hero is drawn this frame (interpolated between logic steps, so the camera does not judder). */
  const drawnPos = (): { x: number; y: number } => {
    const a = app.loop.alpha;
    return { x: prevPos.x + (walker.pos.x - prevPos.x) * a, y: prevPos.y + (walker.pos.y - prevPos.y) * a };
  };
  const follow = (pos = walker.pos): void => {
    const fit = (p: number, view: number, size: number): number => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, p - view / 2)));
    cam.x = fit(pos.x, W, layout.width);
    cam.y = fit(pos.y, viewH, layout.height);
  };
  const buttons = new ButtonGroup([
    new Button({ label: 'Карта світу (M)', rect: { x: W - 176, y: 52, w: 164, h: 32 }, fontSize: 14, hotkey: 'KeyM', onClick: () => app.goMap() }),
  ]);

  const runAction = (action: DialogueAction | null): void => {
    app.screens.popModal();
    if (action === 'openShop') app.openMerchant(talkingTo ?? undefined);
    else if (action === 'openChangelog') app.showChangelog();
    else if (action === 'openInventory') app.toggleInventory();
    else if (action === 'openCoach') app.openCoach();
  };
  /** Tombstones of fallen heroes on the cemetery plots, the newest first. */
  const graves = (): { g: Grave; x: number; y: number }[] => {
    const plots = layout.graves ?? [];
    return [...app.meta.graves].reverse().slice(0, plots.length).map((g, i) => ({ g, ...plots[i]! }));
  };
  const graveInReach = (): { g: Grave; x: number; y: number } | null => {
    let best: { g: Grave; x: number; y: number } | null = null;
    let bestD = TOWN_SCENE.heroRadius + TOWN_SCENE.talkRange + 16;
    for (const t of graves()) {
      const d = Math.hypot(walker.pos.x - t.x, walker.pos.y - t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };
  const readGrave = (g: Grave): void => {
    if (app.screens.topModal) return;
    walker.target = null;
    app.screens.pushModal(createDialogueModal(app, graveTalk(g), () => app.screens.popModal()));
  };
  const talk = (npcId: string): void => {
    if (app.screens.topModal) return;
    walker.target = null;
    walker.talkTo = null;
    const npc = layout.npcs.find((n) => n.id === npcId);
    if (npc) walker.facing = Math.atan2(npc.y - walker.pos.y, npc.x - walker.pos.x);
    talkingTo = npcId;
    app.screens.pushModal(createDialogueModal(app, withQuests(getNpc(npcId), app.state), runAction));
  };
  /** Through a door into the room behind it (ROADMAP 11.6). */
  const enterRoom = (b: TownBuilding): void => {
    const room = b.interior ? getInterior(b.interior) : undefined;
    if (!room) return;
    door = b;
    layout = room;
    walker = createWalker(room);
    prevPos = { ...walker.pos };
    follow();
  };
  /** Out of the room, onto the step in front of its door. */
  const leaveRoom = (): void => {
    const b = door;
    layout = town;
    door = null;
    walker = createWalker(town);
    if (b) walker.pos = doorStep(b);
    walker.facing = Math.PI / 2;
    prevPos = { ...walker.pos };
    follow();
  };

  return {
    enter() {
      // Every arrival in town is a rest: full HP and a saved checkpoint.
      restInTown(app.state);
      restedFlash = TOWN_REST_FLASH;
      town = getTownLayout(app.state.currentNodeId);
      layout = town;
      door = null;
      walker = createWalker(layout);
      // The prologue: the hero wakes up by the sea, not at the gate.
      if (app.state.arriving && layout.arrival) walker.pos = { ...layout.arrival };
      app.state.arriving = false;
      prevPos = { ...walker.pos };
      leaving = false;
      follow();
      app.hint('town');
      // Woken up after a death: the doctor tells what happened — in the clinic, if the town has one.
      const death = app.state.lastDeath;
      if (death) {
        const clinic = town.buildings.find((b) => b.interior && getInterior(b.interior)?.npcs.some((n) => n.id === WAKE.doctorNpc));
        if (clinic) enterRoom(clinic);
        app.screens.pushModal(
          createDialogueModal(app, wakeTalk(app.state, death), () => {
            app.screens.popModal();
            forgetDeath(app.state);
          }),
        );
      }
    },
    exit() {
      leaveTown(app.state);
    },
    update(dt) {
      restedFlash = Math.max(0, restedFlash - dt);
      prevPos = { ...walker.pos };
      if (leaving) return;
      const reached = stepWalker(layout, walker, app.input.moveVector(), dt);
      if (reached) talk(reached);
      if (door) {
        // In a room the "gate" is the way back out.
        if (atGate(layout, walker.pos)) leaveRoom();
        return;
      }
      const entered = doorAt(layout, walker.pos);
      if (entered) {
        enterRoom(entered);
        return;
      }
      if (atGate(layout, walker.pos)) {
        leaving = true;
        app.goMap();
      }
    },
    onInput(e) {
      if (buttons.handle(e)) return;
      if (e.type === 'key' && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) {
        const id = npcInReach(layout, walker.pos);
        if (id) talk(id);
        else {
          const grave = graveInReach();
          if (grave) readGrave(grave.g);
        }
        return;
      }
      if (e.type === 'mousedown' && e.button === 0 && e.y > viewTop) {
        // Screen → town map.
        const x = e.x + cam.x;
        const y = e.y - viewTop + cam.y;
        const id = npcAt(layout, x, y);
        if (id && npcInReach(layout, walker.pos) === id) {
          talk(id);
          return;
        }
        walker.talkTo = id;
        walker.target = id ? npcApproach(layout, id, walker) : { x, y };
      }
    },
    render(ctx) {
      const state = app.state;
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(0, viewTop, W, viewH);
      // The town map, scrolled by the camera and clipped to the view.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, viewTop, W, viewH);
      ctx.clip();
      const hero = drawnPos();
      follow(hero);
      // Camera and hero move together (no rounding): the hero stays still on screen while the town scrolls smoothly.
      ctx.translate(-cam.x, viewTop - cam.y);
      ctx.drawImage(townBackground(layout), 0, 0);
      drawWater(ctx, layout, app.time);
      drawGate(ctx, layout, app.time);
      // Figures sorted by height: NPCs and the hero.
      const near = npcInReach(layout, walker.pos);
      const figures: { y: number; draw: () => void }[] = layout.npcs.map((n) => ({
        y: n.y,
        draw: () => {
          const npc = getNpc(n.id);
          drawNpc(ctx, npc.look, n.x, n.y, TOWN_SCENE.npcRadius, app.time);
          nameplate(ctx, n.x, n.y - TOWN_SCENE.npcRadius * 2 - 10, npc.name, npc.title, npc.id === near);
          const mark = npcMark(state, n.id);
          if (mark) questMark(ctx, n.x, n.y - TOWN_SCENE.npcRadius * 2 - 34, mark, app.time);
        },
      }));
      const nearGrave = near ? null : graveInReach();
      for (const t of graves()) figures.push({ y: t.y, draw: () => drawTombstone(ctx, t.x, t.y, 0.75, t.g.name) });
      figures.push({ y: hero.y, draw: () => drawWalker(ctx, walker, hero, heroColor(state.hero.classId, state.hero.promotion)) });
      figures.sort((a, b) => a.y - b.y);
      for (const f of figures) f.draw();
      if (near && !app.screens.topModal) {
        const npc = layout.npcs.find((n) => n.id === near)!;
        prompt(ctx, npc.x, npc.y + TOWN_SCENE.npcRadius + 16, 'E — говорити');
      } else if (nearGrave && !app.screens.topModal) prompt(ctx, nearGrave.x, nearGrave.y + 22, 'E — прочитати');
      ctx.restore();
      // Header: town name and the rest note.
      const room = door?.interior ? getInterior(door.interior) : undefined;
      const name = getNode(state.world, state.currentNodeId).name + (room ? ` · ${fillNames(room.name)}` : '');
      ctx.save();
      ctx.fillStyle = 'rgba(10, 12, 18, 0.6)';
      ctx.font = font(18, 'bold');
      roundRect(ctx, 12, 52, Math.max(260, ctx.measureText(name).width + 28), restedFlash > 0 ? 54 : 34, 8);
      ctx.fill();
      ctx.restore();
      drawText(ctx, name, 24, 69, { size: 18, bold: true });
      if (restedFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, restedFlash);
        drawText(ctx, 'HP відновлено · прогрес збережено', 24, 93, { size: 12, bold: true, color: THEME.good });
        ctx.restore();
      }
      buttons.draw(ctx);
      ctx.fillStyle = 'rgba(10, 12, 18, 0.6)';
      ctx.fillRect(0, H - 20, W, 20);
      drawText(ctx, 'WASD / клік — ходити · E / клік по NPC — говорити · двері — увійти · Tab — спорядження · J — журнал · брама або M — карта', W / 2, H - 10, {
        size: 11,
        align: 'center',
        color: THEME.textDim,
      });
      drawTopBar(ctx, state, W, app.totalBosses(), app.time);
      if (hasNewItems(state.hero)) app.hint('loot');
      if (state.talentPoints > 0 && state.hero.classId) app.hint('tree');
    },
  };
}

/** A point next to the NPC on the hero's side (the click-to-talk walk target). */
function npcApproach(layout: TownLayout, id: string, w: TownWalker): { x: number; y: number } {
  const npc = layout.npcs.find((n) => n.id === id)!;
  const dx = w.pos.x - npc.x;
  const dy = w.pos.y - npc.y;
  const d = Math.hypot(dx, dy) || 1;
  const r = TOWN_SCENE.npcRadius + TOWN_SCENE.heroRadius + 6;
  return { x: npc.x + (dx / d) * r, y: npc.y + (dy / d) * r };
}

/** NPC name and role on a dark plate above the head. */
function nameplate(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, title: string, near: boolean): void {
  ctx.font = font(12, 'bold');
  const w = Math.max(ctx.measureText(name).width, (ctx.font = font(10), ctx.measureText(title).width)) + 12;
  ctx.fillStyle = near ? 'rgba(10, 12, 18, 0.85)' : 'rgba(10, 12, 18, 0.6)';
  roundRect(ctx, x - w / 2, y - 10, w, 27, 5);
  ctx.fill();
  drawText(ctx, name, x, y - 1, { size: 12, bold: true, align: 'center', color: near ? THEME.accent : THEME.text });
  drawText(ctx, title, x, y + 11, { size: 10, align: 'center', color: THEME.textDim });
}

/** "!" — a quest to take, "?" — something to report (ROADMAP 11.2). */
function questMark(ctx: CanvasRenderingContext2D, x: number, y: number, mark: '!' | '?', t: number): void {
  const bob = Math.sin(t * 3) * 2;
  ctx.fillStyle = mark === '!' ? '#f2c14e' : '#7fd3ff';
  ctx.strokeStyle = '#1b1e27';
  ctx.lineWidth = 3;
  ctx.font = font(22, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(mark, x, y + bob);
  ctx.fillText(mark, x, y + bob);
}

function prompt(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.font = font(12, 'bold');
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(10, 12, 18, 0.8)';
  roundRect(ctx, x - w / 2, y - 10, w, 20, 6);
  ctx.fill();
  drawText(ctx, text, x, y, { size: 12, bold: true, align: 'center', color: THEME.accent });
}

function drawWalker(ctx: CanvasRenderingContext2D, w: TownWalker, pos: { x: number; y: number }, outline: string | null): void {
  const r = TOWN_SCENE.heroRadius;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(w.facing);
  ctx.fillStyle = THEME.accent;
  ctx.beginPath();
  ctx.moveTo(r + 8, 0);
  ctx.lineTo(r - 2, 6);
  ctx.lineTo(r - 2, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.strokeStyle = outline ?? '#1b1e27';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---- The scene ----

const backgrounds = new Map<string, HTMLCanvasElement>();

/** Ground, paths, buildings and props of a town, painted once. */
function townBackground(layout: TownLayout): HTMLCanvasElement {
  const cached = backgrounds.get(layout.id);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = layout.width;
  c.height = layout.height;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(layout.id.length * 977 + layout.id.charCodeAt(0));
  ctx.fillStyle = layout.ground;
  ctx.fillRect(0, 0, c.width, c.height);
  if (layout.style === 'interior') {
    paintRoom(ctx, layout);
    backgrounds.set(layout.id, c);
    return c;
  }
  // Ground speckles.
  const speckles = Math.round((c.width * c.height) / 1000);
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(rng.float(0, c.width), rng.float(0, c.height), rng.float(2, 5), rng.float(2, 4));
  }
  ctx.fillStyle = layout.pathColor;
  for (const p of layout.paths) {
    roundRect(ctx, p.x, p.y, p.w, p.h, 10);
    ctx.fill();
  }
  // Bent streets (ROADMAP 11.7).
  ctx.strokeStyle = layout.pathColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of layout.streets ?? []) {
    ctx.lineWidth = st.width;
    ctx.beginPath();
    st.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }
  // Cobbles / sand ripples on the paths and streets.
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (const p of layout.paths) {
    const n = Math.round((p.w * p.h) / 900);
    for (let i = 0; i < n; i++) ctx.fillRect(rng.float(p.x + 4, p.x + p.w - 8), rng.float(p.y + 4, p.y + p.h - 6), 5, 3);
  }
  for (const st of layout.streets ?? []) {
    for (let k = 1; k < st.points.length; k++) {
      const [x0, y0] = st.points[k - 1]!;
      const [x1, y1] = st.points[k]!;
      const n = Math.round((Math.hypot(x1 - x0, y1 - y0) * st.width) / 900);
      for (let i = 0; i < n; i++) {
        const f = rng.next();
        const side = rng.float(-st.width / 2 + 5, st.width / 2 - 5);
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len;
        const ny = (x1 - x0) / len;
        ctx.fillRect(x0 + (x1 - x0) * f + nx * side, y0 + (y1 - y0) * f + ny * side, 5, 3);
      }
    }
  }
  ctx.fillStyle = layout.waterColor;
  for (const w of layout.water) {
    roundRect(ctx, w.x, w.y, w.w, w.h, 12);
    ctx.fill();
  }
  for (const b of layout.bridges ?? []) drawBridge(ctx, b);
  for (const b of layout.buildings) drawBuilding(ctx, b, layout);
  for (const p of layout.props) drawProp(ctx, p.kind, p.x, p.y, layout);
  backgrounds.set(layout.id, c);
  return c;
}

/** A room: floor planks, rugs, walls and furniture (ROADMAP 11.6). */
function paintRoom(ctx: CanvasRenderingContext2D, layout: TownLayout): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < layout.height; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
    for (let x = ((y / 22) % 2) * 60; x < layout.width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 22);
      ctx.stroke();
    }
  }
  for (const r of layout.paths) {
    ctx.fillStyle = layout.pathColor;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 2;
    roundRect(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 4);
    ctx.stroke();
  }
  for (const b of layout.buildings) drawBuilding(ctx, b, layout);
  for (const p of layout.props) drawProp(ctx, p.kind, p.x, p.y, layout);
}

/** Planks over a gap in the water, with rails on both sides. */
function drawBridge(ctx: CanvasRenderingContext2D, b: TownRect): void {
  const along = b.h > b.w;
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  const step = 10;
  if (along) for (let y = b.y + step; y < b.y + b.h; y += step) (ctx.beginPath(), ctx.moveTo(b.x, y), ctx.lineTo(b.x + b.w, y), ctx.stroke());
  else for (let x = b.x + step; x < b.x + b.w; x += step) (ctx.beginPath(), ctx.moveTo(x, b.y), ctx.lineTo(x, b.y + b.h), ctx.stroke());
  ctx.fillStyle = '#4a3622';
  if (along) {
    ctx.fillRect(b.x - 3, b.y, 5, b.h);
    ctx.fillRect(b.x + b.w - 2, b.y, 5, b.h);
  } else {
    ctx.fillRect(b.x, b.y - 3, b.w, 5);
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, 5);
  }
}

/** A stone town wall or tower (outside) / a room's wall (inside). */
function drawWall(ctx: CanvasRenderingContext2D, b: TownBuilding, inside: boolean): void {
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  // Stone courses (outside) or log seams (inside).
  const step = inside ? 10 : 12;
  for (let y = b.y + step; y < b.y + b.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    ctx.lineTo(b.x + b.w, y);
    ctx.stroke();
  }
  ctx.fillStyle = b.roof;
  if (!inside && b.w > b.h) for (let x = b.x; x < b.x + b.w; x += 24) ctx.fillRect(x, b.y, 12, 6);
  if (!inside && b.h >= b.w) for (let y = b.y; y < b.y + b.h; y += 24) ctx.fillRect(b.x, y, 6, 12);
}

/** Furniture seen from above: a box with a lighter top and maybe a small sign. */
function drawFurniture(ctx: CanvasRenderingContext2D, b: TownBuilding): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
  ctx.fillStyle = b.wall;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  ctx.fillStyle = b.roof;
  roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, Math.max(4, b.h * 0.45), 3);
  ctx.fill();
  if (b.label) {
    const label = fillNames(b.label);
    drawText(ctx, label, b.x + b.w / 2, b.y + b.h + 9, { size: 10, bold: true, align: 'center', color: '#f4e4c0' });
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: TownBuilding, layout: TownLayout): void {
  if (b.kind === 'wall') return drawWall(ctx, b, layout.style === 'interior');
  if (b.kind === 'furniture') return drawFurniture(ctx, b);
  const roofH = b.h * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y + roofH * 0.6, b.w, b.h - roofH * 0.6);
  // Roof (domes in the desert, flat snow caps in the ice town, gables elsewhere).
  ctx.fillStyle = b.roof;
  ctx.beginPath();
  if (layout.style === 'desert') {
    ctx.ellipse(b.x + b.w / 2, b.y + roofH, b.w * 0.32, roofH * 0.9, 0, Math.PI, Math.PI * 2);
  } else {
    ctx.moveTo(b.x - 8, b.y + roofH);
    ctx.lineTo(b.x + b.w * 0.2, b.y);
    ctx.lineTo(b.x + b.w * 0.8, b.y);
    ctx.lineTo(b.x + b.w + 8, b.y + roofH);
    ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Door and windows; a door that can be entered has a doormat and a light over it.
  ctx.fillStyle = '#3a2618';
  ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h - 28, 20, 28);
  if (b.interior) {
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h, 28, 6);
    ctx.fillStyle = 'rgba(255, 220, 140, 0.9)';
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h - 34, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(242, 193, 78, 0.75)';
  ctx.fillRect(b.x + 16, b.y + b.h - 34, 16, 14);
  ctx.fillRect(b.x + b.w - 32, b.y + b.h - 34, 16, 14);
  if (b.label) {
    const label = fillNames(b.label);
    ctx.font = font(12, 'bold');
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = '#4a3622';
    roundRect(ctx, b.x + b.w / 2 - w / 2, b.y + roofH - 4, w, 18, 4);
    ctx.fill();
    drawText(ctx, label, b.x + b.w / 2, b.y + roofH + 5, { size: 12, bold: true, align: 'center', color: '#f4e4c0' });
  }
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, crown: string, snow: boolean, pine: boolean): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(x - 3, y - 10, 6, 14);
  ctx.fillStyle = crown;
  if (pine) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y - 46 + k * 12);
      ctx.lineTo(x + 16 - k * 2, y - 14 + k * 4);
      ctx.lineTo(x - 16 + k * 2, y - 14 + k * 4);
      ctx.closePath();
      ctx.fill();
    }
    if (snow) {
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 46);
      ctx.lineTo(x + 6, y - 36);
      ctx.lineTo(x - 6, y - 36);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(x, y - 22, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(x - 6, y - 28, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProp(ctx: CanvasRenderingContext2D, kind: TownPropKind, x: number, y: number, layout: TownLayout): void {
  switch (kind) {
    case 'tree':
      tree(ctx, x, y, '#3f6a2f', false, false);
      break;
    case 'pine':
      tree(ctx, x, y, '#1f4a2a', false, true);
      break;
    case 'snowPine':
      tree(ctx, x, y, '#2a4a3a', true, true);
      break;
    case 'palm': {
      ctx.strokeStyle = '#7a5a32';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 20, x + 2, y - 40);
      ctx.stroke();
      ctx.strokeStyle = '#3f8a3a';
      ctx.lineWidth = 4;
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + (k / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 40);
        ctx.quadraticCurveTo(x + 2 + Math.cos(a) * 14, y - 50, x + 2 + Math.cos(a) * 22, y - 34 + Math.abs(Math.sin(a)) * 4);
        ctx.stroke();
      }
      break;
    }
    case 'reed':
      ctx.strokeStyle = '#7a8a4a';
      ctx.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 4, y);
        ctx.lineTo(x + k * 5, y - 20 - Math.abs(k) * -2);
        ctx.stroke();
      }
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(x - 6, y - 24, 3, 8);
      ctx.fillRect(x + 4, y - 22, 3, 8);
      break;
    case 'cactus':
      ctx.fillStyle = '#4a8a4a';
      roundRect(ctx, x - 5, y - 32, 10, 32, 5);
      ctx.fill();
      roundRect(ctx, x - 15, y - 22, 8, 14, 4);
      ctx.fill();
      roundRect(ctx, x + 7, y - 26, 8, 12, 4);
      ctx.fill();
      break;
    case 'rock':
      ctx.fillStyle = layout.style === 'ice' ? '#8a9aaa' : '#7a6a5a';
      ctx.beginPath();
      ctx.ellipse(x, y, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 4, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'well':
      ctx.fillStyle = '#7a7a80';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a4a6a';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 16, y - 24, 4, 24);
      ctx.fillRect(x + 12, y - 24, 4, 24);
      ctx.fillRect(x - 18, y - 28, 36, 5);
      break;
    case 'fountain':
      ctx.fillStyle = '#9a9aa4';
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a8ac0';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8b8c0';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'barrel':
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case 'crate':
      ctx.fillStyle = '#9a7a4a';
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeStyle = '#5a4022';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 9, y - 9, 18, 18);
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 9);
      ctx.lineTo(x + 9, y + 9);
      ctx.stroke();
      break;
    case 'lamp':
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(x - 2, y - 30, 4, 30);
      ctx.fillStyle = 'rgba(242, 193, 78, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y - 32, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(242, 193, 78, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y - 32, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'boat':
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 6);
      ctx.lineTo(x + 30, y - 6);
      ctx.lineTo(x + 20, y + 8);
      ctx.lineTo(x - 20, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8e0cc';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y - 40);
      ctx.lineTo(x + 18, y - 10);
      ctx.closePath();
      ctx.fill();
      break;
    case 'tent':
      ctx.fillStyle = '#b84a3a';
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 14);
      ctx.lineTo(x, y - 24);
      ctx.lineTo(x + 30, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8d0a0';
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 14);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 8, y + 14);
      ctx.closePath();
      ctx.fill();
      break;
    case 'grave':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 11, y + 4, 24, 6);
      ctx.fillStyle = '#8a8f99';
      roundRect(ctx, x - 10, y - 22, 20, 26, 8);
      ctx.fill();
      ctx.strokeStyle = '#5a5f66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x, y - 4);
      ctx.moveTo(x - 5, y - 11);
      ctx.lineTo(x + 5, y - 11);
      ctx.stroke();
      break;
    case 'dummy':
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 2, y - 30, 4, 34);
      ctx.fillRect(x - 14, y - 22, 28, 4);
      ctx.fillStyle = '#c9a36b';
      ctx.beginPath();
      ctx.ellipse(x, y - 16, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 34, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'target':
      for (const [r, c] of [[14, '#e8e4dc'], [10, '#c0392b'], [6, '#e8e4dc'], [3, '#c0392b']] as [number, string][]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y - 14, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 2, y, 4, 6);
      break;
    case 'bench':
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x - 20, y + 2, 42, 6);
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(x - 22, y - 6, 44, 8);
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(x - 20, y + 2, 4, 6);
      ctx.fillRect(x + 16, y + 2, 4, 6);
      break;
    case 'chair':
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x - 8, y - 12, 16, 5);
      break;
    case 'candle': {
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(x - 3, y - 10, 6, 12);
      const g = ctx.createRadialGradient(x, y - 14, 1, x, y - 14, 14);
      g.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
      g.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 14, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cat':
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 9, y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 9);
      ctx.lineTo(x + 8, y - 14);
      ctx.lineTo(x + 10, y - 9);
      ctx.moveTo(x + 10, y - 9);
      ctx.lineTo(x + 13, y - 13);
      ctx.lineTo(x + 13, y - 7);
      ctx.fill();
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.quadraticCurveTo(x - 18, y - 2, x - 16, y - 10);
      ctx.stroke();
      break;
    case 'stall':
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(x - 22, y - 6, 44, 14);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#c0392b' : '#f4e4c0';
        ctx.fillRect(x - 24 + k * 12, y - 22, 12, 10);
      }
      ctx.fillStyle = '#e8b04a';
      ctx.beginPath();
      ctx.arc(x - 8, y - 8, 4, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

/** Ripples over the water (animated). */
function drawWater(ctx: CanvasRenderingContext2D, layout: TownLayout, t: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (const w of layout.water) {
    const n = Math.max(2, Math.round((w.w * w.h) / 5000));
    for (let i = 0; i < n; i++) {
      const fx = ((i * 0.618 + t * 0.03) % 1) * (w.w - 30) + w.x + 15;
      const fy = ((i * 0.381) % 1) * (w.h - 16) + w.y + 8;
      ctx.beginPath();
      ctx.arc(fx, fy + Math.sin(t * 2 + i) * 2, 8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
}

function drawGate(ctx: CanvasRenderingContext2D, layout: TownLayout, t: number): void {
  const g = layout.gate;
  const pulse = 0.35 + 0.2 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(242, 193, 78, ${pulse})`;
  ctx.fillRect(g.x, g.y, g.w, g.h);
  // Top / bottom gates: the sign to the right; side gates: above, towards the town.
  if (layout.style === 'interior') {
    drawText(ctx, 'Вихід', g.x + g.w / 2, g.y - 10, { size: 12, bold: true, align: 'center', color: '#fff4d0' });
    return;
  }
  const label = 'Брама → карта світу';
  if (g.w > g.h) drawText(ctx, label, g.x + g.w + 8, Math.min(g.y + g.h / 2, layout.height - 32), { size: 12, bold: true, color: '#fff4d0' });
  else if (g.x < 100) drawText(ctx, label, g.x + 4, g.y - 12, { size: 12, bold: true, color: '#fff4d0' });
  else drawText(ctx, label, g.x + g.w - 4, g.y - 12, { size: 12, bold: true, align: 'right', color: '#fff4d0' });
}
