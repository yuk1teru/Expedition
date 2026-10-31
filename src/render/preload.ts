// Loads every picture of the rework before the game shows (VISION §10): until a sheet loads, its
// figure is drawn by code — the old shapes — and that flashes on screen. The title screen starts
// the loading, the rework screen waits for it with a progress bar. Each picture is decoded too,
// so the first frame that draws it does not stall.

import { BEAST_SHEETS, LUMBERJACK_SHEET } from '../data/beastAnim';
import { ENAT_FX, FOREST_ART, ITEM_ART, LAIR_ART, SIGN_ART, TELEGRAPH_ART, WEB_ART } from '../data/forestArt';
import { ATTACK_FX, HERO_ANIM, HERO_FX, HERO_SHEETS } from '../data/heroAnim';
import { loadSheet } from './heroAnim';

/** The Forest's scene on the map and the Old Enat's ghost (drawn straight from their files). */
const EXTRA = ['sprites/forest-scene.jpg', 'sprites/anim/enat-ghost.png'];

/** Every picture the rework draws. */
export function spriteSources(): string[] {
  const out = new Set<string>([
    ...Object.values(HERO_SHEETS).map((s) => s.src),
    HERO_ANIM.fxSheet,
    HERO_FX.src,
    ...Object.values(ATTACK_FX.sheets).map((s) => s.src),
    ...Object.values(BEAST_SHEETS).map((s) => s.src),
    LUMBERJACK_SHEET.src,
    FOREST_ART.props,
    FOREST_ART.ground,
    LAIR_ART.props,
    LAIR_ART.ground!,
    ENAT_FX.props,
    WEB_ART.src,
    ITEM_ART.src,
    ITEM_ART.spore.src,
    TELEGRAPH_ART.src,
    SIGN_ART.src,
    ...EXTRA,
  ]);
  return [...out];
}

let started = false;
let done = 0;
let total = 0;

/** Starts loading (once); safe to call again. */
export function preloadSprites(): void {
  if (started || typeof Image === 'undefined') return;
  started = true;
  const srcs = spriteSources();
  total = srcs.length;
  for (const src of srcs) {
    // The same cache the game draws from: once loaded, the game has it.
    const img = loadSheet(src)!;
    const finish = (): void => {
      done += 1;
    };
    img.decode().then(finish, finish);
  }
}

/** How much is loaded, 0–1 (1 — all, or nothing to load). */
export function preloadProgress(): number {
  return total === 0 ? (started ? 1 : 0) : done / total;
}
