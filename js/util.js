// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// Small math, seeded randomness and value noise (genscape's own: a hashed lattice with smoothstep).
'use strict';

/** A seeded mulberry32 generator, as genscape's rng.ts. Returns () => [0, 1). */
function makeRng(s) {
  let a = s >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RU = {
  u: (r, a, b) => a + (b - a) * r(),
  i: (r, a, b) => a + Math.floor(r() * (b - a)), // b exclusive
  n(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); },
  pick: (r, arr) => arr[Math.floor(r() * arr.length)],
  bell: r => (r() + r() + r()) / 3, // close to genscape's Beta(1.8, 1.8) bunching
  sign: r => (r() < 0.5 ? -1 : 1),
};

/** Integer lattice hash to [0, 1). */
function hash2(ix, iz, s) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** 2D value noise in [0, 1], smoothstep between lattice points. */
function vnoise(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
/** Fractal sum of value noise in [0, 1]. */
function fbm(x, z, s, oct) {
  let sum = 0, amp = 1, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(x * f, z * f, s + o * 31); tot += amp; amp *= 0.5; f *= 2; }
  return sum / tot;
}
/** Ridged noise in [0, 1]: sharp crease peaks, as visual-interest's |n1 + 0.5 n2| ridges. */
function ridged(x, z, s, oct) {
  let sum = 0, amp = 1, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) { const n = vnoise(x * f, z * f, s + o * 17); sum += amp * (1 - Math.abs(2 * n - 1)); tot += amp; amp *= 0.55; f *= 2.1; }
  return sum / tot;
}
/** Smooth 1D noise in [-1, 1]. */
function noise1(t, s) { return vnoise(t, 0.37, s) * 2 - 1; }

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function angleDiff(a, b) { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
/** A three.js colour from a 0-255 grey value (colour management is off: values pass straight through). */
function grey(v) { const c = clamp(v, 0, 255) / 255; return new THREE.Color(c, c, c); }
/** Frame-rate independent smoothing factor. */
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
