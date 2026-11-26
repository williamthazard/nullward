// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// The world from a seed: the route is laid first (a spine of crossing pieces from the first
// stone to the spire, each gap sized from the jump's own constants), then the terrain around
// it, the places off it, the spire climb, and genscape's silhouettes scattered in clusters.
// Also the collision queries: a heightfield and yawed boxes.
'use strict';

// ---------------------------------------------------------------------------------------------
// Collision store
const COL = { boxes: [], grid: new Map(), cell: 16, terrain: null };

function colReset() { COL.boxes = []; COL.grid = new Map(); COL.terrain = null; }
/** Add a yawed box: centre (cx, cy, cz), half sizes hx (along yaw), hy, hz, yaw in radians. */
function addBox(b) {
  b.cos = Math.cos(b.yaw || 0); b.sin = Math.sin(b.yaw || 0);
  b.top = b.cy + b.hy; b.bottom = b.cy - b.hy;
  if (b.col === false) return b;
  const ext = Math.abs(b.hx * b.cos) + Math.abs(b.hz * b.sin) + 1, extz = Math.abs(b.hx * b.sin) + Math.abs(b.hz * b.cos) + 1;
  const c = COL.cell;
  for (let gx = Math.floor((b.cx - ext) / c); gx <= Math.floor((b.cx + ext) / c); gx++)
    for (let gz = Math.floor((b.cz - extz) / c); gz <= Math.floor((b.cz + extz) / c); gz++) {
      const k = gx * 73856093 ^ gz * 19349663;
      let list = COL.grid.get(k); if (!list) COL.grid.set(k, list = []); list.push(b);
    }
  COL.boxes.push(b);
  return b;
}
const EMPTY = [];
/** Boxes whose footprint (plus 1 m) covers the point. */
function boxesAt(x, z) {
  const c = COL.cell, k = Math.floor(x / c) * 73856093 ^ Math.floor(z / c) * 19349663;
  return COL.grid.get(k) || EMPTY;
}
/** The point in a box's local frame: [lx, lz]. */
function boxLocal(b, x, z) { const dx = x - b.cx, dz = z - b.cz; return [dx * b.cos + dz * b.sin, -dx * b.sin + dz * b.cos]; }
function insideBox(b, x, y, z, m = 0) {
  if (b.off || y < b.bottom - m || y > b.top + m) return false;
  const l = boxLocal(b, x, z); return Math.abs(l[0]) <= b.hx + m && Math.abs(l[1]) <= b.hz + m;
}
/** Heightfield height, interpolated on the same triangles the mesh draws. */
function terrainH(x, z) {
  const T = COL.terrain; if (!T) return 0;
  let fx = (x - T.x0) / T.cs, fz = (z - T.z0) / T.cs;
  fx = clamp(fx, 0, T.n - 1e-3); fz = clamp(fz, 0, T.n - 1e-3); // beyond the grid, the edge carries on
  const i = Math.floor(fx), j = Math.floor(fz); fx -= i; fz -= j;
  const n1 = T.n + 1, h = T.h, a = h[j * n1 + i], b = h[j * n1 + i + 1], c = h[(j + 1) * n1 + i], d = h[(j + 1) * n1 + i + 1];
  return fz > fx ? a + (d - c) * fx + (c - a) * fz : a + (b - a) * fx + (d - b) * fz;
}
/** The highest ground under (x, z) at or below feetY + stepUp: terrain or a box top. */
function groundAt(x, z, feetY, stepUp = 0.3, edge = 0.15) {
  let h = terrainH(x, z), box = null;
  for (const b of boxesAt(x, z)) {
    if (b.off || b.top > feetY + stepUp || b.top < h) continue;
    const l = boxLocal(b, x, z);
    if (Math.abs(l[0]) <= b.hx + edge && Math.abs(l[1]) <= b.hz + edge) { h = b.top; box = b; }
  }
  return { h, box };
}
/** True when a point is inside any solid (for the camera). */
function solidAt(x, y, z) {
  if (y < terrainH(x, z) + 0.3) return true;
  for (const b of boxesAt(x, z)) if (insideBox(b, x, y, z, 0.25)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Jump reach from the controller's constants: every gap is sized from these, so it can be crossed.
function jumpReach(speed, withFloat, calm) {
  const vj = tune.jump_speed, gu = tune.gravity_up, gd = tune.gravity_down;
  const tUp = vj / gu, h = vj * vj / (2 * gu);
  if (!withFloat) return speed * (tUp + Math.sqrt(2 * h / gd));
  const f = calm ? tune.calm_float_fall : tune.float_fall_max, fg = Math.max(0.01, tune.float_gravity);
  const tAcc = f / fg, dAcc = f * f / (2 * fg);
  const tDown = dAcc >= h ? Math.sqrt(2 * h / fg) : tAcc + (h - dAcc) / f;
  return speed * (tUp + tDown);
}

// ---------------------------------------------------------------------------------------------
/** Build the whole world's data for a seed. No three.js objects are made here. */
function generateWorld(seed) {
  colReset();
  const r = makeRng((seed * 7919 + 13) >>> 0);
  const NS = (seed * 131 + 7) | 0; // noise seed
  const W = {
    seed, spine: [], pieces: [], pathH: null, chasms: [], discs: [], boxes: COL.boxes, vis: [],
    stones: [], cranes: [], critters: [], spikes: [], trees: [], roofs: [], decals: [], hints: [], shrines: [], bell: null, lost: null,
    places: [], gates: [], spire: null, start: null, flats: [],
  };

  // ---- 1. The spine: straight pieces joined by gentle bends --------------------------------
  let x = 0, z = 0, heading = RU.u(r, 0, Math.PI * 2);
  const base = heading;
  W.spine.push({ x, z, h: heading });
  function advance(len, dh) {
    for (let i = 0; i < len; i++) { heading += dh / len; x += Math.cos(heading); z += Math.sin(heading); W.spine.push({ x, z, h: heading }); }
  }
  function piece(type, len, opts = {}) {
    if (W.pieces.length) {
      let dh = RU.u(r, -0.42, 0.42);
      if (Math.abs(angleDiff(base, heading + dh)) > 0.6) dh = -dh * 0.8;
      advance(16, dh);
    }
    const p = Object.assign({ type, s0: W.spine.length - 1, len, heading, ox: x, oz: z }, opts);
    p.s1 = p.s0 + len;
    advance(len, 0); W.pieces.push(p); return p;
  }
  const run = tune.run_speed, top = run + tune.momentum_max;
  const gapShort = Math.round(0.8 * jumpReach(run, false) * 10) / 10;          // a running jump, no float
  const gapFloat = Math.round(0.82 * jumpReach(run, true) * 10) / 10;          // needs the float at run speed
  const gapStrikeAlone = Math.round((jumpReach(top, true) + tune.air_dash_distance + 4.5) * 10) / 10; // only the floater chain
  const gapWallTut = 14, gapWall = Math.round(Math.max(21, jumpReach(top, true) + tune.air_dash_distance + 0.5));
  const gap = (type, w, extra = {}) => piece(type, 18 + w + 16, Object.assign({ gapAt: 18, w }, extra));

  piece('start', 26);
  piece('field', 56);
  piece('vault', 50);
  piece('stone', 12);
  gap('gap', gapShort);
  gap('gapfloat', gapFloat);
  piece('stone', 12);
  gap('wallgap', gapWallTut, { tutorial: true, side: RU.sign(r) });
  gap('sleepy', 14);
  piece('stone', 12);
  piece('hills', 70);
  gap('wallgap', gapWall, { side: RU.sign(r), crawler: true });
  piece('crawlers', 50);
  piece('stone', 12);
  piece('ruins', 72);
  piece('floaters', 80);
  piece('stone', 12);
  gap('floatergap', Math.max(26, gapStrikeAlone));
  piece('hills2', 60);
  piece('plaza', 40);
  const L = W.spine.length;

  // ---- 2. Path height along the spine: rolling, flat across every crossing -----------------
  const ph = new Float32Array(L), pinned = new Uint8Array(L);
  const f1 = RU.u(r, 0, 6.28), f2 = RU.u(r, 0, 6.28);
  for (let s = 0; s < L; s++) ph[s] = 2 + 7 * Math.sin(s / 120 + f1) + 3 * Math.sin(s / 43 + f2);
  for (const p of W.pieces) {
    if (!['gap', 'gapfloat', 'wallgap', 'sleepy', 'floatergap', 'plaza', 'start'].includes(p.type)) continue;
    const a = Math.max(0, p.s0 - 4), b = Math.min(L - 1, p.s1 + 4), v = ph[a];
    for (let s = a; s <= b; s++) { ph[s] = v; pinned[s] = 1; }
  }
  for (let pass = 0; pass < 4; pass++) {
    const src = ph.slice();
    for (let s = 0; s < L; s++) {
      if (pinned[s]) continue;
      let sum = 0, n = 0;
      for (let k = -8; k <= 8; k++) { const q = s + k; if (q >= 0 && q < L) { sum += src[q]; n++; } }
      ph[s] = sum / n;
    }
  }
  W.pathH = ph;
  let BASE = 0; for (let s = 0; s < L; s++) BASE += ph[s]; BASE /= L; // the open land sits around the path's mean height
  const pathAt = s => ph[clamp(Math.round(s), 0, L - 1)];

  // Spine lookup: points hashed in 25 m cells.
  const SC = 25, sh = new Map();
  W.spine.forEach((p, s) => { const k = Math.floor(p.x / SC) * 92821 ^ Math.floor(p.z / SC) * 68917; let l = sh.get(k); if (!l) sh.set(k, l = []); l.push(s); });
  /** Nearest spine point within about 25 m: {d, s}, or d = Infinity. */
  function nearSpine(px, pz) {
    const gx = Math.floor(px / SC), gz = Math.floor(pz / SC);
    let best = Infinity, bs = -1;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = sh.get((gx + i) * 92821 ^ (gz + j) * 68917); if (!l) continue;
      for (const s of l) { const q = W.spine[s], d = (q.x - px) ** 2 + (q.z - pz) ** 2; if (d < best) { best = d; bs = s; } }
    }
    return { d: Math.sqrt(best), s: bs };
  }
  W.nearSpine = nearSpine;
  const coarse = W.spine.filter((_, i) => i % 10 === 0);
  function farSpine(px, pz) { let b = Infinity; for (const q of coarse) b = Math.min(b, (q.x - px) ** 2 + (q.z - pz) ** 2); return Math.sqrt(b); }

  // Piece frame helpers.
  const at = (p, along, lat) => { const c = Math.cos(p.heading), s = Math.sin(p.heading); return { x: p.ox + c * along - s * lat, z: p.oz + s * along + c * lat }; };
  const hAt = (p, along) => pathAt(p.s0 + along);

  // ---- 3. Chasms, discs (places), terrain grid ----------------------------------------------
  const SLAB = 17, CRACK_HALF = 150;
  for (const p of W.pieces) {
    if (p.w === undefined) continue;
    const c = at(p, p.gapAt + p.w / 2, 0);
    p.flat = hAt(p, 0);
    W.chasms.push({ p, cx: c.x, cz: c.z, h: p.heading, w: p.w, flat: p.flat, s: p.s0 + p.gapAt + p.w / 2 });
  }
  // places off the route
  const place = (p, along, side, dist, type, r0, r1, rise = 0) => {
    const c = at(p, along, side * dist);
    const pl = { type, x: c.x, z: c.z, r0, r1, p, side, rise, h: 0 };
    W.places.push(pl); return pl;
  };
  const byType = t => W.pieces.find(p => p.type === t);
  const pv = byType('vault'), phl = byType('hills'), pru = byType('ruins'), pfl = byType('floaters'), ph2 = byType('hills2'), ppl = byType('plaza');
  const plMono = place(pv, 30, RU.sign(r), 11, 'monolith', 6, 10);
  const plCourt = place(phl, 38, RU.sign(r), 46, 'court', 16, 28);
  const plPerch = place(pru, 40, RU.sign(r), 30, 'perch', 8, 16);
  const plMaze = place(pfl, 42, RU.sign(r), 56, 'maze', 22, 32);
  const plLook = place(ph2, 30, RU.sign(r), 62, 'lookout', 7, 30, 14);
  const plBell = place(byType('field'), 30, RU.sign(r), 32, 'bell', 5, 14); // a dead tree with a bell, early, off to one side
  // spire: just past the plaza's end
  const spC = at(ppl, ppl.len + 14, 0), spY = hAt(ppl, 0);
  W.spire = { x: spC.x, z: spC.z, y: spY, heading: ppl.heading };
  const discs = [{ x: spC.x, z: spC.z, h: spY, r0: 30, r1: 46 }];

  // region bounds
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const q of W.spine) { minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x); minz = Math.min(minz, q.z); maxz = Math.max(maxz, q.z); }
  minx = Math.min(minx, spC.x); maxx = Math.max(maxx, spC.x); minz = Math.min(minz, spC.z); maxz = Math.max(maxz, spC.z);
  const cx0 = (minx + maxx) / 2, cz0 = (minz + maxz) / 2;
  const size = Math.max(maxx - minx, maxz - minz) + 900, n = Math.min(440, Math.ceil(size / 5.2));
  const T = { x0: cx0 - size / 2, z0: cz0 - size / 2, cs: size / n, n, h: new Float32Array((n + 1) * (n + 1)), path: new Float32Array((n + 1) * (n + 1)) };
  W.region = { cx: cx0, cz: cz0, R: size / 2 };
  const natural = (px, pz) => Math.max(-9, (ridged(px / 240, pz / 240, NS, 4) - 0.5) * 38 + (fbm(px / 70, pz / 70, NS + 9, 3) - 0.5) * 7 + 4);
  // place heights: the natural ground under them, flattened
  for (const pl of W.places) {
    const q = nearSpine(pl.x, pl.z);
    pl.h = (q.d < 24 ? lerp(pathAt(q.s), natural(pl.x, pl.z) + BASE, smooth(9, 24, q.d)) : natural(pl.x, pl.z) + BASE) + pl.rise;
    if (pl.type === 'monolith') pl.h = hAt(pl.p, 30);
    discs.push({ x: pl.x, z: pl.z, h: pl.h, r0: pl.r0, r1: pl.r1 });
  }
  W.discs = discs;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const px = T.x0 + i * T.cs, pz = T.z0 + j * T.cs, idx = j * (n + 1) + i;
    const q = nearSpine(px, pz), nat = natural(px, pz);
    let h, pathW = 0;
    if (q.s >= 0) {
      const p0 = pathAt(q.s), w = smooth(9, 24, q.d);
      h = lerp(p0, nat + BASE, w); pathW = 1 - smooth(2.5, 5.5, q.d);
    } else h = nat + BASE;
    const rr = Math.hypot(px - cx0, pz - cz0);
    h += smooth(size / 2 * 0.72, size / 2, rr) * 120; // the region's rim rises into mountains
    for (const d of discs) { const dd = Math.hypot(px - d.x, pz - d.z); if (dd < d.r1) h = lerp(h, d.h, smooth(d.r1, d.r0, dd)); }
    for (const c of W.chasms) {
      const dx = px - c.cx, dz = pz - c.cz, a = dx * Math.cos(c.h) + dz * Math.sin(c.h), l = -dx * Math.sin(c.h) + dz * Math.cos(c.h);
      const ownCrossing = q.s >= 0 && Math.abs(q.s - c.s) < c.w / 2 + 30;
      if (Math.abs(l) < 23 && Math.abs(a) < c.w / 2 + SLAB + 1) h = Math.min(h, c.flat - 0.5); // under the rim slabs
      if (Math.abs(a) < c.w / 2 + 8.6 && Math.abs(l) < CRACK_HALF - Math.abs(a) * 0.3 && (q.d > 22 || ownCrossing)) { h = -48; pathW = 0; }
    }
    T.h[idx] = h; T.path[idx] = pathW;
  }
  COL.terrain = T; W.terrain = T;

  // ---- 4. Boxes: route pieces, places, spire ------------------------------------------------
  // vis: drawn as instanced boxes; v = the top face's grey (sides are darker)
  const box = (o) => { const b = addBox(o); if (o.vis !== false) W.vis.push(b); return b; };
  const pbox = (p, along, lat, ha, hl, y0, y1, o = {}) => { const c = at(p, along, lat); return box(Object.assign({ cx: c.x, cz: c.z, cy: (y0 + y1) / 2, hy: (y1 - y0) / 2, hx: ha, hz: hl, yaw: p.heading, v: 30, tag: 'solid' }, o)); };
  const ground = (px, pz) => terrainH(px, pz);
  const stone = (p, along, lat) => { const c = at(p, along, lat); W.stones.push({ x: c.x, z: c.z, y: ground(c.x, c.z), s: p.s0 + along, heading: p.heading, i: W.stones.length }); };

  for (const p of W.pieces) {
    const h0 = hAt(p, 0);
    if (p.w !== undefined) { // a crossing: rim slabs and their lighter edge strips
      const e0 = p.gapAt, e1 = p.gapAt + p.w;
      pbox(p, e0 - SLAB / 2, 0, SLAB / 2, 22, p.flat - 40, p.flat, { v: 17, tag: 'slab' });
      pbox(p, e1 + SLAB / 2, 0, SLAB / 2, 22, p.flat - 40, p.flat, { v: 17, tag: 'slab' });
      pbox(p, e0 - 0.35, 0, 0.35, 22, p.flat - 0.02, p.flat + 0.03, { v: 44, col: false });
      pbox(p, e1 + 0.35, 0, 0.35, 22, p.flat - 0.02, p.flat + 0.03, { v: 44, col: false });
    }
    switch (p.type) {
      case 'start': stone(p, 8, 3.4); W.start = Object.assign(at(p, 3, 0), { heading: p.heading }); break;
      case 'stone': stone(p, 6, RU.sign(r) * 3.2); break;
      case 'plaza': stone(p, 6, RU.sign(r) * 3.4); break;
      case 'vault':
        for (let k = 0; k < 4; k++) {
          const along = 8 + k * 10, ht = RU.u(r, 0.8, 1.2), lat = RU.u(r, -1.2, 1.2);
          pbox(p, along, lat, 0.7, RU.u(r, 3, 4.2), hAt(p, along) - 1, hAt(p, along) + ht, { v: 30, tag: 'ledge' });
        }
        break;
      case 'wallgap': {
        const e0 = p.gapAt, e1 = p.gapAt + p.w, side = p.side, off = 1.8 + 0.8;
        const wall = pbox(p, (e0 + e1) / 2, side * off, p.w / 2 + 4, 0.8, p.flat - 40, p.flat + 7, { v: 26, tag: 'wall' });
        // the pale streak that marks a wall to run, on the face toward the path
        const c = at(p, (e0 + e1) / 2, side * (off - 0.83));
        W.decals.push({ x: c.x, z: c.z, y: p.flat + 1.6, yaw: p.heading, len: p.w + 4, ht: 0.22, face: -side, v: 72 });
        if (p.tutorial) {
          const pts = [];
          for (let k = 0; k <= 24; k++) {
            const t = k / 24, along = lerp(e0 - 3, e1 + 3, t), lat = side * lerp(0, off - 1.25, Math.min(1, t * 6, (1 - t) * 6));
            const pt = at(p, along, lat); pts.push({ x: pt.x, z: pt.z, y: p.flat + 1.0 + Math.sin(t * Math.PI) * 1.2 });
          }
          W.hints.push({ pts, zone: at(p, e0 - 10, 0), r: 14, flat: p.flat });
        }
        if (p.crawler) { const c2 = at(p, e1 + 9, RU.u(r, -1.5, 1.5)); W.critters.push({ kind: 'crawler', x: c2.x, z: c2.z, y: p.flat, s: p.s0 + e1 + 9 }); }
        break;
      }
      case 'sleepy': {
        const c = at(p, p.gapAt + 7, 0);
        W.critters.push({ kind: 'sleepy', x: c.x, z: c.z, y: p.flat + 2.3, anchored: true, harmless: true, s: p.s0 + p.gapAt + 7 });
        break;
      }
      case 'crawlers':
        for (const [along, lat] of [[18, -2], [36, 2.5]]) { const c = at(p, along, lat); W.critters.push({ kind: 'crawler', x: c.x, z: c.z, y: hAt(p, along), s: p.s0 + along }); }
        break;
      case 'ruins': {
        const ledge = (along, ht, hl, lat = 0, tag = 'ledge') => pbox(p, along, lat, 0.8, hl, hAt(p, along) - 1, hAt(p, along) + ht, { v: 28, tag });
        ledge(10, 1.0, 4.5);
        ledge(22, 2.4, 5.5, 0, 'solid');
        ledge(33, 1.2, 4); ledge(35, 2.7, 4, 0, 'solid');
        for (const sd of [-1, 1]) pbox(p, 50, sd * 3.2, 5, 0.7, hAt(p, 50) - 1, hAt(p, 50) + 4.5, { v: 22, tag: 'wall' });
        break;
      }
      case 'floaters':
        for (const along of [22, 56]) for (const sd of [-1, 1]) {
          const c = at(p, along, sd * 2.5);
          W.critters.push({ kind: 'floater', x: c.x, z: c.z, y: hAt(p, along) + 1.6, s: p.s0 + along, phase: sd > 0 ? 0 : Math.PI });
        }
        break;
      case 'floatergap': {
        const n3 = Math.max(3, Math.ceil(p.w / 7) - 1), stepA = p.w / (n3 + 1);
        for (let k = 1; k <= n3; k++) {
          const c = at(p, p.gapAt + stepA * k, RU.u(r, -1, 1));
          W.critters.push({ kind: 'floater', x: c.x, z: c.z, y: p.flat + 2.3 + (k % 2) * 0.5, anchored: true, harmless: true, s: p.s0 + p.gapAt + stepA * k });
        }
        // a crane on a pillar in the chasm, for a float off the last floater
        const sd = RU.sign(r), c = at(p, p.gapAt + stepA * n3 + 1, sd * 6.5);
        box({ cx: c.x, cz: c.z, cy: p.flat - 19.5, hy: 20.5, hx: 1.1, hz: 1.1, yaw: p.heading, v: 30, tag: 'solid' });
        W.cranes.push({ x: c.x, z: c.z, y: p.flat + 1.0 + 0.6 });
        break;
      }
      case 'hills2':
        for (const sd of [-1, 1]) { const c = at(p, 30, sd * 2.5); W.critters.push({ kind: 'crawler', x: c.x, z: c.z, y: hAt(p, 30), s: p.s0 + 30 }); }
        break;
    }
  }

  // places
  for (const pl of W.places) {
    const yaw = Math.atan2(pl.z - W.spine[pl.p.s0].z, pl.x - W.spine[pl.p.s0].x);
    if (pl.type === 'monolith') { // stepping blocks up to a crane
      const fwd = pl.p.heading, c = Math.cos(fwd), s = Math.sin(fwd);
      const blk = (o, hh, half, v) => box({ cx: pl.x + c * o, cz: pl.z + s * o, cy: pl.h + hh / 2 - 0.5, hy: hh / 2 + 0.5, hx: half, hz: half, yaw: fwd, v, tag: hh > 3 ? 'wall' : 'ledge' });
      blk(-2.6, 1.3, 1.2, 30); blk(0, 2.9, 1.3, 28); blk(2.6, 4.5, 1.25, 26);
      W.cranes.push({ x: pl.x + c * 2.6, z: pl.z + s * 2.6, y: pl.h + 4.5 + 0.6 });
      W.lost = { x: pl.x - c * 2.4 + s * 2.2, z: pl.z - s * 2.4 - c * 2.2, y: pl.h }; // a lost little spirit, curled up by the blocks
    } else if (pl.type === 'court') { // a ring of ruin slabs around a crane on a plinth
      const k = 11;
      for (let i = 0; i < k; i++) {
        if (i === 3 || i === 8) continue; // gaps to walk in
        const a = (i / k) * Math.PI * 2 + RU.u(r, -0.1, 0.1), hh = RU.u(r, 1.4, 4.6), wdt = RU.u(r, 1.4, 2.6);
        box({ cx: pl.x + Math.cos(a) * 11, cz: pl.z + Math.sin(a) * 11, cy: pl.h + hh / 2 - 0.5, hy: hh / 2 + 0.5, hx: 0.6, hz: wdt, yaw: a, v: 20, tag: hh > 2.6 ? 'wall' : 'ledge' });
        if (r() < 0.3) W.roofs.push({ x: pl.x + Math.cos(a) * 11, z: pl.z + Math.sin(a) * 11, y: pl.h + hh, w: wdt, yaw: a });
      }
      box({ cx: pl.x, cz: pl.z, cy: pl.h + 0.3, hy: 0.8, hx: 0.9, hz: 0.9, yaw: 0, v: 34, tag: 'ledge' });
      W.cranes.push({ x: pl.x, z: pl.z, y: pl.h + 1.1 + 0.6 });
      W.shrines.push({ x: pl.x + 3.2, z: pl.z + 1.2, y: pl.h, needsSpirit: true, place: 'court' }); // lit by bringing the lost spirit home
    } else if (pl.type === 'perch') { // three blocks rising to a crane on a column
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const blk = (o, hh, half) => box({ cx: pl.x + c * o, cz: pl.z + s * o, cy: pl.h + hh / 2 - 0.5, hy: hh / 2 + 0.5, hx: half, hz: half, yaw, v: 24, tag: 'wall' });
      blk(-3.4, 2.2, 1.6); blk(-0.4, 4.4, 1.3); blk(2.2, 6.6, 1.0);
      W.cranes.push({ x: pl.x + c * 2.2, z: pl.z + s * 2.2, y: pl.h + 6.6 + 0.6 });
      W.roofs.push({ x: pl.x + c * 2.2, z: pl.z + s * 2.2, y: pl.h + 6.6, w: 1.0, yaw });
    } else if (pl.type === 'maze') { // a small maze of spike thickets, a crane at its heart
      const N = 5, cs = 5, half = N * cs / 2, mr = makeRng((seed * 31 + 5) >>> 0);
      const seen = new Uint8Array(N * N), walls = [];
      for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { walls.push({ h: true, i, j, on: true }); walls.push({ h: false, i, j, on: true }); }
      const wallOf = (hz, i, j) => walls.find(w => w.h === hz && w.i === i && w.j === j);
      const stack = [[0, 0]]; seen[0] = 1;
      while (stack.length) { // depth-first maze
        const [ci, cj] = stack[stack.length - 1];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [ci + a, cj + b, a, b]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[b * N + a]);
        if (!nb.length) { stack.pop(); continue; }
        const [ni, nj, a, b] = RU.pick(mr, nb);
        if (a !== 0) wallOf(false, Math.max(ci, ni), cj).on = false; else wallOf(true, Math.max(cj, nj), ci).on = false;
        seen[nj * N + ni] = 1; stack.push([ni, nj]);
      }
      wallOf(false, 0, 0).on = false; // the way in
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const w of walls) {
        if (!w.on) continue;
        let lx, lz, hx, hz;
        if (w.h) { lx = -half + (w.j + 0.5) * cs; lz = -half + w.i * cs; hx = cs / 2 + 0.3; hz = 0.3; } // wall along x at row i
        else { lx = -half + w.i * cs; lz = -half + (w.j + 0.5) * cs; hx = 0.3; hz = cs / 2 + 0.3; }
        if (w.h && w.i === N) continue;
        if (!w.h && w.i === N) continue;
        const wx = pl.x + lx * c - lz * s, wz = pl.z + lx * s + lz * c;
        box({ cx: wx, cz: wz, cy: pl.h + 1.4, hy: 2.0, hx, hz, yaw, v: 8, tag: 'solid', thicket: true });
        const len = Math.max(hx, hz) * 2, cnt = Math.round(len * 3.2);
        for (let k = 0; k < cnt; k++) {
          const t = (k + mr()) / cnt - 0.5, ox = hx > hz ? t * len : RU.u(mr, -0.3, 0.3), oz = hx > hz ? RU.u(mr, -0.3, 0.3) : t * len;
          W.spikes.push({ x: wx + ox * c - oz * s, z: wz + ox * s + oz * c, y: pl.h - 0.2, h: RU.u(mr, 2.6, 5.2), w: RU.u(mr, 0.18, 0.4), tx: RU.u(mr, -0.2, 0.2), tz: RU.u(mr, -0.2, 0.2), v: RU.i(mr, 3, 12) });
        }
      }
      // close the far and right edges
      for (const [lx, lz, hx, hz] of [[0, half, half + 0.3, 0.3], [half, 0, 0.3, half + 0.3]]) {
        box({ cx: pl.x + lx * c - lz * s, cz: pl.z + lx * s + lz * c, cy: pl.h + 1.4, hy: 2.0, hx, hz, yaw, v: 8, tag: 'solid', thicket: true });
      }
      const ctr = -half + (Math.floor(N / 2) + 0.5) * cs;
      W.cranes.push({ x: pl.x + ctr * c - ctr * s, z: pl.z + ctr * s + ctr * c, y: pl.h + 0.6 });
      const sx = ctr + 1.4, sz = ctr - 1.2;
      W.shrines.push({ x: pl.x + sx * c - sz * s, z: pl.z + sx * s + sz * c, y: pl.h, place: 'maze' });
    } else if (pl.type === 'bell') { // a dead tree; a bell hangs from its one branch
      const ty = pl.h, a = r() * Math.PI * 2;
      box({ cx: pl.x, cz: pl.z, cy: ty + 2.2, hy: 2.4, hx: 0.22, hz: 0.22, yaw: a, v: 14, tag: 'solid', vis: false });
      W.bell = { x: pl.x + Math.cos(a) * 1.25, z: pl.z + Math.sin(a) * 1.25, y: ty + 2.3, tx: pl.x, tz: pl.z, ty, a };
    } else if (pl.type === 'lookout') {
      W.cranes.push({ x: pl.x, z: pl.z, y: pl.h + 0.6 });
      W.shrines.push({ x: pl.x - 2.4, z: pl.z + 1.4, y: pl.h, place: 'lookout' });
      box({ cx: pl.x + 2, cz: pl.z, cy: pl.h + 1.2, hy: 1.8, hx: 0.35, hz: 0.35, yaw: 0.3, v: 26, tag: 'solid' }); // a marker post
    }
  }

  // ---- 5. The spire: a ring wall with a gate, a spiral climb, the needle ----------------------
  {
    const S = W.spire, C = { x: S.x, z: S.z }, y0 = S.y, appr = S.heading + Math.PI; // the gate faces the approach
    const ringH = 6, RH = 14;
    const ca = Math.cos(S.heading), sa = Math.sin(S.heading);
    const loc = (a, l) => ({ x: C.x + ca * a - sa * l, z: C.z + sa * a + ca * l });
    // the ring wall: four sides, the near side split around a 4 m gate
    const rw = (a, l, hx, hz) => { const q = loc(a, l); return box({ cx: q.x, cz: q.z, cy: y0 + ringH / 2 - 0.5, hy: ringH / 2 + 0.5, hx, hz, yaw: S.heading, v: 20, tag: 'solid', spire: true }); };
    rw(RH, 0, 0.6, RH + 0.6); rw(0, RH, RH, 0.6); rw(0, -RH, RH, 0.6);
    rw(-RH, (RH + 2) / 2 + 0.0, 0.6, (RH - 2) / 2); rw(-RH, -(RH + 2) / 2, 0.6, (RH - 2) / 2);
    const gq = loc(-RH, 0);
    const barrier = box({ cx: gq.x, cz: gq.z, cy: y0 + ringH / 2, hy: ringH / 2 + 1, hx: 0.5, hz: 2, yaw: S.heading, v: 4, tag: 'solid', vis: false });
    W.gates.push({ x: gq.x, z: gq.z, y: y0, yaw: S.heading, box: barrier });
    const sq = loc(-RH - 6, 0);
    W.critters.push({ kind: 'sentinel', x: sq.x, z: sq.z, y: y0, s: L - 1, gate: 0 });
    // the column: a collider (drawn by its own pale mesh)
    const colH = 44;
    box({ cx: C.x, cz: C.z, cy: y0 + colH / 2 - 1, hy: colH / 2 + 1, hx: 4, hz: 4, yaw: S.heading, v: 30, tag: 'wall', vis: false });
    // the spiral: 3.2 m steps about 6 m apart rising 2 m; every sixth, a wall to run straight off
    // the spiral (a tangent), the next step at its far end; then the spiral eases back in.
    const steps = [], R0 = 7.8, CHORD = 6.1, topY = y0 + colH;
    let ang = appr + 0.9, R = R0, y = y0 + 1.3, dir = RU.sign(r), px = C.x + Math.cos(ang) * R, pz = C.z + Math.sin(ang) * R;
    const stepBox = (x, z, yy, yaw, i) => box({ cx: x, cz: z, cy: yy - 0.35, hy: 0.35, hx: 1.6, hz: 1.6, yaw, v: 32, tag: 'ledge', spire: true, step: i });
    for (let i = 0; y < topY - 1.5; i++) {
      if (i > 0 && i % 6 === 0) {
        const p0 = steps[i - 1], ox = Math.cos(p0.ang), oz = Math.sin(p0.ang), tx = -oz * dir, tz = ox * dir;
        const wl = 11, wx = p0.x + tx * (1.6 + wl / 2) + ox * 1.45, wz = p0.z + tz * (1.6 + wl / 2) + oz * 1.45; // the wall close enough to run straight onto
        box({ cx: wx, cz: wz, cy: p0.y + 2, hy: 3.2, hx: wl / 2, hz: 0.5, yaw: Math.atan2(tz, tx), v: 24, tag: 'wall', spire: true });
        W.decals.push({ x: wx - ox * 0.53, z: wz - oz * 0.53, y: p0.y + 1.2, yaw: Math.atan2(tz, tx), len: wl - 1, ht: 0.18, faceA: Math.atan2(-oz, -ox), v: 72 });
        px = p0.x + tx * 14.5 - ox * 0.3; pz = p0.z + tz * 14.5 - oz * 0.3; y += 0.6;
        ang = Math.atan2(pz - C.z, px - C.x); R = Math.hypot(px - C.x, pz - C.z);
      } else if (i > 0) {
        const Rn = Math.max(R0, R - 1.6), dth = 2 * Math.asin(Math.min(0.95, CHORD / (R + Rn)));
        ang += dir * dth; R = Rn; y += 2.0;
        px = C.x + Math.cos(ang) * R; pz = C.z + Math.sin(ang) * R;
      }
      const b = stepBox(px, pz, y, ang, i);
      steps.push({ x: px, z: pz, y: b.top, ang });
      if (i === 9) { // a side ledge with a crane, a short hop out
        const ox = C.x + Math.cos(ang) * (R + 4.4), oz = C.z + Math.sin(ang) * (R + 4.4);
        box({ cx: ox, cz: oz, cy: y - 0.25, hy: 0.25, hx: 1.1, hz: 1.1, yaw: ang, v: 32, tag: 'ledge', spire: true });
        W.cranes.push({ x: ox, z: oz, y: y + 0.6 });
      }
    }
    // the crown: a wide top on the column, the goal, within a step of the last one
    box({ cx: C.x, cz: C.z, cy: topY - 0.35, hy: 0.35, hx: 5, hz: 5, yaw: S.heading, v: 40, tag: 'ledge', spire: true, crown: true });
    const lastS = steps[steps.length - 1];
    { // a bridge step between the last spiral step and the crown's edge
      const dx = C.x - lastS.x, dz = C.z - lastS.z, d = Math.hypot(dx, dz), k = Math.max(0, (d - 5 - 1.6 - 2.2) / d);
      if (k > 0) box({ cx: lastS.x + dx * k, cz: lastS.z + dz * k, cy: Math.min(topY, lastS.y + 1.6) - 0.35, hy: 0.35, hx: 1.6, hz: 1.6, yaw: lastS.ang, v: 32, tag: 'ledge', spire: true });
    }
    S.colH = colH; S.topY = topY; S.ringH = ringH; S.RH = RH; S.steps = steps;
  }

  // ---- 6. Scatter: genscape's silhouettes, in clusters with gaps ----------------------------
  const CH = 36, inChasm = (px, pz, m) => W.chasms.some(c => { const dx = px - c.cx, dz = pz - c.cz, a = dx * Math.cos(c.h) + dz * Math.sin(c.h), l = -dx * Math.sin(c.h) + dz * Math.cos(c.h); return (Math.abs(a) < c.w / 2 + m && Math.abs(l) < CRACK_HALF) || (Math.abs(a) < c.w / 2 + SLAB + 1 + m && Math.abs(l) < 23 + m); });
  const inPlace = (px, pz, m = 0) => W.places.some(pl => Math.hypot(px - pl.x, pz - pl.z) < pl.r0 + m) || Math.hypot(px - W.spire.x, pz - W.spire.z) < 36 + m;
  const attractor = (cr, c0, spread) => (cr() < 0.25 ? c0 + RU.u(cr, -0.55, 0.55) * CH : c0 + RU.n(cr) * spread * CH);
  const MAX_SPIKES = 15000, MAX_TREES = 1600;
  const nx = Math.ceil(size / CH);
  for (let gi = 0; gi < nx; gi++) for (let gj = 0; gj < nx; gj++) {
    const ccx = T.x0 + (gi + 0.5) * CH, ccz = T.z0 + (gj + 0.5) * CH;
    const dS = farSpine(ccx, ccz);
    if (dS > 470) continue;
    const cr = makeRng(((seed * 2654435761) ^ (gi * 2246822519) ^ (gj * 3266489917)) >>> 0);
    const near = dS < 70, roll = cr();
    const biome = near ? (roll < 0.55 ? 'spikes' : roll < 0.75 ? 'trees' : roll < 0.86 ? 'ruins' : 'empty')
                       : (roll < 0.42 ? 'spikes' : roll < 0.67 ? 'trees' : roll < 0.8 ? 'ruins' : 'empty');
    if (biome === 'spikes' && W.spikes.length < MAX_SPIKES) {
      const cnt = RU.i(cr, near ? 40 : 18, near ? 80 : 42);
      for (let k = 0; k < cnt; k++) {
        const px = attractor(cr, ccx, 0.22), pz = attractor(cr, ccz, 0.22);
        const q = nearSpine(px, pz), d = q.d;
        if (d < 2.6 || inChasm(px, pz, 1) || inPlace(px, pz, 2)) continue;
        const hh = d < 10 ? RU.u(cr, 0.7, 2.4) : d < 40 ? RU.u(cr, 1.0, 4.6) : RU.u(cr, 1.6, 8.5);
        W.spikes.push({ x: px, z: pz, y: terrainH(px, pz) - 0.25, h: hh, w: 0.08 + hh * RU.u(cr, 0.03, 0.06), tx: RU.u(cr, -0.25, 0.25), tz: RU.u(cr, -0.25, 0.25), v: RU.i(cr, 3, 16) });
      }
    } else if (biome === 'trees' && W.trees.length < MAX_TREES) {
      const cnt = RU.i(cr, 2, 7);
      for (let k = 0; k < cnt; k++) {
        const px = attractor(cr, ccx, 0.25), pz = attractor(cr, ccz, 0.25);
        if (nearSpine(px, pz).d < 8 || inChasm(px, pz, 3) || inPlace(px, pz, 3)) continue;
        const hh = RU.u(cr, 3, 12);
        W.trees.push({ x: px, z: pz, y: terrainH(px, pz) - 0.3, h: hh, w: hh * RU.u(cr, 0.10, 0.22), lean: RU.u(cr, -0.3, 0.3), v: RU.i(cr, 2, 12) });
        if (hh > 5) addBox({ cx: px, cz: pz, cy: terrainH(px, pz) + 1.5, hy: 2, hx: 0.25, hz: 0.25, yaw: 0, tag: 'solid', col: true });
      }
    } else if (biome === 'ruins') {
      const cnt = RU.i(cr, 1, 5);
      for (let k = 0; k < cnt; k++) {
        const px = attractor(cr, ccx, 0.2), pz = attractor(cr, ccz, 0.2);
        if (nearSpine(px, pz).d < 9 || inChasm(px, pz, 4) || inPlace(px, pz, 4)) continue;
        const hh = RU.u(cr, 1.0, 6), wdt = RU.u(cr, 0.8, 3.2), yaw = RU.u(cr, 0, Math.PI), gy = terrainH(px, pz);
        box({ cx: px, cz: pz, cy: gy + hh / 2 - 0.8, hy: hh / 2 + 0.8, hx: wdt, hz: RU.u(cr, 0.3, 0.7), yaw, v: RU.i(cr, 8, 20), tag: hh > 2.6 && wdt > 1.6 ? 'wall' : 'solid' });
        if (cr() >= 0.72) W.roofs.push({ x: px, z: pz, y: gy + hh, w: wdt, yaw });
      }
    }
  }
  // the first field: a dense band of spike grass on both sides of the path
  const pf = byType('field');
  for (let k = 0; k < 900; k++) {
    const along = RU.u(r, -6, pf.len + 6), lat = RU.sign(r) * (3 + Math.abs(RU.n(r)) * 12), c = at(pf, along, lat);
    if (inChasm(c.x, c.z, 1) || inPlace(c.x, c.z, 1)) continue;
    const hh = RU.u(r, 0.8, 1 + Math.abs(lat) * 0.3);
    W.spikes.push({ x: c.x, z: c.z, y: terrainH(c.x, c.z) - 0.25, h: hh, w: 0.08 + hh * 0.045, tx: RU.u(r, -0.25, 0.25), tz: RU.u(r, -0.25, 0.25), v: RU.i(r, 3, 15) });
  }

  // ground critters stand on the ground
  for (const c of W.critters) if (!c.anchored && c.kind !== 'sentinel') c.y = groundAt(c.x, c.z, c.y + 2, 0.3).h;
  for (const s of W.stones) s.y = groundAt(s.x, s.z, s.y + 3, 0.3).h;
  for (const s of W.shrines) s.y = groundAt(s.x, s.z, s.y + 3, 0.3).h;
  if (W.lost) W.lost.y = groundAt(W.lost.x, W.lost.z, W.lost.y + 3, 0.3).h;
  W.lost.home = W.shrines.findIndex(sh => sh.needsSpirit);
  W.gapWidths = { short: gapShort, float: gapFloat, wallTut: gapWallTut, wall: gapWall };
  W.length = L;
  return W;
}
