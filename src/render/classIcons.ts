// Skill icons of the Mage and Archer, and passive glyphs for their stats.
// Called by drawSkillIcon / drawPassiveIcon with the context already translated
// to the icon centre and colours set.

import type { SkillIcon } from '../data/skills';

/** Draws a Mage / Archer skill icon; false if the icon is not one of theirs. */
export function drawClassSkillIcon(ctx: CanvasRenderingContext2D, icon: SkillIcon, r: number): boolean {
  switch (icon) {
    case 'fireball':
      ctx.beginPath();
      ctx.arc(r * 0.2, r * 0.15, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, r * (0.15 + (i - 1) * 0.28));
        ctx.lineTo(-r * 0.85, r * (-0.25 + (i - 1) * 0.28));
        ctx.stroke();
      }
      return true;
    case 'frost':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5 + Math.cos(a + 0.9) * r * 0.2, Math.sin(a) * r * 0.5 + Math.sin(a + 0.9) * r * 0.2);
        ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        ctx.lineTo(Math.cos(a) * r * 0.5 + Math.cos(a - 0.9) * r * 0.2, Math.sin(a) * r * 0.5 + Math.sin(a - 0.9) * r * 0.2);
        ctx.stroke();
      }
      return true;
    case 'chain':
      ctx.beginPath();
      ctx.moveTo(r * 0.25, -r * 0.9);
      ctx.lineTo(-r * 0.35, r * 0.05);
      ctx.lineTo(r * 0.1, r * 0.05);
      ctx.lineTo(-r * 0.3, r * 0.9);
      ctx.lineTo(r * 0.45, -r * 0.2);
      ctx.lineTo(0, -r * 0.2);
      ctx.lineTo(r * 0.45, -r * 0.9);
      ctx.closePath();
      ctx.fill();
      return true;
    case 'blink':
      ctx.setLineDash([r * 0.18, r * 0.14]);
      ctx.beginPath();
      ctx.arc(-r * 0.45, r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(r * 0.4, -r * 0.35, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, r * 0.05);
      ctx.lineTo(r * 0.1, -r * 0.15);
      ctx.stroke();
      return true;
    case 'missiles':
      for (let i = 0; i < 3; i++) {
        const y = (i - 1) * r * 0.55;
        const x = (i === 1 ? 0.2 : -0.1) * r;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.55, y);
        ctx.lineTo(x + r * 0.05, y - r * 0.18);
        ctx.lineTo(x - r * 0.45, y);
        ctx.lineTo(x + r * 0.05, y + r * 0.18);
        ctx.closePath();
        ctx.fill();
      }
      return true;
    case 'barrier':
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * r * 0.85;
        const py = Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    case 'wall':
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * r * 0.45;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.2, r * 0.75);
        ctx.quadraticCurveTo(x - r * 0.25, 0, x, -r * (0.55 + (i % 2) * 0.3));
        ctx.quadraticCurveTo(x + r * 0.25, 0, x + r * 0.2, r * 0.75);
        ctx.closePath();
        ctx.fill();
      }
      return true;
    case 'vortex':
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = k * 0.42;
        const rr = (k / 40) * r * 0.85;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return true;
    case 'multishot':
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.45;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, 0);
        ctx.lineTo(r * 0.6, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.85, 0);
        ctx.lineTo(r * 0.55, -r * 0.15);
        ctx.lineTo(r * 0.55, r * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      return true;
    case 'trap':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
        ctx.lineTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.stroke();
      }
      return true;
    case 'rain':
      ctx.beginPath();
      ctx.arc(0, -r * 0.45, r * 0.55, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * r * 0.4;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.1, -r * 0.2);
        ctx.lineTo(x - r * 0.1, r * 0.8);
        ctx.stroke();
      }
      return true;
    case 'vault':
      ctx.beginPath();
      ctx.arc(0, r * 0.5, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, r * 0.05);
      ctx.lineTo(-r * 0.85, -r * 0.35);
      ctx.lineTo(-r * 0.45, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.2, r * 0.55);
      ctx.lineTo(r * 0.9, r * 0.55);
      ctx.stroke();
      return true;
    case 'pierce':
      ctx.lineWidth *= 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(r * 0.55, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.9, 0);
      ctx.lineTo(r * 0.45, -r * 0.25);
      ctx.lineTo(r * 0.45, r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth /= 1.4;
      for (const x of [-r * 0.35, r * 0.1]) {
        ctx.beginPath();
        ctx.arc(x, 0, r * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      return true;
    case 'mark':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      return true;
    case 'net':
      ctx.lineWidth *= 0.7;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.3, -r * 0.8);
        ctx.lineTo(i * r * 0.3, r * 0.8);
        ctx.moveTo(-r * 0.8, i * r * 0.3);
        ctx.lineTo(r * 0.8, i * r * 0.3);
        ctx.stroke();
      }
      return true;
    case 'barrage':
      for (let i = 0; i < 4; i++) {
        const y = (i - 1.5) * r * 0.4;
        const x = (i % 2) * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.75, y);
        ctx.lineTo(x + r * 0.55, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + r * 0.8, y);
        ctx.lineTo(x + r * 0.5, y - r * 0.13);
        ctx.lineTo(x + r * 0.5, y + r * 0.13);
        ctx.closePath();
        ctx.fill();
      }
      return true;
    case 'rage':
      // Snarling fang shape.
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.5);
      ctx.lineTo(-r * 0.3, r * 0.7);
      ctx.lineTo(0, -r * 0.1);
      ctx.lineTo(r * 0.3, r * 0.7);
      ctx.lineTo(r * 0.8, -r * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -r * 0.55, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      return true;
    case 'holy':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.7, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.6, r * 0.45, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.6, r * 0.45, -r * 0.7, -r * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(-r * 0.08, -r * 0.5, r * 0.16, r * 0.95);
      ctx.fillRect(-r * 0.35, -r * 0.2, r * 0.7, r * 0.16);
      return true;
    case 'meteor':
      ctx.beginPath();
      ctx.arc(r * 0.3, r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(r * (0.05 - i * 0.12), r * (0.05 + i * 0.12) - r * 0.2);
        ctx.lineTo(-r * (0.85 - i * 0.1), -r * (0.85 - i * 0.25));
        ctx.stroke();
      }
      return true;
    case 'blizzard':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.3 + i * 0.25), i * 1.3, i * 1.3 + 2.6);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const a = i * 1.25;
        ctx.fillRect(Math.cos(a) * r * 0.75 - 2, Math.sin(a) * r * 0.75 - 2, 4, 4);
      }
      return true;
    case 'scope':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(-r * 0.2, 0);
      ctx.moveTo(r * 0.2, 0);
      ctx.lineTo(r * 0.9, 0);
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(0, -r * 0.2);
      ctx.moveTo(0, r * 0.2);
      ctx.lineTo(0, r * 0.9);
      ctx.stroke();
      return true;
    case 'pack':
      // Three wolf heads.
      for (const [dx, dy, s] of [[-0.45, 0.25, 0.8], [0.45, 0.25, 0.8], [0, -0.25, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(r * (dx - 0.3 * s), r * (dy + 0.25 * s));
        ctx.lineTo(r * (dx - 0.3 * s), r * (dy - 0.3 * s));
        ctx.lineTo(r * (dx - 0.1 * s), r * (dy - 0.1 * s));
        ctx.lineTo(r * (dx + 0.1 * s), r * (dy - 0.1 * s));
        ctx.lineTo(r * (dx + 0.3 * s), r * (dy - 0.3 * s));
        ctx.lineTo(r * (dx + 0.3 * s), r * (dy + 0.25 * s));
        ctx.lineTo(r * dx, r * (dy + 0.45 * s));
        ctx.closePath();
        ctx.fill();
      }
      return true;
    default:
      return false;
  }
}

/** Passive glyphs for the stats of Mage and Archer passives; false if not handled. */
export function drawClassPassiveIcon(ctx: CanvasRenderingContext2D, stat: string, r: number): boolean {
  switch (stat) {
    case 'skillDamagePct':
      // Four-pointed spark.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 0.9 : r * 0.3;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      return true;
    case 'cooldownPct':
      // Hourglass.
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.8);
      ctx.lineTo(r * 0.55, -r * 0.8);
      ctx.lineTo(-r * 0.55, r * 0.8);
      ctx.lineTo(r * 0.55, r * 0.8);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.75);
      ctx.lineTo(0, r * 0.3);
      ctx.lineTo(r * 0.3, r * 0.75);
      ctx.closePath();
      ctx.fill();
      return true;
    case 'hpPct':
      // Heart with a plus.
      ctx.beginPath();
      ctx.moveTo(0, r * 0.8);
      ctx.bezierCurveTo(-r * 1.1, 0, -r * 0.5, -r * 0.9, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.5, -r * 0.9, r * 1.1, 0, 0, r * 0.8);
      ctx.fill();
      return true;
    case 'critChance':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      return true;
    case 'attackSpeedPct':
      // Double chevron.
      for (const dx of [-0.35, 0.2]) {
        ctx.beginPath();
        ctx.moveTo(r * (dx - 0.25), -r * 0.6);
        ctx.lineTo(r * (dx + 0.25), 0);
        ctx.lineTo(r * (dx - 0.25), r * 0.6);
        ctx.stroke();
      }
      return true;
    case 'petDamagePct':
      // Paw print.
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.4, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [x, y] of [[-0.5, -0.2], [-0.18, -0.5], [0.18, -0.5], [0.5, -0.2]] as const) {
        ctx.beginPath();
        ctx.arc(r * x, r * y, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    case 'pierce':
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(r * 0.6, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.9, 0);
      ctx.lineTo(r * 0.5, -r * 0.25);
      ctx.lineTo(r * 0.5, r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.1, 0, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    default:
      return false;
  }
}
