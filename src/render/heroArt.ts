// The hero seen from above (ROADMAP 19.3): the class silhouette — the warrior's pauldrons and
// sword, the mage's hat and staff, the archer's hood and bow — and the worn items: the weapon,
// the armour and the hat take the colour of their rarity. Drawn facing right (the caller turns it).

import { RARITIES } from '../data/items';
import type { Hero } from '../systems/entities';

const STEEL = '#c9ccd4';
const WOOD = '#8a5a32';
const OUTLINE = 'rgba(0,0,0,0.55)';

export function drawHeroBody(ctx: CanvasRenderingContext2D, h: Hero, r: number, body: string, rim: string): void {
  const weapon = h.equipment.weapon ? RARITIES[h.equipment.weapon.rarity].color : null;
  const armor = h.equipment.armor ? RARITIES[h.equipment.armor.rarity].color : null;
  const hat = h.equipment.hat ? RARITIES[h.equipment.hat.rarity].color : null;
  const cls = h.classId;
  ctx.lineCap = 'round';
  // Behind the body: the archer's hood, the warrior's sword arm.
  if (cls === 'archer') {
    ctx.fillStyle = '#3f6a3a';
    ctx.beginPath();
    ctx.arc(-r * 0.2, 0, r * 1.05, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();
  }
  // The body.
  ctx.fillStyle = body;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The armour: a ring in its rarity.
  if (armor) {
    ctx.strokeStyle = armor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (cls === 'warrior') {
    // Pauldrons and a sword on the right side.
    for (const s of [-1, 1]) {
      ctx.fillStyle = STEEL;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-r * 0.05, s * r * 0.82, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = weapon ?? STEEL;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(r * 0.35, r * 0.62);
    ctx.lineTo(r * 1.55, r * 0.62);
    ctx.stroke();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.45, r * 0.4);
    ctx.lineTo(r * 0.45, r * 0.85);
    ctx.stroke();
  } else if (cls === 'mage') {
    // A staff with a glowing orb and a wide hat.
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, r * 0.75);
    ctx.lineTo(r * 1.45, r * 0.9);
    ctx.stroke();
    ctx.fillStyle = weapon ?? '#8fd3ff';
    ctx.beginPath();
    ctx.arc(r * 1.5, r * 0.9, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hat ?? '#4a3a7a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-r * 0.05, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a1f4a';
    ctx.beginPath();
    ctx.arc(-r * 0.15, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  } else if (cls === 'archer') {
    // A bow in front, the string drawn.
    ctx.strokeStyle = weapon ?? WOOD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, r * 0.95, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r * 0.55 + Math.cos(-Math.PI * 0.42) * r * 0.95, Math.sin(-Math.PI * 0.42) * r * 0.95);
    ctx.lineTo(r * 0.55 + Math.cos(Math.PI * 0.42) * r * 0.95, Math.sin(Math.PI * 0.42) * r * 0.95);
    ctx.stroke();
  }
  // A hat (not the mage's own): a cap in its rarity.
  if (hat && cls !== 'mage') {
    ctx.fillStyle = hat;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-r * 0.1, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
