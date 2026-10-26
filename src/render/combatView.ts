// Combat screen: arena, entities, effects, HUD; drives the battle simulation.

import type { InputEvent } from '../core/input';
import { Rng } from '../core/rng';
import type { Screen } from '../core/screens';
import { ARENA, WAVES } from '../data/balance';
import { getClass } from '../data/classes';
import type { BiomeDef, DecorKind } from '../data/biomes';
import { FX } from '../data/fx';
import { RARITIES } from '../data/items';
import { heroAttackSpeed } from '../systems/ai';
import { basicAttackOf } from '../systems/hero';
import { type Battle, stepBattle } from '../systems/battle';
import { portalActive, portalInReach, requestPortalEntry } from '../systems/waves';
import type { Enemy, Hero, Projectile, Telegraph, Zone } from '../systems/entities';
import type { GameEvent } from '../systems/gameEvents';
import type { App } from './app';
import { syncBattleInput } from './battleInput';
import { drawBoss, drawBossPlate } from './bossView';
import { Fx } from './fx';
import { drawControls } from './help';
import { createHud } from './hud';
import { skillFx } from './skillFx';
import { THEME } from './theme';
import { Button, ButtonGroup, type Rect, drawPanel, drawText, inRect, roundRect } from './ui';

/** Seconds to confirm abandoning the run. */
const PAUSE_CONFIRM_TIME = 3;

interface Decor {
  x: number;
  y: number;
  size: number;
  kind: DecorKind;
  color: string;
  rot: number;
}

interface Patch {
  x: number;
  y: number;
  r: number;
}

export function createCombatScreen(app: App): Screen<CanvasRenderingContext2D> & { fx: Fx } {
  const fx = new Fx();
  const hud = createHud(app, fx);
  let decor: Decor[] = [];
  let patches: Patch[] = [];
  let battle: Battle | null = null;
  /** Abandon-run needs a second click within this time. */
  let confirmUntil = 0;
  const W = app.view.width;
  // Compact, see-through pause panel: the arena stays visible.
  const PAUSE_PANEL = { x: W / 2 - 270, y: ARENA.y + ARENA.h / 2 - 140, w: 540, h: 280 };
  const resumeBtn = new Button({
    label: 'Продовжити (Esc)',
    rect: { x: W / 2 - 215, y: PAUSE_PANEL.y + PAUSE_PANEL.h - 50, w: 200, h: 36 },
    fontSize: 14,
    onClick: () => (app.loop.paused = false),
  });
  const abandonBtn = new Button({
    label: 'Завершити забіг (поразка)',
    rect: { x: W / 2 + 15, y: PAUSE_PANEL.y + PAUSE_PANEL.h - 50, w: 200, h: 36 },
    fontSize: 13,
    onClick: () => {
      if (app.time < confirmUntil) app.abandonRun();
      else confirmUntil = app.time + PAUSE_CONFIRM_TIME;
    },
  });
  const pauseButtons = new ButtonGroup([resumeBtn, abandonBtn]);

  function onEvent(e: GameEvent): void {
    const b = battle;
    if (!b) return;
    if (e.type === 'noTarget') hud.noTarget(e.slot);
    else if (e.type === 'skillCast' || e.type === 'skillTick') skillFx(fx, e);
    else handleEvent(b, fx, e);
  }

  return {
    fx,

    enter() {
      battle = app.battle;
      fx.reset();
      fx.reducedMotion = app.reducedMotion;
      hud.reset();
      if (battle) {
        const r = new Rng(battle.rng.seed).fork('decor');
        decor = makeDecor(r, battle.biome);
        patches = makePatches(r);
        fx.attach(app.state.events, onEvent);
      }
    },

    exit() {
      fx.detach();
      app.loop.paused = false;
    },

    update(dt) {
      const b = battle;
      if (!b) return;
      fx.avoid = { x: b.hero.pos.x, y: b.hero.pos.y, r: FX.damageText.heroClearance };
      syncBattleInput(app.input, b);
      fx.update(dt);
      hud.update(dt);
      if (fx.hitStop > 0) {
        fx.hitStop -= 1;
        return;
      }
      stepBattle(b, dt);
      if (b.finished) app.finishBattle();
    },

    onInput(e: InputEvent) {
      const b0 = battle;
      if (app.loop.paused && pauseButtons.handle(e)) return;
      if (b0 && !app.loop.paused && portalInReach(b0)) {
        const btn = portalButtonRect(b0);
        if ((e.type === 'key' && e.code === 'KeyE') || (e.type === 'mousedown' && inRect(btn, e.x, e.y))) {
          requestPortalEntry(b0);
          return;
        }
      }
      if (hud.handle(e)) return;
      if (e.type !== 'key') return;
      if (e.code === 'Escape') {
        app.loop.paused = !app.loop.paused;
        confirmUntil = 0;
      }
      else if (/^Digit[1-4]$/.test(e.code) && battle && !app.loop.paused) hud.useSlot(Number(e.code.slice(5)) - 1);
    },

    render(ctx) {
      const b = battle;
      if (!b) return;
      // No shake while the game is paused or a choice window is open.
      const frozen = app.loop.paused || app.screens.isPaused;
      const off = frozen ? { x: 0, y: 0 } : fx.shakeOffset();
      ctx.save();
      ctx.translate(off.x, off.y);
      drawArena(ctx, b.biome, patches, decor);
      for (const z of b.zones) drawZone(ctx, z, b, app.time);
      if (b.portal) drawPortal(ctx, b.portal.pos, b.portal.radius, app.time, portalActive(b));
      for (const p of b.projectiles) drawProjectile(ctx, p);
      for (const e of b.enemies) {
        if (e.boss) drawBoss(ctx, e, b, app.time);
        else drawEnemy(ctx, e, b, app.time);
      }
      if (b.input.control === 'player' && !b.hero.dead) drawAttackArc(ctx, b.hero);
      drawHero(ctx, b.hero, b, app.time, fx.lungeOffset());
      if (!b.hero.dead) drawAttackReady(ctx, b.hero, app.time);
      fx.drawCones(ctx);
      fx.drawSlashes(ctx);
      fx.drawRings(ctx);
      fx.drawParticles(ctx);
      // Telegraphs always above effects so they stay readable.
      for (const t of b.telegraphs) drawTelegraph(ctx, t);
      for (const e of b.enemies) {
        if (e.boss) drawBossPlate(ctx, e);
        else drawEnemyBar(ctx, e);
      }
      drawHeroBar(ctx, b.hero);
      fx.drawTexts(ctx);
      if (b.input.aim) drawCrosshair(ctx, b.input.aim);
      ctx.restore();
      if (portalInReach(b)) drawPortalButton(ctx, portalButtonRect(b), inRect(portalButtonRect(b), app.input.mouse.x, app.input.mouse.y));
      fx.drawFlash(ctx, app.view.width, app.view.height);
      hud.draw(ctx, b);
      fx.drawBanner(ctx, app.view.width / 2, ARENA.y + ARENA.h * 0.3);
      if (app.loop.paused && !app.screens.isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, ARENA.y, app.view.width, ARENA.h);
        drawPanel(ctx, PAUSE_PANEL, 'rgba(14, 16, 24, 0.72)');
        drawText(ctx, 'Пауза', W / 2, PAUSE_PANEL.y + 24, { size: 22, bold: true, align: 'center' });
        drawControls(ctx, W / 2 - 50, PAUSE_PANEL.y + 54, 12, 21, THEME.textDim);
        const confirming = app.time < confirmUntil;
        abandonBtn.label = confirming ? 'Точно? Клацніть ще раз' : 'Завершити забіг (поразка)';
        pauseButtons.draw(ctx);
      }
      hud.drawOverlay(ctx, b);
    },
  };
}

function handleEvent(b: Battle, fx: Fx, e: GameEvent): void {
  const T = FX.damageText;
  const P = FX.particles;
  switch (e.type) {
    case 'hit': {
      const amount = Math.max(1, Math.round(e.amount));
      if (e.source === 'splash') {
        fx.text({ x: e.pos.x, y: e.pos.y - e.radius - 6 }, String(amount), T.splashColor, T.splashSize);
        fx.burst(e.pos, P.hit, T.splashColor);
        break;
      }
      fx.text({ x: e.pos.x, y: e.pos.y - e.radius - 6 }, String(amount), e.crit ? T.critColor : T.color, e.crit ? T.critSize : T.size);
      if (e.source === 'basic') fx.ring(e.pos, e.radius + FX.impact.extra, '#ffffff', FX.impact.life, FX.impact.width);
      fx.burst(e.pos, e.crit ? P.crit : P.hit, e.crit ? T.critColor : '#ffffff');
      if (e.crit) fx.stop(FX.hitStop.crit);
      const target = b.enemies.find((x) => x.id === e.targetId);
      if (target && e.amount >= target.maxHp * FX.heavyHitFraction && e.source !== 'zone') fx.stop(FX.hitStop.heavy);
      break;
    }
    case 'heroHurt': {
      const amount = Math.max(1, Math.round(e.amount));
      const side = fx.rand() < 0.5 ? -1 : 1;
      fx.text({ x: e.pos.x + side * T.heroSideOffset, y: e.pos.y - 8 }, `-${amount}`, T.heroColor, T.size);
      fx.burst(e.pos, P.heroHurt, T.heroColor);
      if (e.amount >= b.hero.maxHp * FX.heroHurtBigFraction) fx.shake(FX.shake.heroHurtBig);
      break;
    }
    case 'heroAttack':
      if (!e.ranged) fx.slash(e.pos, e.angle, e.reach, e.arc);
      if (e.targets >= FX.cleaveShakeTargets) fx.shake(FX.shake.cleave);
      break;
    case 'heroHeal':
      fx.text({ x: e.pos.x + T.heroSideOffset, y: e.pos.y - 18 }, `+${Math.round(e.amount)}`, T.healColor, T.size);
      break;
    case 'kill': {
      const color = b.biome.palette.enemies[e.defId] ?? '#cccccc';
      fx.burst(e.pos, e.elite || e.boss ? P.eliteDeath : P.death, color);
      if (e.boss) {
        fx.shake(FX.shake.bossDeath);
        fx.screenFlash('#ffffff', 0.6);
      }
      break;
    }
    case 'gold':
      fx.text({ x: e.pos.x, y: e.pos.y - T.goldOffset }, `+${e.amount} золота`, T.goldColor, T.goldSize, T.life * 1.2);
      break;
    case 'spawn':
      fx.burst(e.pos, P.spawn, b.biome.palette.accent);
      break;
    case 'wave':
      if (e.bonus > 0) fx.showBanner(`Додаткова хвиля ${e.bonus} · вороги +${Math.round(e.bonus * WAVES.bonus.statPerWave * 100)}%`, THEME.accent);
      else fx.showBanner(`Хвиля ${e.index}/${e.total}`, THEME.text);
      break;
    case 'miniboss':
      fx.showBanner(`Мінібос: ${e.name}`, THEME.bad);
      fx.burst(e.pos, P.eliteDeath, THEME.bad);
      break;
    case 'loot': {
      const color = RARITIES[e.rarity].color;
      fx.showBanner(`Здобич: ${e.name} — у сумці (Tab)`, color);
      const at = {
        x: Math.max(ARENA.x + 120, Math.min(ARENA.x + ARENA.w - 120, e.pos.x)),
        y: Math.max(ARENA.y + 40, Math.min(ARENA.y + ARENA.h - 20, e.pos.y - 40)),
      };
      fx.text(at, e.name, color, 17, 2.4);
      fx.ring(e.pos, 60, RARITIES[e.rarity].color, 0.8, 5);
      fx.burst(e.pos, P.levelUp, RARITIES[e.rarity].color);
      break;
    }
    case 'portalOpen':
      fx.showBanner('Портал відкрито!', '#b98cff');
      fx.ring(e.pos, 80, '#b98cff', 0.8, 6);
      fx.burst(e.pos, P.levelUp, '#b98cff');
      break;
    case 'levelUp':
      fx.ring(b.hero.pos, FX.levelUpRing.radius, THEME.accent, FX.levelUpRing.life, 6);
      fx.burst(b.hero.pos, P.levelUp, THEME.accent);
      fx.text({ x: b.hero.pos.x, y: b.hero.pos.y - 40 }, `Рівень ${e.level}!  +${e.hp} HP, +${e.attack} атаки`, THEME.accent, 16, 1.6);
      break;
    case 'heroDeath':
      fx.burst(e.pos, P.eliteDeath, '#f4f1e8');
      fx.screenFlash('#e5534b', 0.5);
      break;
    case 'bossPhase':
      fx.screenFlash('#ff4d3a', 0.45);
      fx.shake(FX.shake.bossPhase);
      fx.showBanner('Фаза 2', THEME.bad);
      fx.burst(e.pos, P.eliteDeath, '#ff4d3a');
      break;
    case 'telegraphFire':
      fx.burst(e.pos, P.telegraph, e.kind === 'roots' ? '#7a5230' : '#c9a36b');
      fx.ring(e.pos, e.radius, '#e5534b', 0.3, 5);
      fx.shake(FX.shake.telegraph);
      break;
    case 'battleEnd':
      fx.showBanner(e.won ? 'Перемога!' : 'Поразка', e.won ? THEME.good : THEME.bad);
      break;
    default:
      break;
  }
}

// ---------- Arena ----------

function makeDecor(r: Rng, biome: BiomeDef): Decor[] {
  const out: Decor[] = [];
  const d = biome.decor;
  for (let i = 0; i < d.count; i++) {
    const size = r.float(d.minSize, d.maxSize);
    const side = r.int(0, 3);
    const band = r.float(-size * 0.5, d.edgeBand);
    let x: number;
    let y: number;
    if (side === 0) {
      x = r.float(ARENA.x, ARENA.x + ARENA.w);
      y = ARENA.y + band;
    } else if (side === 1) {
      x = ARENA.x + ARENA.w - band;
      y = r.float(ARENA.y, ARENA.y + ARENA.h);
    } else if (side === 2) {
      x = r.float(ARENA.x, ARENA.x + ARENA.w);
      y = ARENA.y + ARENA.h - band;
    } else {
      x = ARENA.x + band;
      y = r.float(ARENA.y, ARENA.y + ARENA.h);
    }
    out.push({ x, y, size, kind: r.pick(d.kinds), color: r.pick(biome.palette.decor), rot: r.float(0, Math.PI * 2) });
  }
  // Trees drawn last (on top).
  return out.sort((a, b) => (a.kind === 'tree' ? 1 : 0) - (b.kind === 'tree' ? 1 : 0) || a.y - b.y);
}

function makePatches(r: Rng): Patch[] {
  return Array.from({ length: 14 }, () => ({
    x: r.float(ARENA.x, ARENA.x + ARENA.w),
    y: r.float(ARENA.y, ARENA.y + ARENA.h),
    r: r.float(30, 90),
  }));
}

function drawArena(ctx: CanvasRenderingContext2D, biome: BiomeDef, patches: Patch[], decor: Decor[]): void {
  const p = biome.palette;
  ctx.fillStyle = p.ground;
  ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  ctx.fillStyle = p.groundDark;
  ctx.globalAlpha = 0.5;
  for (const pt of patches) {
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, pt.r, pt.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const d of decor) drawDecor(ctx, d);
  // Vignette edge.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(ARENA.x + 3, ARENA.y + 3, ARENA.w - 6, ARENA.h - 6);
}

function drawDecor(ctx: CanvasRenderingContext2D, d: Decor): void {
  ctx.save();
  ctx.translate(d.x, d.y);
  if (d.kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(4, 6, d.size, d.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, d.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(-d.size * 0.3, -d.size * 0.3, d.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'bush') {
    ctx.fillStyle = d.color;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc((i - 1) * d.size * 0.45, Math.sin(d.rot + i) * 3, d.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.rotate(d.rot);
    ctx.fillStyle = '#5b5f66';
    ctx.beginPath();
    ctx.moveTo(-d.size * 0.5, d.size * 0.2);
    ctx.lineTo(-d.size * 0.2, -d.size * 0.4);
    ctx.lineTo(d.size * 0.4, -d.size * 0.3);
    ctx.lineTo(d.size * 0.5, d.size * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Entities ----------

function spawnScale(b: Battle, spawnedAt: number): number {
  return Math.min(1, Math.max(0.05, (b.time - spawnedAt) / FX.spawnGrow));
}

function isFlashing(b: Battle, hitAt: number): boolean {
  return b.time - hitAt < FX.hitFlash;
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number): void {
  const color = b.biome.palette.enemies[e.defId] ?? '#cccccc';
  const s = spawnScale(b, e.spawnedAt);
  const r = e.radius * s;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.elite) {
    const pulse = 1 + 0.12 * Math.sin(t * 6);
    ctx.strokeStyle = b.biome.palette.eliteAura;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = b.biome.palette.eliteAura;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.archetype === 'shooter' && e.attackTimer < FX.shooterWindup && !e.statuses.stun) {
    // Charging a shot: growing glow tells the player to sidestep.
    const k = 1 - e.attackTimer / FX.shooterWindup;
    ctx.globalAlpha = 0.25 + 0.5 * k;
    ctx.fillStyle = FX.shooterWindupColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.1 + 0.6 * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(e.facing);
  ctx.fillStyle = isFlashing(b, e.hitAt) ? '#ffffff' : color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  switch (e.archetype) {
    case 'chaser':
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.8, r * 0.85);
      ctx.lineTo(-r * 0.8, -r * 0.85);
      break;
    case 'fast':
      ctx.moveTo(r * 1.35, 0);
      ctx.lineTo(-r, r * 0.6);
      ctx.lineTo(-r * 0.6, 0);
      ctx.lineTo(-r, -r * 0.6);
      break;
    case 'shooter':
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r);
      break;
    case 'tank':
      ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      break;
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eye towards the hero.
  ctx.fillStyle = '#1b1e27';
  ctx.beginPath();
  ctx.arc(r * 0.35, 0, Math.max(1.5, r * 0.16), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawStatusMarks(ctx, e, t);
}

export function drawStatusMarks(ctx: CanvasRenderingContext2D, e: Enemy, t: number): void {
  if ((e.statuses.stun?.time ?? 0) > 0) {
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(e.pos.x + Math.cos(a) * e.radius * 0.8, e.pos.y - e.radius - 6 + Math.sin(a) * 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if ((e.statuses.taunt?.time ?? 0) > 0) {
    drawText(ctx, '!', e.pos.x, e.pos.y - e.radius - 10, { size: 14, bold: true, align: 'center', color: '#ff6b5e' });
  }
}

function drawEnemyBar(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (e.boss || e.hp >= e.maxHp || e.dead) return;
  const w = Math.max(22, e.radius * 2.2);
  const x = e.pos.x - w / 2;
  const y = e.pos.y - e.radius - 9;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = e.elite ? '#ffd34d' : '#e5534b';
  ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 3);
}

function drawHero(ctx: CanvasRenderingContext2D, h: Hero, b: Battle, t: number, lunge: { x: number; y: number }): void {
  if (h.dead) return;
  const r = h.radius;
  ctx.save();
  ctx.translate(h.pos.x + lunge.x, h.pos.y + lunge.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  if (h.invulnerable > 0) {
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + Math.sin(t * 20) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const buff of h.buffs) {
    if (buff.attackSpeedMult > 1) {
      ctx.strokeStyle = 'rgba(255, 120, 60, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, t * 5, t * 5 + Math.PI * 1.2);
      ctx.stroke();
    }
    if (buff.damageTakenMult < 1) {
      // Damage reduction: steel hexagon shield.
      ctx.strokeStyle = 'rgba(190, 210, 235, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * (r + 9);
        const py = Math.sin(a) * (r + 9);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.rotate(h.facing);
  // Direction wedge.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.moveTo(r + 9, 0);
  ctx.lineTo(r - 2, 7);
  ctx.lineTo(r - 2, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = isFlashing(b, h.hitAt) ? '#ff8a80' : '#f4f1e8';
  ctx.strokeStyle = h.classId ? getClass(h.classId).color : '#1b1e27';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  if (p.team === 'enemy') {
    ctx.fillStyle = '#d86bf0';
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(p.pos.x - 1.5, p.pos.y - 1.5, p.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const a = Math.atan2(p.vel.y, p.vel.x);
    ctx.strokeStyle = p.kind.endsWith('Crit') ? '#ffd23f' : '#f4f1e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.pos.x, p.pos.y);
    ctx.lineTo(p.pos.x - Math.cos(a) * 14, p.pos.y - Math.sin(a) * 14);
    ctx.stroke();
  }
}

function drawZone(ctx: CanvasRenderingContext2D, z: Zone, b: Battle, t: number): void {
  const life = 1 - z.time / z.duration;
  ctx.save();
  ctx.translate(z.pos.x, z.pos.y);
  if (z.kind === 'whirlwind') {
    ctx.globalAlpha = 0.2 + 0.15 * life;
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = t * 14 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, z.radius * (0.55 + i * 0.2), a, a + 1.1);
      ctx.stroke();
    }
  } else if (z.kind === 'fireTrail') {
    ctx.globalAlpha = 0.6 * life;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, z.radius);
    g.addColorStop(0, '#ffd23f');
    g.addColorStop(1, 'rgba(229, 83, 75, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, z.radius * (0.9 + 0.1 * Math.sin(t * 20 + z.id)), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.25 * life;
    ctx.fillStyle = b.biome.palette.accent;
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** "Увійти" button next to the portal, kept inside the arena. */
function portalButtonRect(b: Battle): Rect {
  const p = b.portal!;
  const w = 168;
  const h = 34;
  const x = Math.max(ARENA.x + 6, Math.min(ARENA.x + ARENA.w - w - 6, p.pos.x - w / 2));
  const above = p.pos.y - p.radius - h - 16;
  const y = above > ARENA.y + 6 ? above : p.pos.y + p.radius + 16;
  return { x, y, w, h };
}

function drawPortalButton(ctx: CanvasRenderingContext2D, r: Rect, hover: boolean): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = hover ? '#6b3fc4' : '#4b2a8f';
  ctx.fill();
  ctx.strokeStyle = '#d9c2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, 'Увійти в портал [E]', r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 14, bold: true, align: 'center' });
}

function drawPortal(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, r: number, t: number, active: boolean): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Closed during a wave: dim and slow.
  if (!active) {
    ctx.globalAlpha = 0.3;
    t *= 0.2;
  }
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.6);
  g.addColorStop(0, 'rgba(230, 210, 255, 0.95)');
  g.addColorStop(0.45, 'rgba(150, 90, 255, 0.7)');
  g.addColorStop(1, 'rgba(90, 40, 200, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d9c2ff';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.55 + i * 0.22), a, a + 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** HP bar with numbers right under the hero, so the eyes stay on the fight. */
function drawHeroBar(ctx: CanvasRenderingContext2D, h: Hero): void {
  if (h.dead) return;
  const B = FX.heroBar;
  const x = h.pos.x - B.width / 2;
  const y = h.pos.y + h.radius + B.gap;
  const frac = Math.max(0, h.hp / h.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 1, y - 1, B.width + 2, B.height + 2);
  ctx.fillStyle = frac <= B.low ? '#ff3b30' : '#d64545';
  ctx.fillRect(x, y, B.width * frac, B.height);
  drawText(ctx, `${Math.ceil(h.hp)}/${h.maxHp}`, h.pos.x, y + B.height + 8, { size: 10, bold: true, align: 'center', color: frac <= B.low ? '#ff6b5e' : THEME.text });
}

/** Ring that fills up until the next basic attack; full and pulsing when ready. */
function drawAttackReady(ctx: CanvasRenderingContext2D, h: Hero, t: number): void {
  const a = FX.attackReady;
  const interval = 1 / heroAttackSpeed(h);
  const frac = Math.max(0, Math.min(1, 1 - h.attackTimer / interval));
  const r = h.radius + a.ring;
  ctx.save();
  ctx.lineWidth = a.width;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(h.pos.x, h.pos.y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (frac >= 1) {
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 10);
    ctx.strokeStyle = a.readyColor;
  } else {
    ctx.strokeStyle = a.chargingColor;
  }
  ctx.beginPath();
  ctx.arc(h.pos.x, h.pos.y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Faint wedge showing where auto-attacks land (towards the cursor). */
function drawAttackArc(ctx: CanvasRenderingContext2D, h: Hero): void {
  const attack = basicAttackOf(h);
  if (attack.kind !== 'melee') return;
  const half = (attack.arcDeg * Math.PI) / 360;
  const r = h.stats.ranged ? h.radius * 3 : h.stats.range + h.radius;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.moveTo(h.pos.x, h.pos.y);
  ctx.arc(h.pos.x, h.pos.y, r, h.facing - half, h.facing + half);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(h.pos.x, h.pos.y, r, h.facing - half, h.facing + half);
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, p: { x: number; y: number }): void {
  ctx.strokeStyle = 'rgba(242, 193, 78, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.moveTo(p.x - 13, p.y);
  ctx.lineTo(p.x - 4, p.y);
  ctx.moveTo(p.x + 4, p.y);
  ctx.lineTo(p.x + 13, p.y);
  ctx.moveTo(p.x, p.y - 13);
  ctx.lineTo(p.x, p.y - 4);
  ctx.moveTo(p.x, p.y + 4);
  ctx.lineTo(p.x, p.y + 13);
  ctx.stroke();
}

function drawTelegraph(ctx: CanvasRenderingContext2D, tg: Telegraph): void {
  const k = Math.min(1, tg.time / tg.delay);
  ctx.save();
  ctx.translate(tg.pos.x, tg.pos.y);
  ctx.strokeStyle = `rgba(255, 70, 60, ${0.6 + 0.4 * k})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  if (tg.shape.kind === 'circle') {
    const r = tg.shape.radius;
    ctx.fillStyle = 'rgba(229, 40, 40, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(229, 40, 40, 0.38)';
    ctx.beginPath();
    ctx.arc(0, 0, r * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Line: a band from the origin; the fill runs along it.
    const dx = tg.shape.to.x - tg.pos.x;
    const dy = tg.shape.to.y - tg.pos.y;
    const len = Math.hypot(dx, dy);
    const w = tg.shape.width;
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = 'rgba(229, 40, 40, 0.18)';
    ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = 'rgba(229, 40, 40, 0.38)';
    ctx.fillRect(0, -w / 2, len * k, w);
    ctx.strokeRect(0, -w / 2, len, w);
  }
  ctx.setLineDash([]);
  ctx.restore();
}
