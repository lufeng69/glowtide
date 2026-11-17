// rng.js — seeded deterministic randomness (mulberry32) + small helpers.
// GLOWTIDE uses one seeded stream per run so ?shot= modes render identically.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) { return min + next() * (max - min); },
    // integer in [min, max]
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // pick one element
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // Fisher-Yates shuffle, returns a new array
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    chance(p) { return next() < p; },
  };
}

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
