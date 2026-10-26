// World map screen: nodes, edges, current position, tooltip, travel by click.

import type { InputEvent } from '../core/input';
import type { Screen } from '../core/screens';
import { getBiome } from '../data/biomes';
import { type MapNode, recommendedLevel } from '../systems/mapgen';
import { canTravel } from '../systems/run';
import type { App } from './app';
import { THEME } from './theme';
import { TOP_BAR_H, drawTopBar } from './topBar';
import { Button, ButtonGroup, drawText, drawTooltip } from './ui';

const NODE_R = 22;
const BOSS_R = 30;
const TOWN_R = 26;

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

      // Nodes.
      for (const n of world.nodes) {
        const reachable = canTravel(state, n.id);
        const isHere = n.id === state.currentNodeId;
        const isHover = hovered === n.id;
        drawNode(ctx, n, reachable, isHover, t);
        drawText(ctx, n.name, n.pos.x, n.pos.y - nodeRadius(n) - 14, {
          size: 15,
          bold: true,
          align: 'center',
          color: reachable || isHere ? THEME.text : THEME.textDim,
        });
        if (!n.isTown) {
          drawText(ctx, `Рек. рів. ${recommendedLevel(n.tier)}`, n.pos.x, n.pos.y + nodeRadius(n) + 16, {
            size: 13,
            align: 'center',
            color: levelColor(state.hero.level, recommendedLevel(n.tier)),
          });
        }
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

      drawTopBar(ctx, state, app.view.width, app.totalBosses(), app.time);
      buttons.draw(ctx);
      drawText(ctx, 'Клік по локації — вирушити. Клік по поточній — пройти ще раз.', app.view.width / 2 + 60, app.view.height - 22, {
        size: 14,
        align: 'center',
        color: THEME.textDim,
      });

      if (hovered) {
        const n = world.nodes.find((x) => x.id === hovered);
        if (n) drawTooltip(ctx, tooltipLines(n, state.currentNodeId), app.input.mouse.x, app.input.mouse.y, app.view.width, app.view.height);
      }
    },
  };
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
    ctx.fillStyle = '#1d2a1b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();
    // Little tree glyph.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55);
    ctx.lineTo(x + r * 0.42, y + r * 0.25);
    ctx.lineTo(x - r * 0.42, y + r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 2, y + r * 0.25, 4, r * 0.3);
  }
  if (n.timesCleared > 0 && !n.isTown) {
    ctx.fillStyle = THEME.good;
    ctx.beginPath();
    ctx.arc(x + r * 0.75, y + r * 0.75, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1016';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.75 - 4, y + r * 0.75);
    ctx.lineTo(x + r * 0.75 - 1, y + r * 0.75 + 3);
    ctx.lineTo(x + r * 0.75 + 4, y + r * 0.75 - 3);
    ctx.stroke();
  }
  ctx.restore();
}
