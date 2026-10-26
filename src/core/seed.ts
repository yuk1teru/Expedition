// Seed resolution. The URL is passed in, so logic never touches window.

export const MAX_SEED = 2_147_483_647;

export function randomSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * (MAX_SEED - 1));
}

/** Reads `?seed=` from a URL string; falls back to a random seed. */
export function resolveSeed(url: string, random: () => number = Math.random): number {
  let raw: string | null = null;
  try {
    raw = new URL(url, 'http://localhost/').searchParams.get('seed');
  } catch {
    raw = null;
  }
  if (raw !== null && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isSafeInteger(n)) return n % (MAX_SEED + 1);
  }
  return randomSeed(random);
}

/** `?slice=1` starts the vertical-slice world (town, grove, boss lair) instead of the full one. */
export function resolveWorldKind(url: string): 'full' | 'slice' {
  try {
    return new URL(url, 'http://localhost/').searchParams.get('slice') === '1' ? 'slice' : 'full';
  } catch {
    return 'full';
  }
}
