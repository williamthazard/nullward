// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// Shadow critters (four kinds, each its own silhouette and behaviour), bird bursts and distant
// flocks, and the paper cranes that join you.
'use strict';

let CRITTERS = [];
const INK = 6, INK_RIM = 46, EYE = 196;

function inkPart(geo, v = INK, rim = 0.05) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: grey(v) })); m.castShadow = true;
  geo.computeBoundingSphere();
  const o = new THREE.Mesh(geo, CRIT_MAT.rim); o.scale.setScalar(1 + rim / Math.max(0.08, geo.boundingSphere.radius)); m.add(o);
  return m;
}
const CRIT_MAT = {};
function eyeSlit(w, h) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), CRIT_MAT.eye); }

/** Build the mesh for one critter kind; returns { group, parts }. */
function buildCritterMesh(kind) {
  if (!CRIT_MAT.rim) {
    CRIT_MAT.rim = new THREE.MeshBasicMaterial({ color: grey(INK_RIM), side: THREE.BackSide });
    CRIT_MAT.eye = new THREE.MeshBasicMaterial({ color: grey(EYE) });
    CRIT_MAT.core = new THREE.MeshBasicMaterial({ color: grey(226) });
    CRIT_MAT.wisp = new THREE.MeshBasicMaterial({ color: grey(14), transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  }
  const g = new THREE.Group(), parts = {};
  if (kind === 'sleepy') { // a low dome with two ear tufts, eyes shut, napping on an ink wisp
    const dome = inkPart(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)); dome.scale.set(1.25, 0.85, 1.05); g.add(dome);
    const base = inkPart(new THREE.CylinderGeometry(0.62, 0.55, 0.12, 14)); base.position.y = -0.04; g.add(base);
    parts.ears = [-1, 1].map(s => { const e = inkPart(new THREE.ConeGeometry(0.12, 0.38, 6), INK, 0.03); e.position.set(s * 0.3, 0.48, 0); e.rotation.z = -s * 0.45; g.add(e); return e; });
    const lid = eyeSlit(0.34, 0.025); lid.position.set(0, 0.22, 0.52); g.add(lid); parts.eye = lid;
    const wisp = new THREE.Mesh(new THREE.CircleGeometry(0.9, 9), CRIT_MAT.wisp); wisp.rotation.x = -Math.PI / 2; wisp.position.y = -0.16; g.add(wisp); parts.wisp = wisp;
  } else if (kind === 'crawler') { // long and low, spined, six thin legs: it lunges
    const body = new THREE.Group(); g.add(body); parts.body = body;
    const segs = [0.36, 0.31, 0.24].map((r, i) => { const s = inkPart(new THREE.SphereGeometry(r, 10, 8)); s.scale.set(1, 0.62, 1.15); s.position.set(0, 0.32, 0.25 - i * 0.48); body.add(s); return s; });
    parts.head = segs[0];
    for (let i = 0; i < 5; i++) { const sp = inkPart(new THREE.ConeGeometry(0.07, 0.42 - i * 0.04, 5), INK, 0.025); sp.position.set(0, 0.55, 0.3 - i * 0.28); sp.rotation.x = -0.5; body.add(sp); }
    parts.legs = [];
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.62), new THREE.MeshBasicMaterial({ color: grey(INK) }));
      const piv = new THREE.Group(); piv.position.set(s * 0.22, 0.28, 0.2 - i * 0.42); leg.position.set(0, 0, 0.0); leg.rotation.set(0, Math.PI / 2, s * 0.6); piv.add(leg); leg.position.x = s * 0.28; leg.position.y = -0.14;
      body.add(piv); parts.legs.push(piv);
    }
    const eye = eyeSlit(0.3, 0.05); eye.position.set(0, 0.36, 0.62); body.add(eye); parts.eye = eye;
  } else if (kind === 'floater') { // a tall diamond trailing three ink ribbons
    const d = inkPart(new THREE.OctahedronGeometry(0.55, 0)); d.scale.set(0.78, 1.3, 0.78); g.add(d); parts.body = d;
    parts.ribbons = [-1, 0, 1].map(s => {
      const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.2, 1, 4), new THREE.MeshBasicMaterial({ color: grey(INK), side: THREE.DoubleSide }));
      rb.geometry.translate(0, -0.6, 0); rb.position.set(s * 0.22, -0.55, s === 0 ? -0.15 : 0); g.add(rb); return rb;
    });
    const eye = eyeSlit(0.36, 0.06); eye.position.set(0, 0.12, 0.46); g.add(eye); parts.eye = eye;
  } else if (kind === 'sentinel') { // tall and thin, wide shoulders, a blade arm that sweeps; a pale core shows when it opens
    const legs = inkPart(new THREE.CylinderGeometry(0.22, 0.75, 1.0, 8)); legs.position.y = 0.5; g.add(legs);
    const torso = inkPart(new THREE.CylinderGeometry(0.55, 0.26, 1.6, 8)); torso.position.y = 1.8; g.add(torso);
    const sh = inkPart(new THREE.BoxGeometry(1.7, 0.32, 0.42)); sh.position.y = 2.65; g.add(sh);
    const head = inkPart(new THREE.ConeGeometry(0.26, 0.7, 6)); head.position.y = 3.15; g.add(head);
    const eye = eyeSlit(0.3, 0.05); eye.position.set(0, 3.05, 0.2); g.add(eye); parts.eye = eye;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), CRIT_MAT.core); core.position.set(0, 1.95, 0.12); g.add(core); parts.core = core;
    parts.plates = [-1, 1].map(s => { const p = inkPart(new THREE.BoxGeometry(0.42, 0.9, 0.16), INK, 0.03); p.position.set(s * 0.2, 1.95, 0.42); g.add(p); return p; });
    const arm = new THREE.Group(); arm.position.y = 0.75; g.add(arm); parts.arm = arm;
    const blade = inkPart(new THREE.BoxGeometry(3.1, 0.08, 0.26), 10, 0.04); blade.position.x = 2.1; arm.add(blade);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: grey(70) })); edge.position.set(2.1, 0, 0.14); arm.add(edge);
  }
  return { group: g, parts };
}

/** Make the critters for a world. */
function spawnCritters(W, scene) {
  for (const c of CRITTERS) scene.remove(c.mesh);
  CRITTERS = W.critters.map((s, i) => {
    const m = buildCritterMesh(s.kind);
    const c = {
      kind: s.kind, i, spawn: new THREE.Vector3(s.x, s.y, s.z), pos: new THREE.Vector3(s.x, s.y, s.z), prev: new THREE.Vector3(s.x, s.y, s.z),
      alive: true, targetable: true, anchored: !!s.anchored, harmless: !!s.harmless, s: s.s, phase: s.phase || 0, gate: s.gate,
      chest: { sleepy: 0.3, crawler: 0.35, floater: 0.1, sentinel: 1.9 }[s.kind], hitR: { sleepy: 0, crawler: 0.85, floater: 0.95, sentinel: 0 }[s.kind],
      solidR: s.kind === 'sentinel' ? 0.75 : 0, height: s.kind === 'sentinel' ? 3.3 : 1,
      state: s.kind === 'sentinel' ? 'sweep' : 'idle', t: 0, st: 0, yaw: Math.atan2(W.spire.z - s.z, W.spire.x - s.x) + Math.PI, armA: 0, sweeps: 0, lunge: null,
      mesh: m.group, parts: m.parts,
    };
    scene.add(c.mesh);
    return c;
  });
}
function critterReset(c) {
  c.alive = true; c.pos.copy(c.spawn); c.prev.copy(c.spawn); c.state = c.kind === 'sentinel' ? (ENC.awake ? 'sweep' : 'sleep') : 'idle'; c.st = 0; c.lunge = null; c.mesh.visible = true; c.sweeps = 0;
  if (c.kind === 'sentinel' && WORLD.gates[c.gate]) { WORLD.gates[c.gate].box.off = false; if (RENDER.veil) RENDER.veil.visible = true; }
}

/** A cut: 'cut' (the critter dissolves into birds) or 'clang' (the sentinel's guard). */
function critterCut(c, dir) {
  if (c.kind === 'bell') { ringBell(); return 'ring'; } // it tolls; it never breaks
  if (c.kind === 'sentinel' && c.state !== 'open') return 'clang';
  c.alive = false; c.mesh.visible = false;
  const n = c.kind === 'sentinel' ? 34 : 13;
  birdBurst(c.pos.x, c.pos.y + c.chest, c.pos.z, n, dir);
  sfx('cut', c.kind === 'sentinel' ? 2 : 1);
  if (c.kind === 'sentinel') { GAME.gateOpen = true; const g = WORLD.gates[c.gate]; if (g) { g.box.off = true; if (RENDER.veil) { birdBurst(g.x, g.y + 2.5, g.z, 20); RENDER.veil.visible = false; } } emit({ type: 'gate' }); }
  return 'cut';
}

function critterSpeedK() { return SETTINGS.calm ? tune.calm_critter_speed : 1; }

/** One fixed step of every critter. */
function crittersStep(dt) {
  const k = critterSpeedK(), px = P.pos.x, py = P.pos.y + 0.7, pz = P.pos.z;
  for (const c of CRITTERS) {
    c.prev.copy(c.pos);
    if (!c.alive) continue;
    c.t += dt; c.st += dt;
    const dx = px - c.pos.x, dz = pz - c.pos.z, dist = Math.hypot(dx, dz);
    if (dist > 140 || c.kind === 'bell') continue; // asleep far away; the bell only swings
    if (c.kind === 'sentinel') c.targetable = ENC.awake;
    if (c.kind === 'sleepy') {
      c.pos.y = c.spawn.y + Math.sin(c.t * 1.1) * 0.14;
    } else if (c.kind === 'floater') {
      if (c.anchored) {
        c.pos.set(c.spawn.x + Math.sin(c.t * 0.5 + c.i) * 0.35, c.spawn.y + Math.sin(c.t * 1.3 + c.i) * 0.25, c.spawn.z + Math.cos(c.t * 0.4 + c.i) * 0.35);
      } else {
        const home = c.spawn, hx = home.x + Math.sin(c.t * 0.4 + c.phase) * 3, hz = home.z + Math.cos(c.t * 0.3 + c.phase) * 3;
        let tx = hx, tz = hz, ty = home.y + Math.sin(c.t * 0.7 + c.phase) * 0.5;
        const fromHome = Math.hypot(px - home.x, pz - home.z);
        if (dist < tune.floater_sense && fromHome < 12) { tx = px; tz = pz; ty = Math.max(home.y - 0.6, P.pos.y + 0.9); }
        const ddx = tx - c.pos.x, ddz = tz - c.pos.z, dd = Math.hypot(ddx, ddz), v = tune.floater_speed * k * dt;
        if (dd > 0.05) { c.pos.x += ddx / dd * Math.min(v, dd); c.pos.z += ddz / dd * Math.min(v, dd); }
        c.pos.y += (ty - c.pos.y) * Math.min(1, dt * 1.5);
        c.yaw = Math.atan2(dz, dx);
      }
    } else if (c.kind === 'crawler') {
      const sense = tune.crawler_sense;
      if (c.state === 'idle') {
        const a = c.t * 0.45 + c.i;
        const tx = c.spawn.x + Math.cos(a) * 1.4, tz = c.spawn.z + Math.sin(a) * 1.4;
        c.pos.x += (tx - c.pos.x) * Math.min(1, dt * 1.2); c.pos.z += (tz - c.pos.z) * Math.min(1, dt * 1.2);
        c.yaw += angleDiff(c.yaw, dist < sense * 1.6 ? Math.atan2(dz, dx) : a + Math.PI / 2) * Math.min(1, dt * 3);
        if (dist < sense && Math.abs(P.pos.y - c.pos.y) < 3 && GAME.respawnT <= 0) { c.state = 'tell'; c.st = 0; sfx('tell'); }
      } else if (c.state === 'tell') {
        c.yaw += angleDiff(c.yaw, Math.atan2(dz, dx)) * Math.min(1, dt * 8);
        if (c.st > tune.crawler_tell / k) { c.state = 'lunge'; c.st = 0; c.lunge = { x: Math.cos(c.yaw), z: Math.sin(c.yaw), left: tune.crawler_lunge_dist }; }
      } else if (c.state === 'lunge') {
        const v = tune.crawler_lunge * k * dt, L = c.lunge;
        const nx = c.pos.x + L.x * v, nz = c.pos.z + L.z * v, gh = groundAt(nx, nz, c.pos.y + 0.4, 0.4).h;
        if (gh < c.pos.y - 1.2 || solidAt(nx, c.pos.y + 0.5, nz) || L.left <= 0) { c.state = 'rest'; c.st = 0; }
        else { c.pos.x = nx; c.pos.z = nz; L.left -= v; }
      } else if (c.state === 'rest') {
        if (c.st > tune.crawler_rest / k) { c.state = 'home'; c.st = 0; }
      } else if (c.state === 'home') {
        const hx = c.spawn.x - c.pos.x, hz = c.spawn.z - c.pos.z, hd = Math.hypot(hx, hz);
        if (hd < 0.3 || c.st > 6) c.state = 'idle';
        else { const v = 1.6 * dt; c.pos.x += hx / hd * Math.min(v, hd); c.pos.z += hz / hd * Math.min(v, hd); c.yaw += angleDiff(c.yaw, Math.atan2(hz, hx)) * Math.min(1, dt * 5); }
        if (dist < tune.crawler_sense * 0.8 && c.st > 0.6) { c.state = 'tell'; c.st = 0; sfx('tell'); }
      }
      c.pos.y = groundAt(c.pos.x, c.pos.z, c.pos.y + 0.6, 0.6).h;
    } else if (c.kind === 'sentinel') {
      const sweepV = tune.sentinel_sweep * k;
      if (c.state === 'sleep') { if (ENC.awake) { c.state = 'sweep'; c.sweeps = 0; sfx('open'); } else continue; } // it sleeps until the shrines are lit
      if (c.state === 'sweep') {
        c.armA += sweepV * dt * (dist > 30 ? 0.35 : 1);
        if (dist < 30) c.sweeps += sweepV * dt / (Math.PI * 2);
        if (c.sweeps >= 2) { c.state = 'slow'; c.st = 0; }
      } else if (c.state === 'slow') {
        c.armA += sweepV * dt * Math.max(0, 1 - c.st / 0.5);
        if (c.st > 0.5) { c.state = 'open'; c.st = 0; sfx('open'); }
      } else if (c.state === 'open') {
        if (c.st > tune.sentinel_open * (SETTINGS.calm ? tune.calm_open_mult : 1)) { c.state = 'sweep'; c.st = 0; c.sweeps = 0; }
      }
      // the blade arm: from 0.6 m to 3.8 m out, at shin height
      if (c.state !== 'open') {
        const aw = c.yaw - Math.PI / 2 + c.armA; // the arm's angle in world (x, z): model yaw, then the arm's turn
        const diff = Math.abs(angleDiff(Math.atan2(dz, dx), aw));
        if (dist > 0.6 && dist < 3.9 && diff < 0.3 && P.pos.y < c.pos.y + 1.05) playerHurt(c.pos.x, c.pos.z);
      }
    }
    // contact
    if (!c.harmless && c.hitR > 0) {
      const d3 = Math.hypot(px - c.pos.x, py - (c.pos.y + c.chest), pz - c.pos.z);
      if (d3 < c.hitR + 0.3) playerHurt(c.pos.x, c.pos.z);
    }
  }
}

/** Pose the critters for this frame. */
function animateCritters(dt, alpha) {
  for (const c of CRITTERS) {
    if (!c.alive) continue;
    const m = c.mesh, p = c.parts;
    m.position.lerpVectors(c.prev, c.pos, alpha);
    const t = c.t;
    if (c.kind === 'sleepy') {
      const breathe = 1 + Math.sin(t * 1.6) * 0.04; m.scale.set(breathe, 2 - breathe, breathe);
      p.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.45 + Math.sin(t * 0.9 + i) * 0.08); });
      m.rotation.y = Math.PI / 2 - c.yaw;
    } else if (c.kind === 'crawler') {
      m.rotation.y = Math.PI / 2 - c.yaw;
      const wob = 1 + Math.sin(t * 3.1) * 0.04;
      p.body.scale.set(2 - wob, wob, 1);
      const rear = c.state === 'tell' ? Math.min(1, c.st / 0.25) : c.state === 'lunge' ? 0.3 : 0;
      p.body.rotation.x = -rear * 0.55; p.body.position.y = rear * 0.15;
      const legV = c.state === 'lunge' ? 26 : c.state === 'idle' || c.state === 'home' ? 7 : 2;
      p.legs.forEach((l, i) => { l.rotation.y = Math.sin(t * legV + i * 1.7) * 0.35; });
      p.eye.scale.y = c.state === 'tell' ? 2.2 : 1;
    } else if (c.kind === 'floater') {
      m.rotation.y = Math.PI / 2 - c.yaw;
      p.body.rotation.y = t * 0.6;
      p.ribbons.forEach((r, i) => { r.rotation.x = Math.sin(t * 2.3 + i * 1.1) * 0.35; r.rotation.z = Math.sin(t * 1.7 + i) * 0.2; });
      const sh = 1 + Math.sin(t * 2.0 + c.i) * 0.05; m.scale.set(sh, 2 - sh, sh);
    } else if (c.kind === 'sentinel') {
      m.rotation.y = Math.PI / 2 - c.yaw;
      p.arm.rotation.y = -c.armA;
      const open = c.state === 'open' ? Math.min(1, c.st / 0.2) : 0;
      p.plates.forEach((pl, i) => { pl.position.x = (i ? 1 : -1) * (0.2 + open * 0.32); });
      p.core.scale.setScalar(c.state === 'sleep' ? 0.01 : 0.6 + open * 0.6 + (open ? Math.sin(GAME.time * 10) * 0.08 : 0));
      p.eye.scale.y = c.state === 'sleep' ? 0.12 : open ? 0.3 : 1;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Birds: V-stroke chevrons, instanced. A cut bursts a handful that wheel off into the fog;
// distant flocks cross the sky now and then, as visual-interest's do.
const BIRDS = { max: 260, list: [], mesh: null, flock: null, nextFlock: 0 };
function birdGeometry() {
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 0.12, -0.55, 0.16, -0.12, 0, 0, -0.06, 0, 0, 0.12, 0, 0, -0.06, 0.55, 0.16, -0.12];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  return g;
}
function buildBirds(scene) {
  BIRDS.mesh = new THREE.InstancedMesh(birdGeometry(), new THREE.MeshBasicMaterial({ color: grey(4), side: THREE.DoubleSide }), BIRDS.max);
  BIRDS.mesh.count = 0; BIRDS.mesh.frustumCulled = false; scene.add(BIRDS.mesh);
  BIRDS.list = []; BIRDS.flock = null;
}
function birdBurst(x, y, z, n, dir) {
  const r = makeRng((GAME.steps * 9301 + n) >>> 0);
  for (let i = 0; i < n && BIRDS.list.length < BIRDS.max; i++) {
    const a = r() * Math.PI * 2, sp = 3 + r() * 5;
    let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp;
    if (dir) { vx += dir.x * 4; vz += dir.z * 4; }
    BIRDS.list.push({ x: x + (r() - 0.5) * 0.6, y: y + (r() - 0.5) * 0.5, z: z + (r() - 0.5) * 0.6, vx, vy: 2.5 + r() * 4.5, vz, life: 5 + r() * 3, ph: r() * 6, s: 0.55 + r() * 0.35, flock: false });
  }
  sfx('wings', n);
}
function startFlock(r) { // a loose V crossing far off, 30-45 s from side to side
  const a = P.facing + Math.PI / 2 + (r() - 0.5) * 1.2, R = 380;
  const cx = P.pos.x + Math.cos(P.facing) * 160, cz = P.pos.z + Math.sin(P.facing) * 160;
  const y = P.pos.y + 45 + r() * 45;
  const f = { p0: [cx + Math.cos(a) * R, y, cz + Math.sin(a) * R], p2: [cx - Math.cos(a) * R, y + (r() - 0.5) * 20, cz - Math.sin(a) * R],
    p1: [cx + (r() - 0.5) * 140, y + 10 + r() * 25, cz + (r() - 0.5) * 140], t: 0, dur: 30 + r() * 15, birds: [] };
  const n = 15 + Math.floor(r() * 11);
  for (let i = 0; i < n; i++) f.birds.push({ off: RU.bell(r), jx: RU.n(r) * 9, jy: RU.n(r) * 5, jz: RU.n(r) * 9, ph: r() * 6, s: 2.2 + r() * 1.4 });
  BIRDS.flock = f;
}
function birdsStep(dt) {
  for (const b of BIRDS.list) {
    b.life -= dt; b.vy += 1.4 * dt; const h = Math.hypot(b.vx, b.vz) || 1; b.vx += b.vx / h * 1.5 * dt; b.vz += b.vz / h * 1.5 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
  BIRDS.list = BIRDS.list.filter(b => b.life > 0);
  if (BIRDS.flock) { BIRDS.flock.t += dt / BIRDS.flock.dur; if (BIRDS.flock.t > 1.6) BIRDS.flock = null; }
  if (BIRDS.guide) { const g = BIRDS.guide; g.t += dt; if (g.t > g.travel + g.circle || (g.leave && g.t > g.travel)) BIRDS.guide = null; }
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3(), _be = new THREE.Euler();
function drawBirds() {
  let i = 0;
  const put = (x, y, z, yaw, flap, s) => {
    _bp.set(x, y, z); _be.set(0, Math.PI / 2 - yaw, 0); _bq.setFromEuler(_be); _bs.set(s, s * flap, s);
    _bm.compose(_bp, _bq, _bs); BIRDS.mesh.setMatrixAt(i++, _bm);
  };
  for (const b of BIRDS.list) { if (i >= BIRDS.max) break; put(b.x, b.y, b.z, Math.atan2(b.vz, b.vx), Math.sin(GAME.time * 14 + b.ph) * 1.4 + 0.3, b.s); }
  const f = BIRDS.flock;
  if (f) for (const b of f.birds) {
    if (i >= BIRDS.max) break;
    const t = clamp(f.t * 1.35 - b.off * 0.35, 0, 1); if (t <= 0 || t >= 1) continue;
    const q = (k) => (1 - t) * (1 - t) * f.p0[k] + 2 * (1 - t) * t * f.p1[k] + t * t * f.p2[k];
    const d = (k) => 2 * (1 - t) * (f.p1[k] - f.p0[k]) + 2 * t * (f.p2[k] - f.p1[k]);
    put(q(0) + b.jx, q(1) + b.jy, q(2) + b.jz, Math.atan2(d(2), d(0)), Math.sin(GAME.time * 5 + b.ph) * 1.2 + 0.3, b.s);
  }
  const G = BIRDS.guide;
  if (G) for (const b of G.birds) {
    if (i >= BIRDS.max) break;
    const tt = clamp((G.t - b.off * 1.2) / G.travel, 0, 1);
    let x, y, z, yaw;
    if (tt < 1) { // an arc high over the land toward the shrine
      const e = tt * tt * (3 - 2 * tt), mx = (G.from.x + G.to.x) / 2, mz = (G.from.z + G.to.z) / 2, my = Math.max(G.from.y, G.to.y) + 34;
      const q = (a, m, c) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * m + e * e * c;
      x = q(G.from.x, mx, G.to.x) + b.jx; y = q(G.from.y, my, G.to.y + 16) + b.jy; z = q(G.from.z, mz, G.to.z) + b.jz;
      yaw = Math.atan2(G.to.z - G.from.z, G.to.x - G.from.x);
    } else { // circling over it
      const a = b.orbit + (G.t - G.travel) * 0.55;
      x = G.to.x + Math.cos(a) * b.orR; z = G.to.z + Math.sin(a) * b.orR; y = G.to.y + 14 + b.jy + Math.sin(a * 2) * 1.5; yaw = a + Math.PI / 2;
    }
    put(x, y, z, yaw, Math.sin(GAME.time * 11 + b.ph) * 1.3 + 0.3, b.s * 1.4);
  }
  BIRDS.mesh.count = i; BIRDS.mesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------
// Paper cranes: pale, folded, found off the line; each found one joins a small flock behind you.
let CRANES = [];
function craneGeometry() {
  const v = [
    // body: a thin folded diamond
    0, 0.0, 0.32, 0, 0.09, 0, 0, 0, -0.3,
    0, 0.0, 0.32, 0, -0.04, 0, 0, 0, -0.3,
    // wings: up and out
    0, 0.06, 0.1, -0.42, 0.24, -0.08, 0, 0.06, -0.14,
    0, 0.06, 0.1, 0.42, 0.24, -0.08, 0, 0.06, -0.14,
    // neck and tail: points rising fore and aft
    0, 0.02, 0.2, 0, 0.3, 0.42, 0, 0.0, 0.32,
    0, 0.02, -0.18, 0, 0.26, -0.44, 0, 0.0, -0.3,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  return g;
}
function spawnCranes(W, scene) {
  for (const c of CRANES) scene.remove(c.mesh);
  const geo = craneGeometry();
  CRANES = W.cranes.map((s, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: grey(186), side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, wireframe: true })); m.add(ink);
    m.position.set(s.x, s.y, s.z); scene.add(m);
    return { i, home: new THREE.Vector3(s.x, s.y, s.z), pos: new THREE.Vector3(s.x, s.y, s.z), vel: new THREE.Vector3(), found: false, mesh: m, mat, slot: 0 };
  });
}
function cranesStep(dt) {
  let slot = 0;
  for (const c of CRANES) {
    if (!c.found) {
      if (P.pos.distanceTo(c.home) < 1.8 || Math.hypot(P.pos.x - c.home.x, P.pos.y + 0.7 - c.home.y, P.pos.z - c.home.z) < 1.7) {
        c.found = true; GAME.cranes++; sfx('crane'); emit({ type: 'crane', n: GAME.cranes }); flowAdd();
        toast(`a paper crane joins you: your glide lifts (${GAME.cranes} of ${CRANES.length})`);
      }
      continue;
    }
    // follow: a loose ring behind and above, each on its own slow orbit
    const a = GAME.time * 0.7 + slot * (Math.PI * 2 / 7), back = 1.6 + slot * 0.25;
    const tx = P.pos.x - Math.cos(P.facing) * back + Math.cos(a) * 0.9, ty = P.pos.y + 1.9 + Math.sin(a * 1.3) * 0.35 + slot * 0.08, tz = P.pos.z - Math.sin(P.facing) * back + Math.sin(a) * 0.9;
    c.vel.x += ((tx - c.pos.x) * 18 - c.vel.x * 6) * dt; c.vel.y += ((ty - c.pos.y) * 18 - c.vel.y * 6) * dt; c.vel.z += ((tz - c.pos.z) * 18 - c.vel.z * 6) * dt;
    c.pos.addScaledVector(c.vel, dt);
    slot++;
  }
}
function drawCranes() {
  for (const c of CRANES) {
    if (!c.found) {
      c.mesh.position.set(c.home.x, c.home.y + Math.sin(GAME.time * 1.4 + c.i) * 0.12, c.home.z);
      c.mesh.rotation.y = GAME.time * 0.6 + c.i;
      const glint = 150 + 70 * Math.max(0, Math.sin(GAME.time * 2.2 + c.i * 1.7)) ** 6;
      c.mat.color.copy(grey(glint)); c.mesh.scale.setScalar(1.3);
    } else {
      c.mesh.position.copy(c.pos); c.mesh.rotation.y = Math.PI / 2 - Math.atan2(c.vel.z, c.vel.x || 1e-4);
      c.mesh.rotation.z = Math.sin(GAME.time * 8 + c.i) * 0.2; c.mat.color.copy(grey(196)); c.mesh.scale.setScalar(0.7);
    }
  }
}
