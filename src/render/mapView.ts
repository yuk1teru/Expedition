// World map screen: the painted map (sea, regions, mountains), roads, towns and
// locations, the hero's position, tooltips, travel by click. The map zooms with the
// mouse wheel (25%…160%, around the cursor) and pans by dragging — always.

import type { GameState } from '../core/state';
import type { InputEvent } from '../core/input';
import type { Screen } from '../core/screens';
import { PROGRESSION, WORLD } from '../data/balance';
import { getBiome } from '../data/biomes';
import { getBoss } from '../data/bosses';
import { getEnemyDef } from '../data/enemies';
import { WEATHER } from '../data/weather';
import { WORLD_MAP } from '../data/world';
import { type MapNode, effectiveLevel, findRoute, getNode } from '../systems/mapgen';
import { canTravel } from '../systems/run';
import { invasionMultiplier, invasionPct, newInvasionThresholds, xpPenalized } from '../systems/scaling';
import { INVASION } from '../data/invasion';
import { createNoticeModal } from './notice';
import { visibleNodes } from '../systems/fog';
import { questTargets } from '../systems/quests';
import type { App } from './app';
import { THEME, font } from './theme';
import { TOP_BAR_H, drawTopBar } from './topBar';
import { Button, ButtonGroup, type Rect, drawText, drawTooltip, roundRect } from './ui';
import { worldTerrain } from './worldTerrain';

const NODE_R = 15;
const BOSS_R = 20;
const TOWN_R = 20;

function nodeRadius(n: MapNode): number {
  return n.isTown ? TOWN_R : n.isBoss ? BOSS_R : NODE_R;
}

/** Map camera: screen = world × scale + offset. */
const ZOOM = {
  min: 0.25,
  max: 1.6,
  step: 1.15,
  /** Scale when the map opens (around the hero). */
  start: 0.6,
  /** From this zoom on every location is named. */
  allNames: 0.75,
  /** Mouse travel that turns a click into a drag, px. */
  drag: 5,
};

interface Camera {
  scale: number;
  x: number;
  y: number;
}

export function createMapScreen(app: App): Screen<CanvasRenderingContext2D> {
  let hovered: string | null = null;
  const W = app.view.width;
  const H = app.view.height;
  const cam: Camera = { scale: ZOOM.start, x: 0, y: 0 };
  let drag: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;

  const buttons = new ButtonGroup([
    new Button({ label: '← До міста [Esc]', rect: { x: 16, y: H - 52, w: 190, h: 36 }, hotkey: 'Escape', fontSize: 14, onClick: () => app.returnToTown() }),
    new Button({ label: '+', rect: { x: W - 86, y: TOP_BAR_H + 12, w: 70, h: 30 }, hotkey: 'Equal', fontSize: 18, onClick: () => zoomAt(W / 2, H / 2, ZOOM.step) }),
    new Button({ label: '−', rect: { x: W - 86, y: TOP_BAR_H + 48, w: 70, h: 30 }, hotkey: 'Minus', fontSize: 18, onClick: () => zoomAt(W / 2, H / 2, 1 / ZOOM.step) }),
    new Button({ label: 'Герой', rect: { x: W - 86, y: TOP_BAR_H + 84, w: 70, h: 30 }, hotkey: 'KeyC', fontSize: 13, onClick: () => focusHero() }),
  ]);

  // On the way (autopath): go on or stop.
  const routeButtons = new ButtonGroup([
    new Button({ label: 'Далі в дорогу [Enter]', rect: { x: W / 2 - 200, y: H - 96, w: 230, h: 38 }, hotkey: 'Enter', fontSize: 14, onClick: () => app.continueRoute() }),
    new Button({ label: 'Зупинитися [Backspace]', rect: { x: W / 2 + 40, y: H - 96, w: 190, h: 38 }, hotkey: 'Backspace', fontSize: 13, onClick: () => app.stopRoute() }),
  ]);

  const worldSize = (): { w: number; h: number } => ({ w: WORLD_MAP.width, h: WORLD_MAP.height });
  const toScreen = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x * cam.scale + cam.x, y: p.y * cam.scale + cam.y });
  const toWorld = (x: number, y: number): { x: number; y: number } => ({ x: (x - cam.x) / cam.scale, y: (y - cam.y) / cam.scale });
  const midY = TOP_BAR_H + (H - TOP_BAR_H) / 2;

  /** The world's centre stays inside the view: the map can be pushed aside, never lost. */
  function clampCamera(): void {
    const { w, h } = worldSize();
    cam.x = Math.min(W / 2, Math.max(W / 2 - w * cam.scale, cam.x));
    cam.y = Math.min(midY, Math.max(midY - h * cam.scale, cam.y));
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const p = toWorld(sx, sy);
    cam.scale = Math.max(ZOOM.min, Math.min(ZOOM.max, cam.scale * factor));
    cam.x = sx - p.x * cam.scale;
    cam.y = sy - p.y * cam.scale;
    clampCamera();
  }

  function focusHero(): void {
    const here = app.state.world.nodes.find((n) => n.id === app.state.currentNodeId);
    const p = here?.pos ?? { x: WORLD_MAP.width / 2, y: WORLD_MAP.height / 2 };
    cam.x = W / 2 - p.x * cam.scale;
    cam.y = midY - p.y * cam.scale;
    clampCamera();
  }

  function nodeAt(sx: number, sy: number): MapNode | null {
    if (sy < TOP_BAR_H) return null;
    const seen = visibleNodes(app.state);
    for (const n of app.state.world.nodes) {
      if (!seen.has(n.id)) continue;
      const p = toScreen(n.pos);
      if (Math.hypot(p.x - sx, p.y - sy) <= nodeRadius(n) * nodeScale(cam.scale) + 6) return n;
    }
    return null;
  }

  return {
    enter() {
      cam.scale = ZOOM.start;
      focusHero();
      app.hint('map');
      if (app.state.talentPoints > 0 && app.state.hero.classId) app.hint('tree');
      // New invasion thresholds are announced when the hero looks at the map.
      for (const t of newInvasionThresholds(app.state)) app.screens.pushModal(createNoticeModal(app, t.title, t.text, () => app.screens.popModal()));
    },

    update() {},

    onInput(e: InputEvent) {
      if (app.route.length > 0 && routeButtons.handle(e)) return;
      if (buttons.handle(e)) return;
      if (e.type === 'wheel') {
        zoomAt(e.x, e.y, e.delta < 0 ? ZOOM.step : 1 / ZOOM.step);
        hovered = nodeAt(e.x, e.y)?.id ?? null;
      } else if (e.type === 'mousemove') {
        if (drag) {
          if (Math.hypot(e.x - drag.x, e.y - drag.y) > ZOOM.drag) drag.moved = true;
          if (drag.moved) {
            cam.x = drag.camX + (e.x - drag.x);
            cam.y = drag.camY + (e.y - drag.y);
            clampCamera();
          }
        }
        hovered = drag?.moved ? null : (nodeAt(e.x, e.y)?.id ?? null);
      } else if (e.type === 'mousedown' && e.button === 0) {
        drag = { x: e.x, y: e.y, camX: cam.x, camY: cam.y, moved: false };
      } else if (e.type === 'mouseup' && drag) {
        // A click (no drag) travels; a drag only moves the map.
        const wasDrag = drag.moved;
        drag = null;
        if (wasDrag) return;
        const n = nodeAt(e.x, e.y);
        if (n && app.canReach(n.id)) app.travelTo(n.id);
      }
    },

    render(ctx) {
      const state = app.state;
      const { world } = state;
      const levelOf = (n: MapNode): number => effectiveLevel(n, state.bossesDefeated.length);
      const t = app.time;
      ctx.fillStyle = '#0d1016';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, TOP_BAR_H, W, H - TOP_BAR_H);
      ctx.clip();

      // Terrain and roads in world space.
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);
      ctx.drawImage(worldTerrain(), 0, 0);
      const seen = visibleNodes(state);
      for (const [a, b] of world.edges) {
        const na = world.nodes.find((n) => n.id === a);
        const nb = world.nodes.find((n) => n.id === b);
        if (!na || !nb || !seen.has(a) || !seen.has(b)) continue;
        drawRoad(ctx, na.pos, nb.pos, a === state.currentNodeId || b === state.currentNodeId, cam.scale);
      }
      if (!state.noFog) ctx.drawImage(fogLayer(world.nodes.filter((n) => seen.has(n.id)).map((n) => n.pos)), 0, 0, WORLD_MAP.width, WORLD_MAP.height);
      ctx.restore();

      // Nodes and labels in screen space (constant size, readable at any zoom).
      const ns = nodeScale(cam.scale);
      for (const n of world.nodes) {
        if (!seen.has(n.id)) continue;
        const p = toScreen(n.pos);
        drawNode(ctx, n, p.x, p.y, nodeRadius(n) * ns, canTravel(state, n.id), hovered === n.id, t);
        if (n.id === state.currentNodeId) {
          const r = nodeRadius(n) * ns;
          const pulse = 1 + 0.08 * Math.sin(t * 4);
          ctx.strokeStyle = THEME.accent;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (r + 8) * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#f4f1e8';
          ctx.beginPath();
          ctx.arc(p.x + r * 0.9, p.y - r * 0.9, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1b1e27';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      // Quest hints: where the active quests lead (ROADMAP 11.2).
      for (const id of questTargets(state)) {
        const n = world.nodes.find((x) => x.id === id);
        if (!n || !seen.has(id)) continue;
        const p = toScreen(n.pos);
        const y = p.y - nodeRadius(n) * ns - 14 + Math.sin(t * 3) * 2;
        ctx.font = font(20, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1b1e27';
        ctx.strokeText('!', p.x, y);
        ctx.fillStyle = THEME.accent;
        ctx.fillText('!', p.x, y);
      }
      const priority = (n: MapNode): number =>
        n.id === hovered ? 0 : n.id === state.currentNodeId ? 1 : n.isTown || n.isBoss ? 2 : canTravel(state, n.id) ? 3 : 4;
      const taken: Rect[] = [];
      for (const n of [...world.nodes].filter((x) => seen.has(x.id)).sort((a, b) => priority(a) - priority(b))) {
        const p = toScreen(n.pos);
        const named = priority(n) < 4 || cam.scale >= ZOOM.allNames;
        const level = n.isTown ? null : levelOf(n);
        const lvl = level === null ? null : { text: `рів. ${level}`, color: levelColor(state.hero.level, level) };
        drawNodeLabel(ctx, n, p.x, p.y + nodeRadius(n) * ns, named, canTravel(state, n.id), lvl, taken);
      }
      ctx.restore();

      drawTopBar(ctx, state, W, app.totalBosses(), app.time);
      drawInvasion(ctx, state.day, state.bossesDefeated.length, !!state.noInvasion);
      buttons.draw(ctx);
      if (app.route.length > 0) {
        const goal = world.nodes.find((x) => x.id === app.route[app.route.length - 1]);
        const crossings = app.route.slice(0, -1).filter((id) => !world.nodes.find((x) => x.id === id)?.isTown).length;
        const text = `У дорозі до «${goal?.name ?? ''}»: ще ${crossings} ${crossings === 1 ? 'перехід' : crossings < 5 ? 'переходи' : 'переходів'} по 1 хвилі`;
        ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
        ctx.fillRect(W / 2 - 260, H - 138, 520, 92);
        drawText(ctx, text, W / 2, H - 120, { size: 14, bold: true, align: 'center', color: THEME.accent });
        routeButtons.draw(ctx);
      }
      const hint = 'Клік по локації — вирушити (далеко — автошляхом через пройдені) · коліщатко, +/− — зум · тягніть — рух карти · C — до героя';
      ctx.font = font(12);
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(10, 12, 18, 0.8)';
      ctx.fillRect(W - hw - 22, H - 26, hw + 22, 26);
      drawText(ctx, hint, W - 12, H - 13, { size: 12, align: 'right', color: THEME.textDim });
      drawText(ctx, `${Math.round(cam.scale * 100)}%`, W - 51, TOP_BAR_H + 128, { size: 11, align: 'center', color: THEME.textDim });

      if (hovered) {
        const n = world.nodes.find((x) => x.id === hovered);
        if (n) drawTooltip(ctx, tooltipLines(n, state.currentNodeId, state.hero.level, levelOf(n), regionLevels(world.nodes, n.region, levelOf), routeHint(state, n.id)), app.input.mouse.x, app.input.mouse.y, W, H);
      }
    },
  };
}

/** Fog over the unknown: dark everywhere except soft clearings around the places the hero knows. */
const FOG_SCALE = 0.25;
let fogCache: { key: string; canvas: HTMLCanvasElement } | null = null;
function fogLayer(points: { x: number; y: number }[]): HTMLCanvasElement {
  const key = points.map((p) => `${p.x},${p.y}`).join(';');
  if (fogCache?.key === key) return fogCache.canvas;
  const c = fogCache?.canvas ?? document.createElement('canvas');
  c.width = Math.ceil(WORLD_MAP.width * FOG_SCALE);
  c.height = Math.ceil(WORLD_MAP.height * FOG_SCALE);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.82)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-out';
  const r = 220 * FOG_SCALE;
  for (const p of points) {
    const g = ctx.createRadialGradient(p.x * FOG_SCALE, p.y * FOG_SCALE, r * 0.35, p.x * FOG_SCALE, p.y * FOG_SCALE, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x * FOG_SCALE, p.y * FOG_SCALE, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  fogCache = { key, canvas: c };
  return c;
}

/** Nodes keep a readable size: they shrink a little when zoomed out, never below 70%. */
function nodeScale(scale: number): number {
  return Math.max(0.7, Math.min(1.25, 0.6 + scale * 0.6));
}

/** A dirt road with a slight bend; the roads from the hero's node are bright. */
function drawRoad(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, active: boolean, scale: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // The bend depends on the road itself, so it is stable between frames.
  const bend = (Math.sin(a.x * 0.013 + b.y * 0.017) * 0.5 * len) / 6;
  const cx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * bend;
  const cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bend;
  const px = 1 / scale;
  ctx.lineCap = 'round';
  for (const [color, width, dash] of [
    ['rgba(20, 16, 10, 0.55)', active ? 8 : 6, false],
    [active ? 'rgba(242, 193, 78, 0.9)' : 'rgba(200, 180, 140, 0.55)', active ? 4 : 2.5, !active],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * px;
    ctx.setLineDash(dash ? [8 * px, 6 * px] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** Name and recommended level under a node; a name that would overlap one already drawn is skipped. */
function drawNodeLabel(
  ctx: CanvasRenderingContext2D,
  n: MapNode,
  x: number,
  bottom: number,
  named: boolean,
  bright: boolean,
  level: { text: string; color: string } | null,
  taken: Rect[],
): void {
  const size = n.isTown ? 13 : 12;
  ctx.font = font(size, 'bold');
  const w = ctx.measureText(n.name).width;
  const nameY = bottom + 11;
  const rect = { x: x - w / 2, y: nameY - 7, w, h: 14 };
  const free = !taken.some((o) => rect.x < o.x + o.w && o.x < rect.x + rect.w && rect.y < o.y + o.h && o.y < rect.y + rect.h);
  const showName = named && free;
  if (showName) {
    taken.push(rect);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.55)';
    ctx.fillRect(rect.x - 3, rect.y - 1, rect.w + 6, rect.h + 2);
    drawText(ctx, n.name, x, nameY, { size, bold: true, align: 'center', color: n.isTown ? '#f2e2b8' : bright ? THEME.text : THEME.textDim });
  }
  if (level) drawText(ctx, level.text, x, bottom + (showName ? 25 : 10), { size: 11, align: 'center', color: level.color });
}

/** The invasion scale under the top bar: day, percent with a bar, the enemies' bonus (ROADMAP 10.3). */
function drawInvasion(ctx: CanvasRenderingContext2D, day: number, bosses: number, off: boolean): void {
  const pct = invasionPct(day);
  const bonus = Math.round((invasionMultiplier(day) - 1) * 100);
  const x = 12;
  const y = TOP_BAR_H + 8;
  const w = 300;
  ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
  roundRect(ctx, x, y, w, bosses > 0 ? 62 : 46, 8);
  ctx.fill();
  drawText(ctx, `День ${day} · Навала ${Math.floor(pct)}%`, x + 12, y + 13, { size: 13, bold: true, color: pct >= 75 ? THEME.bad : THEME.text });
  drawText(ctx, off ? 'вимкнено (дебаг)' : `вороги +${bonus}%`, x + w - 12, y + 13, { size: 12, align: 'right', color: THEME.textDim });
  // The bar with the threshold marks.
  const bx = x + 12;
  const by = y + 26;
  const bw = w - 24;
  ctx.fillStyle = '#2a1a1e';
  ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = THEME.bad;
  ctx.fillRect(bx, by, (bw * pct) / 100, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const t of INVASION.thresholds) if (t.at < 100) ctx.fillRect(bx + (bw * t.at) / 100 - 1, by - 2, 2, 12);
  if (bosses > 0) drawText(ctx, `Боси: локації +${bosses * WORLD.bossThreat.locationLevels} рівнів`, x + 12, y + 50, { size: 12, color: THEME.textDim });
}

/** Monster levels of a region: "7–9" (one number when all are equal). */
function regionLevels(nodes: MapNode[], region: string, levelOf: (n: MapNode) => number): string {
  const lv = nodes.filter((x) => x.region === region && !x.isTown).map(levelOf);
  if (lv.length === 0) return '';
  const lo = Math.min(...lv);
  const hi = Math.max(...lv);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** Tooltip line about the way to a node that is not a neighbour (autopath). */
function routeHint(state: GameState, id: string): string | null {
  if (canTravel(state, id)) return null;
  const way = findRoute(state.world, state.currentNodeId, id);
  if (!way) return 'Шляху немає: спершу пройдіть локації ближче';
  const crossings = way.slice(0, -1).filter((x) => !getNode(state.world, x).isTown).length;
  return crossings > 0 ? `Автошлях: ${crossings} × по 1 хвилі в пройдених локаціях` : 'Автошлях через місто';
}

function tooltipLines(n: MapNode, current: string, heroLevel: number, level: number, region: string, route: string | null): string[] {
  if (n.isTown) return [n.name, n.description, 'Місто: відпочинок і збереження, торговець і жителі', ...(route ? [route] : []), 'Клік — увійти в місто'];
  const lines = [
    n.name,
    n.description,
    `Рівень ${level}${n.isBoss ? ' (бос)' : ''}${level > n.level ? ` (загроза босів +${level - n.level})` : ''}`,
    `Регіон: ${getBiome(n.biome).name} · рівні ${region}`,
  ];
  if (n.isBoss) lines.push(`Бос: ${getBoss(n.boss).name}`);
  else {
    const names = [...new Set(n.enemies)].map((id) => getEnemyDef(id).name);
    lines.push(`Вороги: ${names.join(', ')}`);
    if (n.miniboss) lines.push(`Мінібос (кожна 3-тя хвиля): ${getBoss(n.miniboss).name}`);
    const m = n.mechanics;
    const parts: string[] = [];
    if (m.trapsFrom !== null) parts.push(`капкани з ${m.trapsFrom}-ї хвилі`);
    if (m.events.includes('weather')) parts.push(`погода: ${m.weathers.map((w) => WEATHER[w].name.toLowerCase()).join(' / ')}`);
    if (m.events.includes('elemental')) parts.push('Дух бурі');
    if (m.herbs) parts.push('трава');
    if (parts.length > 0) lines.push(`Механіки: ${parts.join(', ')}`);
  }
  if (xpPenalized(level, heroLevel)) lines.push(`Досвід: ${Math.round(PROGRESSION.xpPenalty.mult * 100)}% (ви набагато сильніші)`);
  lines.push(`Пройдено разів: ${n.timesCleared}`);
  if (n.lastWave > 0) lines.push(`Минулого разу: ${n.lastWave} хвиль (можна продовжити)`);
  if (n.id === current) lines.push('Клік — пройти ще раз');
  if (route) lines.push(route);
  return lines;
}

function levelColor(heroLevel: number, rec: number): string {
  if (heroLevel >= rec) return THEME.good;
  if (heroLevel >= rec - 2) return THEME.accent;
  return THEME.bad;
}

function drawNode(ctx: CanvasRenderingContext2D, n: MapNode, x: number, y: number, r0: number, reachable: boolean, hover: boolean, t: number): void {
  const r = r0 * (hover && reachable ? 1.1 : 1);
  const accent = getBiome(n.biome).palette.accent;
  ctx.save();
  ctx.globalAlpha = reachable || n.isTown ? 1 : 0.85;
  if (n.isTown) drawTown(ctx, n, x, y, r);
  else if (n.isBoss) {
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + t * 0.3;
      const rr = i % 2 === 0 ? r : r * 0.72;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#5a1f22';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e5534b';
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = getBiome(n.biome).palette.groundDark;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    drawRegionGlyph(ctx, n.region, x, y, r);
  }
  if (n.timesCleared > 0 && !n.isTown) {
    const cx = x + r * 0.8;
    const cy = y + r * 0.8;
    ctx.fillStyle = THEME.good;
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1016';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx - 1, cy + 2.5);
    ctx.lineTo(cx + 3, cy - 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Towns: a walled capital with towers, a port with an anchor, the rest — houses with regional roofs. */
function drawTown(ctx: CanvasRenderingContext2D, n: MapNode, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(8, 10, 14, 0.6)';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  if (n.id === 'capital') {
    ctx.fillStyle = '#d9c9a3';
    ctx.fillRect(x - r * 0.9, y - r * 0.3, r * 1.8, r * 0.95);
    for (const dx of [-0.9, 0.55]) ctx.fillRect(x + dx * r, y - r * 0.75, r * 0.35, r * 1.4);
    ctx.fillStyle = '#b5523b';
    for (const dx of [-0.9, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * r - 3, y - r * 0.75);
      ctx.lineTo(x + dx * r + r * 0.175, y - r * 1.15);
      ctx.lineTo(x + dx * r + r * 0.35 + 3, y - r * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x - 1, y - r * 1.25, 2, r * 0.5);
    ctx.fillRect(x, y - r * 1.25, r * 0.35, r * 0.2);
    return;
  }
  const roof: Record<string, string> = { coast: '#3b7dd8', forest: '#b5523b', swamp: '#6a8a5a', desert: '#d9a05a', ice: '#9fc8e8' };
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.95);
  ctx.fillStyle = roof[n.region] ?? '#b5523b';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.95, y - r * 0.15);
  ctx.lineTo(x, y - r * 0.95);
  ctx.lineTo(x + r * 0.95, y - r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x - r * 0.15, y + r * 0.25, r * 0.3, r * 0.5);
  if (n.region === 'coast') {
    // Anchor.
    ctx.strokeStyle = '#e8ecf4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.9, y - r * 0.2);
    ctx.lineTo(x + r * 0.9, y + r * 0.6);
    ctx.arc(x + r * 0.9, y + r * 0.35, r * 0.3, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }
}

/** Small glyph of the region inside a location node. */
function drawRegionGlyph(ctx: CanvasRenderingContext2D, region: string, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (region) {
    case 'desert':
    case 'scrub':
      ctx.moveTo(x - r * 0.6, y + r * 0.35);
      ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.45, x + r * 0.6, y + r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'swamp':
    case 'swampEdge':
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.fillRect(x + dx * r - 1, y - r * (dx === 0 ? 0.55 : 0.35), 2, r * (dx === 0 ? 0.9 : 0.7));
        ctx.fillRect(x + dx * r - 2, y - r * (dx === 0 ? 0.55 : 0.35), 4, r * 0.25);
      }
      break;
    case 'ice':
      ctx.moveTo(x, y - r * 0.6);
      ctx.lineTo(x + r * 0.35, y);
      ctx.lineTo(x, y + r * 0.6);
      ctx.lineTo(x - r * 0.35, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'mountain':
      ctx.moveTo(x - r * 0.6, y + r * 0.4);
      ctx.lineTo(x, y - r * 0.55);
      ctx.lineTo(x + r * 0.6, y + r * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'coast':
      ctx.lineWidth = 2;
      ctx.strokeStyle = ctx.fillStyle as string;
      for (const dy of [-0.2, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.55, y + dy * r);
        ctx.quadraticCurveTo(x - r * 0.25, y + dy * r - r * 0.3, x, y + dy * r);
        ctx.quadraticCurveTo(x + r * 0.25, y + dy * r + r * 0.3, x + r * 0.55, y + dy * r);
        ctx.stroke();
      }
      break;
    default:
      ctx.moveTo(x, y - r * 0.55);
      ctx.lineTo(x + r * 0.42, y + r * 0.25);
      ctx.lineTo(x - r * 0.42, y + r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 1.5, y + r * 0.25, 3, r * 0.3);
  }
}
