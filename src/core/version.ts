// Version comparison and "what is new since the player's last visit".

/** Compares dotted versions numerically: -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number(x) || 0);
  const pb = b.split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Entries newer than `lastSeen` (null: never saw any → everything after `base`), newest first. */
export function unseenUpdates<T extends { version: string }>(entries: readonly T[], lastSeen: string | null, base: string): T[] {
  const since = lastSeen ?? base;
  return entries.filter((e) => compareVersions(e.version, since) > 0).sort((x, y) => compareVersions(y.version, x.version));
}
