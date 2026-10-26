// World map screen: nodes, edges, current position, tooltip, travel by click.

import type { InputEvent } from '../core/input';
import type { Screen } from '../core/screens';
import { getBiome } from '../data/biomes';
import { type MapNode, recommendedLevel } from '../systems/mapgen';
import { canTravel } from '../systems/run';
import type { App } from './app';
import { THEME, font } from './theme';
import { TOP_BAR_H, drawTopBar } from './topBar';
import { Button, ButtonGroup, type Rect, drawText, drawTooltip } from './ui';

const NODE_R = 15;
const BOSS_R = 20;
const TOWN_R = 22;
/** Nodes lower than this get their labels above (the bottom of the view is close). */
const LABELS_ABOVE_Y = 470;

function nodeRadius(n: MapNode): number {
  return n.isTown ? TOWN_R : n.isBoss ? BOSS_R : NODE_R;
}

export function createMapScreen(app: App): Screen<CanvasRenderingContext2D> {
  let hovered: string | null = null;
  const buttons = new ButtonGroup([
    new Button({
      label: '← До міста [Esc]',
      rect: { x: 16, y: app.view.height - 52, w: 190, h: 36 },
      hotkey: 'Escape',
      fontSize: 14,
      onClick: () => app.returnToTown(),
    }),
  ]);

  function nodeAt(x: number, y: number): MapNode | null {
    for (const n of app.state.world.nodes) {
      if (Math.hypot(n.pos.x - x, n.pos.y - y) <= nodeRadius(n) + 6) return n;
    }
    return null;
  }

  return {
    update() {},

    onInput(e: InputEvent) {
      if (buttons.handle(e)) return;
      if (e.type === 'mousemove') {
        hovered = nodeAt(e.x, e.y)?.id ?? null;
      } else if (e.type === 'mousedown') {
        const n = nodeAt(e.x, e.y);
        if (n && canTravel(app.state, n.id)) app.travelTo(n.id);
      }
    },

    render(ctx) {
      const state = app.state;
      const { world } = state;
      const t = app.time;
      ctx.fillStyle = THEME.bg;
      ctx.fillRect(0, 0, app.view.width, app.view.height);
      drawBackdrop(ctx, app.view.width, app.view.height);

      // Edges.
      for (const [a, b] of world.edges) {
        const na = world.nodes.find((n) => n.id === a);
        const nb = world.nodes.find((n) => n.id === b);
        if (!na || !nb) continue;
        const active = a === state.currentNodeId || b === state.currentNodeId;
        ctx.strokeStyle = active ? 'rgba(242, 193, 78, 0.75)' : 'rgba(140, 150, 175, 0.35)';
        ctx.lineWidth = active ? 3 : 2;
        ctx.setLineDash(active ? [] : [6, 6]);
        ctx.beginPath();
        ctx.moveTo(na.pos.x, na.pos.y);
        ctx.lineTo(nb.pos.x, nb.pos.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Nodes. Names only where the eye needs them (the hero's way, bosses, hover):
      // the full world has 37 nodes. The rest show the name in the tooltip.
      for (const n of world.nodes) {
        const reachable = canTravel(state, n.id);
        const isHere = n.id === state.currentNodeId;
        const isHover = hovered === n.id;
        drawNode(ctx, n, reachable, isHover, t);
        if (isHere) {
          const pulse = 1 + 0.08 * Math.sin(t * 4);
          ctx.strokeStyle = THEME.accent;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(n.pos.x, n.pos.y, (nodeRadius(n) + 9) * pulse, 0, Math.PI * 2);
          ctx.stroke();
          // Hero marker.
          ctx.fillStyle = '#f4f1e8';
          ctx.beginPath();
          ctx.arc(n.pos.x + nodeRadius(n) * 0.9, n.pos.y - nodeRadius(n) * 0.9, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1b1e27';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      // Labels after all nodes, by priority; a name that would overlap one already
      // placed is left out (it is still in the tooltip).
      const priority = (n: MapNode): number =>
        n.id === hovered ? 0 : n.id === state.currentNodeId ? 1 : n.isTown || n.isBoss ? 2 : canTravel(state, n.id) ? 3 : 4;
      const taken: Rect[] = [];
      for (const n of [...world.nodes].sort((a, b) => priority(a) - priority(b))) {
        const reachable = canTravel(state, n.id);
        const named = priority(n) < 4;
        const level = n.isTown ? null : recommendedLevel(n.tier);
        drawNodeLabels(ctx, n, named, reachable, level === null ? null : { text: `рів. ${level}`, color: levelColor(state.hero.level, level) }, app.view.width, taken);
      }

      drawTopBar(ctx, state, app.view.width, app.totalBosses(), app.time);
      buttons.draw(ctx);
      drawText(ctx, 'Клік по сусідній локації — вирушити', app.view.width - 14, app.view.height - 14, {
        size: 12,
        align: 'right',
        color: THEME.textDim,
      });

      if (hovered) {
        const n = world.nodes.find((x) => x.id === hovered);
        if (n) drawTooltip(ctx, tooltipLines(n, state.currentNodeId), app.input.mouse.x, app.input.mouse.y, app.view.width, app.view.height);
      }
    },
  };
}

/**
 * Name and recommended level of a node. Bosses at the top and bottom of the map get
 * them on the side (no room above / below); the rest are centred under the node (above
 * near the bottom edge), shifted to stay on screen. `taken`: rects of names already
 * drawn — a name that would overlap one is skipped.
 */
function drawNodeLabels(
  ctx: CanvasRenderingContext2D,
  n: MapNode,
  named: boolean,
  bright: boolean,
  level: { text: string; color: string } | null,
  screenW: number,
  taken: Rect[],
): void {
  const r = nodeRadius(n);
  const nameStyle = { size: 12, bold: true, color: bright ? THEME.text : THEME.textDim };
  ctx.font = font(12, 'bold');
  const w = ctx.measureText(n.name).width;
  const fits = (rect: Rect): boolean => {
    if (taken.some((o) => rect.x < o.x + o.w && o.x < rect.x + rect.w && rect.y < o.y + o.h && o.y < rect.y + rect.h)) return false;
    taken.push(rect);
    return true;
  };
  if (n.isBoss && (n.sector === 'N' || n.sector === 'S')) {
    const x = n.pos.x + r + 8;
    if (named && fits({ x, y: n.pos.y - 14, w, h: 14 })) drawText(ctx, n.name, x, n.pos.y - 7, nameStyle);
    if (level) drawText(ctx, level.text, x, n.pos.y + 8, { size: 11, color: level.color });
    return;
  }
  const above = n.pos.y > LABELS_ABOVE_Y;
  const half = w / 2;
  const x = Math.max(half + 4, Math.min(screenW - half - 4, n.pos.x));
  const nameY = above ? n.pos.y - r - 24 : n.pos.y + r + 13;
  const showName = named && fits({ x: x - half, y: nameY - 7, w, h: 14 });
  if (showName) drawText(ctx, n.name, x, nameY, { ...nameStyle, align: 'center' });
  if (level) drawText(ctx, level.text, n.pos.x, above ? n.pos.y - r - 10 : n.pos.y + r + (showName ? 26 : 12), { size: 11, align: 'center', color: level.color });
}

function tooltipLines(n: MapNode, current: string): string[] {
  if (n.isTown) return [n.name, 'Відпочинок і збереження при кожному візиті', 'Клік — повернутися в місто'];
  const biome = n.biome ? getBiome(n.biome).name : '—';
  const lines = [
    n.name,
    `Біом: ${biome}`,
    `Складність: ${n.tier.toFixed(1)}${n.isBoss ? ' (бос)' : ''}`,
    `Рекомендований рівень: ${recommendedLevel(n.tier)}`,
    `Пройдено разів: ${n.timesCleared}`,
  ];
  if (n.lastWave > 0) lines.push(`Минулого разу: ${n.lastWave} хвиль (можна продовжити)`);
  if (n.id === current) lines.push('Клік — пройти ще раз');
  return lines;
}

function levelColor(heroLevel: number, rec: number): string {
  if (heroLevel >= rec) return THEME.good;
  if (heroLevel >= rec - 2) return THEME.accent;
  return THEME.bad;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, '#1b2230');
  g.addColorStop(1, '#0d1016');
  ctx.fillStyle = g;
  ctx.fillRect(0, TOP_BAR_H, w, h - TOP_BAR_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, TOP_BAR_H);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = TOP_BAR_H; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
}

function drawNode(ctx: CanvasRenderingContext2D, n: MapNode, reachable: boolean, hover: boolean, t: number): void {
  const { x, y } = n.pos;
  const r = nodeRadius(n) * (hover && reachable ? 1.08 : 1);
  const accent = n.biome ? getBiome(n.biome).palette.accent : '#d9c9a3';
  ctx.save();
  ctx.globalAlpha = reachable || n.isTown ? 1 : 0.85;
  if (n.isTown) {
    // House: body + roof.
    ctx.fillStyle = '#d9c9a3';
    ctx.fillRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.95);
    ctx.fillStyle = '#b5523b';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y - r * 0.15);
    ctx.lineTo(x, y - r * 0.95);
    ctx.lineTo(x + r * 0.95, y - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x - r * 0.15, y + r * 0.25, r * 0.3, r * 0.5);
  } else if (n.isBoss) {
    // Spiky boss emblem.
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + t * 0.3;
      const rr = i % 2 === 0 ? r : r * 0.72;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
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
    ctx.fillStyle = n.biome ? getBiome(n.biome).palette.groundDark : '#1d2a1b';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    drawBiomeGlyph(ctx, n.biome, x, y, r);
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

/** Small glyph of the biome inside a location node: tree, dune, reeds, ice crystal. */
function drawBiomeGlyph(ctx: CanvasRenderingContext2D, biome: string | null, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (biome) {
    case 'desert':
      // Dune with a sun.
      ctx.moveTo(x - r * 0.6, y + r * 0.35);
      ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.45, x + r * 0.6, y + r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'swamp':
      // Three reeds.
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.fillRect(x + dx * r - 1, y - r * (dx === 0 ? 0.55 : 0.35), 2, r * (dx === 0 ? 0.9 : 0.7));
        ctx.fillRect(x + dx * r - 2, y - r * (dx === 0 ? 0.55 : 0.35), 4, r * 0.25);
      }
      break;
    case 'ice':
      // Crystal.
      ctx.moveTo(x, y - r * 0.6);
      ctx.lineTo(x + r * 0.35, y);
      ctx.lineTo(x, y + r * 0.6);
      ctx.lineTo(x - r * 0.35, y);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      // Tree.
      ctx.moveTo(x, y - r * 0.55);
      ctx.lineTo(x + r * 0.42, y + r * 0.25);
      ctx.lineTo(x - r * 0.42, y + r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 1.5, y + r * 0.25, 3, r * 0.3);
  }
}
