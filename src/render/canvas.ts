// Canvas with a fixed logical resolution, letterboxed into the window.

import { VIEW } from '../data/balance';

export interface View {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical size. */
  width: number;
  height: number;
  /** CSS px per logical px. */
  scale: number;
  offsetX: number;
  offsetY: number;
  dpr: number;
}

export function createView(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  const view: View = {
    canvas,
    ctx,
    width: VIEW.width,
    height: VIEW.height,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dpr: 1,
  };
  const resize = (): void => resizeView(view);
  window.addEventListener('resize', resize);
  resize();
  return view;
}

export function resizeView(view: View): void {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  view.dpr = dpr;
  view.canvas.width = Math.round(cssW * dpr);
  view.canvas.height = Math.round(cssH * dpr);
  view.scale = Math.min(cssW / view.width, cssH / view.height);
  view.offsetX = (cssW - view.width * view.scale) / 2;
  view.offsetY = (cssH - view.height * view.scale) / 2;
}

/** Client (CSS) coordinates → logical coordinates. */
export function toLogical(view: View, clientX: number, clientY: number): { x: number; y: number } {
  const rect = view.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

/** Clears the whole canvas and sets the transform to logical space. */
export function beginFrame(view: View, letterbox: string): void {
  const { ctx, dpr } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = letterbox;
  ctx.fillRect(0, 0, view.canvas.width, view.canvas.height);
  const s = view.scale * dpr;
  ctx.setTransform(s, 0, 0, s, view.offsetX * dpr, view.offsetY * dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, view.width, view.height);
  ctx.clip();
}

export function endFrame(view: View): void {
  view.ctx.restore();
}
