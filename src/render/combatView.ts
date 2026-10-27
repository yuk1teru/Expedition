// Combat screen: arena, entities, effects, HUD; drives the battle simulation.

import { drawHazard } from './biomeBosses';
import { heroColor } from './names';
import { drawAimLine, drawAlly, drawBranchProjectile, drawBranchZone, drawClassProjectile, drawClassZone, drawElementalStatus, drawShieldBubble } from './classFx';
import { heroShield } from '../systems/hero';
import type { InputEvent } from '../core/input';
import { Rng } from '../core/rng';
import type { Screen } from '../core/screens';
import { ARENA, PROGRESSION, TRAPS } from '../data/balance';
import { WEATHER } from '../data/weather';
import { getEnemyDef } from '../data/enemies';
import type { BiomeDef, DecorKind } from '../data/biomes';
import { FX } from '../data/fx';
import { RARITIES } from '../data/items';
import { heroAttackSpeed, meleeReach, nextShotIsVolley } from '../systems/ai';
import { type Trap, trapArmed } from '../systems/traps';
import { basicAttackOf } from '../systems/hero';
import { type Battle, stepBattle, type ManaOrb } from '../systems/battle';
import { type Pickup, pickupReady, useQuickSlot } from '../systems/pickups';
import { portalActive, portalInReach, requestPortalEntry } from '../systems/waves';
import { CONSUMABLES, type ConsumableId, PICKUPS, PICKUP_SPAWN, QUICK_SLOTS } from '../data/consumables';
import { drawConsumableIcon } from './icons';
import { useBootDash } from '../systems/skills';
import type { Enemy, Hero, Projectile, Telegraph, Zone } from '../systems/entities';
import type { GameEvent } from '../systems/gameEvents';
import type { App } from './app';
import { syncBattleInput } from './battleInput';
import { drawBoss, drawBossPlate } from './bossView';
import { Fx } from './fx';
import { drawControls, openWiki } from './help';
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
  const PAUSE_PANEL = { x: W / 2 - 270, y: ARENA.y + ARENA.h / 2 - 166, w: 540, h: 332 };
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
  const wikiBtn = new Button({
    label: 'Вікі ↗',
    rect: { x: PAUSE_PANEL.x + PAUSE_PANEL.w - 84, y: PAUSE_PANEL.y + 12, w: 72, h: 26 },
    fontSize: 12,
    onClick: openWiki,
  });
  const pauseButtons = new ButtonGroup([resumeBtn, abandonBtn, wikiBtn]);

  function onEvent(e: GameEvent): void {
    const b = battle;
    if (!b) return;
    if (e.type === 'noTarget') hud.noTarget(e.slot, e.reason);
    else if (e.type === 'skillCast' || e.type === 'skillTick' || e.type === 'chain' || e.type === 'shieldHit') skillFx(fx, e);
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
      const quick = (QUICK_SLOTS.keys as readonly string[]).indexOf(e.code);
      if (quick >= 0 && battle && !app.loop.paused) {
        useQuickSlot(battle, quick);
        return;
      }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && battle && !app.loop.paused) {
        syncBattleInput(app.input, battle);
        useBootDash(battle);
        return;
      }
      if (e.code === 'Escape') {
        app.loop.paused = !app.loop.paused;
        confirmUntil = 0;
      }
      else if (/^Digit[1-4]$/.test(e.code) && battle && !app.loop.paused) hud.useSlot(Number(e.code.slice(5)) - 1);
      else if (e.code === 'KeyR' && battle && !app.loop.paused) hud.useSlot(PROGRESSION.signatureSlot);
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
      for (const h of b.hazards) drawHazard(ctx, h, app.time);
      if (b.portal) drawPortal(ctx, b.portal.pos, b.portal.radius, app.time, portalActive(b));
      for (const p of b.pickups) drawPickup(ctx, p, b, app.time);
      for (const o of b.manaOrbs) drawManaOrb(ctx, o, app.time);
      for (const tr of b.traps) drawTrap(ctx, tr, b);
      for (const p of b.projectiles) drawProjectile(ctx, p, app.time);
      for (const e of b.enemies) {
        if (e.boss) drawBoss(ctx, e, b, app.time);
        else drawEnemy(ctx, e, b, app.time);
      }
      const allyColor = heroColor(b.hero.classId, b.hero.promotion) ?? '#b08a5a';
      for (const a of b.allies) drawAlly(ctx, a, allyColor, app.time, b.time);
      for (const c of b.charges) {
        const to = b.input.aim ?? b.input.cursor;
        if (c.kind === 'aimedShot' && to) drawAimLine(ctx, b.hero.pos, to, Math.min(1, c.time / c.delay));
      }
      if (b.input.control === 'player' && !b.hero.dead) drawAttackArc(ctx, b.hero);
      drawHero(ctx, b.hero, b, app.time, fx.lungeOffset());
      if (!b.hero.dead) drawAttackReady(ctx, b.hero, app.time);
      fx.drawCones(ctx);
      fx.drawSlashes(ctx);
      fx.drawRings(ctx);
      fx.drawBolts(ctx);
      fx.drawParticles(ctx);
      drawWeather(ctx, b, app.time);
      // Telegraphs always above effects (and weather) so they stay readable.
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
        drawControls(ctx, W / 2 - 70, PAUSE_PANEL.y + 54, 12, 21, THEME.textDim);
        const confirming = app.time < confirmUntil;
        abandonBtn.label = confirming ? 'Точно? Клацніть ще раз' : 'Завершити забіг (поразка)';
        pauseButtons.draw(ctx);
      }
      hud.drawOverlay(ctx, b);
    },
  };
}

const TELEGRAPH_FIRE_COLOR: Record<string, string> = {
  roots: '#7a5230',
  stomp: '#a07a4c',
  lightning: '#fff3a8',
  gust: '#9fe3ff',
  burrow: '#c9a36b',
  sting: '#e07a3a',
  tongue: '#d86b8f',
  ram: '#bfe6ff',
  iceSpikes: '#d8f0ff',
  frostNova: '#9fd8ff',
};

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
    case 'wave': {
      const color = e.bonus > 0 ? THEME.accent : THEME.text;
      if (e.weather) {
        const w = WEATHER[e.weather];
        fx.showBanner(`Хвиля ${e.index} · ${w.name}: ${w.description}`, '#9fd3ff');
      } else if (e.index > 1) {
        fx.showBanner(`Хвиля ${e.index} · шкода ворогів ×${e.mult.damage.toFixed(1)}, швидкість ×${e.mult.speed.toFixed(2)}`, color);
      } else fx.showBanner(`Хвиля ${e.index}`, color);
      break;
    }
    case 'weatherEnd':
      fx.text({ x: b.hero.pos.x, y: b.hero.pos.y - 44 }, 'Погода прояснилась', '#9fd3ff', 15, 1.6);
      break;
    case 'trapSnap':
      fx.text({ x: e.pos.x, y: e.pos.y - 30 }, 'Пастка!', '#ff9a5e', 16, 1.2);
      fx.burst(e.pos, P.telegraph, '#b8b2a6');
      fx.shake(FX.shake.heroHurtBig);
      break;
    case 'heroDodge':
      fx.lineBurst(e.from, e.to, P.chargeTrail, '#bfe8ff');
      break;
    case 'bossShout':
      fx.showBanner(e.text, THEME.bad);
      fx.text({ x: e.pos.x, y: e.pos.y - 56 }, e.text, THEME.bad, 18, 1.4);
      fx.shake(FX.shake.telegraph);
      break;
    case 'bossCombo':
      fx.text({ x: e.pos.x, y: e.pos.y - 48 }, 'Комбо!', THEME.bad, 17, 1);
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
    case 'pickupSpawn':
      fx.burst(e.pos, P.spawn, PICKUPS[e.kind].color);
      break;
    case 'healUse': {
      // In the item's own colour: green / red / white herb, potion colours.
      const c = CONSUMABLES[e.id];
      fx.text({ x: e.pos.x + T.heroSideOffset, y: e.pos.y - 30 }, `${c.name}: +${Math.round(e.total)} HP за ${e.duration} с`, c.color, 14, 1.6);
      fx.ring(e.pos, 34, c.color, 0.6, 4);
      fx.burst(e.pos, P.levelUp, c.color);
      break;
    }
    case 'breakSkipped':
      fx.text({ x: e.pos.x, y: e.pos.y - 46 }, `Перезарядка −${Math.ceil(e.seconds)} с`, '#8fd3ff', 15, 1.4);
      break;
    case 'pickup': {
      const def = PICKUPS[e.kind];
      const text = def.effect.kind === 'stash' ? `+${def.name}` : `${def.name}! +${Math.round(def.effect.attackSpeed * 100)}% швидкості атаки`;
      fx.text({ x: e.pos.x, y: e.pos.y - 24 }, text, def.color, 15, 1.8);
      fx.ring(e.pos, 40, def.color, 0.5, 4);
      fx.burst(e.pos, P.levelUp, def.color);
      break;
    }
    case 'portalOpen':
      fx.showBanner(`Портал відкрито на ${e.seconds} с!`, '#b98cff');
      fx.ring(e.pos, 80, '#b98cff', 0.8, 6);
      fx.burst(e.pos, P.levelUp, '#b98cff');
      break;
    case 'levelUp':
      fx.ring(b.hero.pos, FX.levelUpRing.radius, THEME.accent, FX.levelUpRing.life, 6);
      fx.burst(b.hero.pos, P.levelUp, THEME.accent);
      fx.text({ x: b.hero.pos.x, y: b.hero.pos.y - 40 }, `Рівень ${e.level}!  +${e.hp} HP, +${e.attack} атаки`, THEME.accent, 16, 1.6);
      break;
    case 'heroDodged':
      fx.text({ x: e.pos.x - T.heroSideOffset, y: e.pos.y - 22 }, 'Ухилення!', '#9fdf7a', 14, 0.8);
      break;
    case 'manaShield':
      fx.ring(e.pos, 26, '#4aa3ff', 0.25, 3);
      if (e.empty) fx.text({ x: e.pos.x, y: e.pos.y - 44 }, 'Мана скінчилась', '#4aa3ff', 14, 1.2);
      break;
    case 'manaPickup':
      fx.text({ x: e.pos.x, y: e.pos.y - 20 }, `+${Math.round(e.amount)} мани`, '#7fc4ff', 14, 1);
      fx.burst(e.pos, P.spark, '#4aa3ff');
      break;
    case 'allyDeath':
      fx.burst(e.pos, P.death, '#b08a5a');
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
    case 'telegraphFire': {
      const color = TELEGRAPH_FIRE_COLOR[e.kind] ?? '#c9a36b';
      fx.burst(e.pos, P.telegraph, color);
      fx.ring(e.pos, e.radius, e.kind === 'lightning' ? '#fff3a8' : '#e5534b', 0.3, 5);
      if (e.kind === 'lightning') fx.screenFlash('#fff8d0', 0.25);
      // Stomps of ordinary enemies are frequent: no screen shake for them.
      if (e.kind !== 'stomp') fx.shake(FX.shake.telegraph);
      break;
    }
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
  } else if (d.kind === 'cactus') {
    // Column with two arms.
    const h = d.size * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(4, h * 0.45, d.size * 0.5, d.size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5e8f3a';
    ctx.fillRect(-d.size * 0.18, -h * 0.55, d.size * 0.36, h);
    ctx.fillRect(-d.size * 0.55, -h * 0.15, d.size * 0.37, d.size * 0.16);
    ctx.fillRect(-d.size * 0.55, -h * 0.45, d.size * 0.16, h * 0.32);
    ctx.fillRect(d.size * 0.18, -h * 0.05, d.size * 0.3, d.size * 0.16);
    ctx.fillRect(d.size * 0.32, -h * 0.35, d.size * 0.16, h * 0.32);
  } else if (d.kind === 'reeds') {
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * d.size * 0.22;
      const h = d.size * (0.8 + 0.3 * Math.sin(d.rot + i * 1.7));
      ctx.beginPath();
      ctx.moveTo(x, d.size * 0.4);
      ctx.lineTo(x + Math.sin(d.rot + i) * 3, -h);
      ctx.stroke();
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(x + Math.sin(d.rot + i) * 3 - 2, -h, 4, d.size * 0.25);
    }
  } else if (d.kind === 'crystal') {
    ctx.rotate(d.rot * 0.3);
    ctx.fillStyle = 'rgba(200, 230, 255, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    for (const [dx, h, w] of [[0, 1.1, 0.3], [-0.35, 0.7, 0.22], [0.35, 0.8, 0.22]] as const) {
      ctx.beginPath();
      ctx.moveTo(d.size * dx - d.size * w, d.size * 0.3);
      ctx.lineTo(d.size * dx, -d.size * h);
      ctx.lineTo(d.size * dx + d.size * w, d.size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
    // Charging a shot: growing glow tells the player to sidestep; a volley glows bigger.
    const k = 1 - e.attackTimer / FX.shooterWindup;
    const volley = nextShotIsVolley(e);
    ctx.globalAlpha = 0.25 + 0.5 * k;
    ctx.fillStyle = volley ? '#ff8fd8' : FX.shooterWindupColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.1 + (volley ? 1.1 : 0.6) * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.archetype === 'fast' && e.windup > 0) {
    // Crouching before a leap: a dashed line shows where it will jump.
    const def = getEnemyDef(e.defId);
    const len = def.dash ? e.speed * def.dash.speedMult * def.dash.duration : 0;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ff5a4a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(e.dashDir.x * len, e.dashDir.y * len);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.scale(1.15, 0.8);
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
  drawElementalStatus(ctx, e, t);
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
  drawHealing(ctx, h, t);
  drawShieldBubble(ctx, h, t);
  for (const buff of h.buffs) {
    if (buff.attackSpeedMult > 1) {
      ctx.strokeStyle = 'rgba(255, 120, 60, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, t * 5, t * 5 + Math.PI * 1.2);
      ctx.stroke();
    }
    if ((buff.damageMult ?? 1) > 1) {
      // Skip-card buff: pulsing green-gold aura.
      ctx.strokeStyle = `rgba(150, 230, 110, ${0.5 + 0.3 * Math.sin(t * 8)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
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
  if ((h.statuses.root?.time ?? 0) > 0) {
    // Caught in a trap: steel jaws around the feet.
    ctx.strokeStyle = '#c9c3b6';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2) * 0.6 + 4);
      ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9) * 0.6 + 4);
      ctx.stroke();
    }
  }
  if ((h.statuses.poison?.time ?? 0) > 0) {
    // Poisoned: green bubbles rising.
    ctx.fillStyle = 'rgba(150, 230, 90, 0.85)';
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.5 + i * 0.25) % 1;
      ctx.beginPath();
      ctx.arc((i - 1.5) * 7, -r - ph * 18, 2.5 * (1 - ph) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if ((h.statuses.slow?.time ?? 0) > 0) {
    // Slowed: icy-blue dashed ring.
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 15, -t * 2, -t * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
  ctx.strokeStyle = heroColor(h.classId, h.promotion) ?? '#1b1e27';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Enemy projectile colours by kind (spores by default). */
const ENEMY_SHOT_COLORS: Record<string, string> = { gale: '#9fe3ff', spike: '#9fdf6a', snow: '#f4f8ff', acid: '#b6f04a', venom: '#a6e05a', iceShard: '#bfe6ff' };

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number): void {
  if (p.team === 'hero' && (drawClassProjectile(ctx, p, t) || drawBranchProjectile(ctx, p))) return;
  if (p.team === 'enemy') {
    ctx.fillStyle = ENEMY_SHOT_COLORS[p.kind] ?? '#d86bf0';
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(p.pos.x - 1.5, p.pos.y - 1.5, p.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind.startsWith('axe')) {
    // Spinning thrown axe.
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(p.life * 25);
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-p.radius, 0);
    ctx.lineTo(p.radius, 0);
    ctx.stroke();
    ctx.fillStyle = p.kind.endsWith('Crit') ? '#ffd23f' : '#d8dde8';
    ctx.beginPath();
    ctx.moveTo(p.radius * 0.6, 0);
    ctx.quadraticCurveTo(p.radius * 1.2, -p.radius, p.radius * 0.2, -p.radius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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
  if (drawClassZone(ctx, z, t) || drawBranchZone(ctx, z, t)) return;
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
  } else if (z.kind === 'earthquake') {
    ctx.globalAlpha = 0.35 * life + 0.1;
    ctx.strokeStyle = '#c9a36b';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, z.radius * (0.4 + 0.3 * i), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#c9a36b';
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();
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

/** A mana orb for the Mage: a pulsing blue drop that fades before it disappears. */
function drawManaOrb(ctx: CanvasRenderingContext2D, o: ManaOrb, t: number): void {
  const fade = Math.min(1, (o.life - o.time) / 1.5);
  const r = 7 + Math.sin(t * 6 + o.id) * 1.2;
  ctx.save();
  ctx.globalAlpha = 0.35 * fade;
  ctx.fillStyle = '#4aa3ff';
  ctx.beginPath();
  ctx.arc(o.pos.x, o.pos.y, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#7fc4ff';
  ctx.beginPath();
  ctx.arc(o.pos.x, o.pos.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.arc(o.pos.x - 2, o.pos.y - 2, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A plant growing out of the ground; pulses when it can be picked up. */
function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, b: Battle, t: number): void {
  const def = PICKUPS[p.kind];
  const grow = Math.min(1, (b.time - p.spawnedAt) / PICKUP_SPAWN.growTime);
  const ready = pickupReady(b, p);
  const r = PICKUP_SPAWN.radius;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  if (ready) {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.6, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(grow, grow);
  if (def.effect.kind === 'stash') drawConsumableIcon(ctx, def.effect.consumable, 0, -r * 0.3, r * 2.4);
  else {
    ctx.fillStyle = '#3f7a32';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    for (const [bx, by] of [[-0.4, -0.3], [0.35, -0.2], [0, 0.3], [-0.1, -0.6]] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(bx * r, by * r, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
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
  // Barrier: a light band over the bar (its length = absorb / max HP).
  const shield = heroShield(h);
  if (shield > 0) {
    ctx.fillStyle = 'rgba(200, 235, 255, 0.85)';
    ctx.fillRect(x, y, B.width * Math.min(1, shield / h.maxHp), B.height / 2);
  }
  // Mage: the mana shield as a blue bar right under the HP bar.
  if (h.stats.manaMax > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y + B.height + 1, B.width + 2, 4);
    ctx.fillStyle = '#4aa3ff';
    ctx.fillRect(x, y + B.height + 2, B.width * Math.max(0, h.mana / h.stats.manaMax), 2);
  }
  drawText(ctx, `${Math.ceil(h.hp)}/${h.maxHp}${shield > 0 ? ` +${Math.ceil(shield)}` : ''}`, h.pos.x, y + B.height + 8, { size: 10, bold: true, align: 'center', color: frac <= B.low ? '#ff6b5e' : THEME.text });
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
  const r = h.stats.ranged ? h.radius * 3 : meleeReach(h);
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

/** Steel snare: faint while arming, then clearly visible jaws. */
function drawTrap(ctx: CanvasRenderingContext2D, tr: Trap, b: Battle): void {
  const r = TRAPS.radius;
  const armed = trapArmed(b, tr);
  ctx.save();
  ctx.translate(tr.pos.x, tr.pos.y);
  ctx.globalAlpha = armed ? 0.95 : 0.1 + 0.35 * Math.min(1, (b.time - tr.spawnedAt) / TRAPS.armTime);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, r * 1.1, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8b2a6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Teeth.
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = -r * 0.8 + (i / 6) * r * 1.6;
    ctx.moveTo(x, -r * 0.5);
    ctx.lineTo(x + 2, -r * 0.1);
    ctx.moveTo(x, r * 0.5);
    ctx.lineTo(x + 2, r * 0.1);
  }
  ctx.stroke();
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Weather of an event wave: fog leaves a clear circle around the hero, rain and storm streak the arena. */
function drawWeather(ctx: CanvasRenderingContext2D, b: Battle, t: number): void {
  const w = b.weather;
  if (!w) return;
  const def = WEATHER[w.id];
  ctx.save();
  ctx.beginPath();
  ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  ctx.clip();
  if (def.visionRadius > 0) {
    const h = b.hero.pos;
    const g = ctx.createRadialGradient(h.x, h.y, def.visionRadius * 0.55, h.x, h.y, def.visionRadius * 1.35);
    g.addColorStop(0, 'rgba(190, 200, 205, 0)');
    g.addColorStop(1, 'rgba(170, 180, 186, 0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  } else {
    const storm = w.id === 'storm';
    ctx.fillStyle = storm ? 'rgba(10, 14, 30, 0.28)' : 'rgba(20, 30, 50, 0.18)';
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.strokeStyle = 'rgba(170, 200, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = storm ? 70 : 110;
    for (let i = 0; i < n; i++) {
      // Deterministic streaks falling down-left.
      const x = ARENA.x + ((i * 97.3 + t * 260) % (ARENA.w + 60)) - 30;
      const y = ARENA.y + ((i * 53.7 + t * 620) % ARENA.h);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 14);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Active herb / potion healing: a soft aura and small crosses rising around the hero,
 * in the colour of the item (so you see which one is working).
 */
function drawHealing(ctx: CanvasRenderingContext2D, h: Hero, t: number): void {
  const r = h.radius;
  let k = 0;
  for (const buff of h.buffs) {
    if (!buff.id.startsWith('heal:')) continue;
    const id = buff.id.split(':')[1] as ConsumableId;
    const color = CONSUMABLES[id]?.color ?? '#6fd16f';
    ctx.save();
    const grad = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r + 16 + k * 4);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, color);
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 6 + k);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r + 16 + k * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      // Each cross rises and fades over a second, staggered.
      const phase = (t * 0.9 + i / 6 + k * 0.13) % 1;
      const a = (i / 6) * Math.PI * 2 + k;
      const x = Math.cos(a) * (r + 8);
      const y = Math.sin(a) * (r * 0.6) - phase * 34;
      ctx.globalAlpha = 1 - phase;
      ctx.beginPath();
      ctx.moveTo(x - 4.5, y);
      ctx.lineTo(x + 4.5, y);
      ctx.moveTo(x, y - 4.5);
      ctx.lineTo(x, y + 4.5);
      ctx.stroke();
    }
    ctx.restore();
    k++;
  }
}
