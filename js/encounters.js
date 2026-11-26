// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-26
// The open world's reasons to wander: three shrines that open the spire (each lights a band on
// it, seen from anywhere), a bell that sends a flock to the nearest unlit shrine, and a lost little
// spirit to bring home. Wordless, but for a short note when something changes.
'use strict';

const ENC = { shrines: [], bell: null, lost: null, bands: [], awake: false, litCount: 0, group: null };

function lanternMesh() { // a stone lantern: base, post, light box with a glow inside, a pointed cap
  const g = new THREE.Group(), stone = new THREE.MeshLambertMaterial({ color: envGrey(16), flatShading: true });
  const part = (geo, y, ry = 0) => { const m = new THREE.Mesh(geo, stone); m.position.y = y; m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  part(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 6), 0.1);
  part(new THREE.CylinderGeometry(0.13, 0.16, 0.72, 6), 0.56);
  part(new THREE.CylinderGeometry(0.34, 0.3, 0.1, 6), 0.97);
  const glowMat = new THREE.MeshBasicMaterial({ color: grey(26) });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), glowMat); glow.position.y = 1.16; g.add(glow);
  for (let k = 0; k < 4; k++) { const post = part(new THREE.BoxGeometry(0.07, 0.3, 0.07), 1.16); const a = k * Math.PI / 2 + Math.PI / 4; post.position.x = Math.cos(a) * 0.2; post.position.z = Math.sin(a) * 0.2; }
  part(new THREE.ConeGeometry(0.48, 0.34, 4), 1.48, Math.PI / 4);
  part(new THREE.SphereGeometry(0.07, 8, 6), 1.7);
  return { g, glowMat };
}

/** Make the shrines, the bell tree, the lost spirit and the spire's bands for a world. */
function buildEncounters(W) {
  if (ENC.group) { RENDER.scene.remove(ENC.group); ENC.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const G = ENC.group = new THREE.Group();
  ENC.awake = false; ENC.litCount = 0;
  ENC.shrines = W.shrines.map((sh, i) => {
    const L = lanternMesh(); L.g.position.set(sh.x, sh.y, sh.z); G.add(L.g);
    // a faint pale thread rising from an unlit shrine: seen from far off, so the open land has places to go
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 70, 6, 1, true), new THREE.MeshBasicMaterial({ color: grey(160), transparent: true, opacity: 0.2, depthWrite: false, fog: false }));
    thread.position.set(sh.x, sh.y + 36, sh.z); G.add(thread);
    return { i, x: sh.x, y: sh.y, z: sh.z, needsSpirit: !!sh.needsSpirit, lit: false, L, thread, nudgeT: -9 };
  });
  // the spire's three bands: dark until a shrine is lit
  const S = W.spire;
  ENC.bands = [0, 1, 2].map(k => {
    const h = 22 + k * 34, rad = 5.2 * (1 - h / 230) + 0.45; // just outside the needle (a 5.2 m, 230 m cone) at that height
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 2.2, 4, 1, true), new THREE.MeshBasicMaterial({ color: grey(36), fog: false, side: THREE.DoubleSide }));
    m.position.set(S.x, S.y + S.colH + h, S.z); m.rotation.y = Math.PI / 4 - S.heading; G.add(m); return m;
  });
  // the bell tree: a dead trunk, one branch, a dark bell on a short rope
  ENC.bell = null;
  if (W.bell) {
    const B = W.bell, bark = new THREE.MeshLambertMaterial({ color: envGrey(12), flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 4.6, 7), bark); trunk.position.set(B.tx, B.ty + 2.3, B.tz); trunk.rotation.z = 0.06; trunk.castShadow = true; G.add(trunk);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.7, 5), bark);
    branch.position.set((B.tx + B.x) / 2, B.y + 0.75, (B.tz + B.z) / 2); branch.rotation.set(0, -B.a, Math.PI / 2 - 0.2); branch.castShadow = true; G.add(branch);
    const pivot = new THREE.Group(); pivot.position.set(B.x, B.y + 0.75, B.z); G.add(pivot);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), new THREE.MeshBasicMaterial({ color: grey(30) })); rope.position.y = -0.2; pivot.add(rope);
    const prof = [[0.0, 0.0], [0.08, 0.0], [0.12, -0.05], [0.15, -0.2], [0.2, -0.38], [0.24, -0.44], [0.0, -0.44]].map(([x, y]) => new THREE.Vector2(x, y));
    const bell = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), toonMat(58, { glow: 0.12, rim: 1.2 })); bell.position.y = -0.4; bell.castShadow = true; pivot.add(bell);
    ENC.bell = { pivot, swing: 0, ringT: -99, B };
    // the bell is something the strike can aim at: it rings, it never breaks
    CRITTERS.push({ kind: 'bell', i: CRITTERS.length, spawn: new THREE.Vector3(B.x, B.y - 0.1, B.z), pos: new THREE.Vector3(B.x, B.y - 0.1, B.z), prev: new THREE.Vector3(B.x, B.y - 0.1, B.z),
      alive: true, targetable: true, anchored: true, harmless: true, s: -1, chest: 0, hitR: 0, solidR: 0, height: 0.5, state: 'idle', t: 0, st: 0, yaw: 0, mesh: new THREE.Group(), parts: {} });
  }
  // the lost little spirit: curled up near the start; it follows once found, and goes home to its shrine
  ENC.lost = null;
  if (W.lost) {
    const { grp, eyes } = lostSpiritMesh();
    grp.position.set(W.lost.x, W.lost.y + 0.15, W.lost.z); G.add(grp);
    ENC.lost = { grp, eyes, state: 'waiting', home: W.lost.home, pos: grp.position.clone(), vel: new THREE.Vector3(), hop: 0, x0: W.lost.x, y0: W.lost.y, z0: W.lost.z };
  }
  RENDER.scene.add(G);
}

/** The lost little spirit: a small round paper body, two ink eyes, a tuft. */
function lostSpiritMesh() {
  const grp = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), toonMat(232, { map: MODEL.tex.paper, glow: 0.45 }));
  body.scale.set(1.1, 0.95, 1); body.castShadow = true; grp.add(body);
  const ink = new THREE.Mesh(body.geometry, outlineMat(0.008)); body.add(ink);
  const eyeM = new THREE.MeshBasicMaterial({ color: grey(8) });
  const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeM); e.scale.set(1, 1.3, 0.5); e.position.set(sd * 0.06, 0.02, 0.155); grp.add(e); return e; });
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), toonMat(232, { glow: 0.45 })); tuft.position.set(0.02, 0.19, 0); tuft.rotation.z = -0.4; grp.add(tuft);
  return { grp, eyes };
}
/** A fresh run: every shrine dark, the guardian asleep, the lost spirit back where it waits. */
function resetEncounters() {
  ENC.awake = false; ENC.litCount = 0;
  for (const sh of ENC.shrines) { sh.lit = false; sh.L.glowMat.color.copy(grey(26)); sh.thread.material.opacity = 0.2; }
  for (const b of ENC.bands) b.material.color.copy(grey(36));
  if (ENC.lost) { const L = ENC.lost; L.state = 'waiting'; L.pos.set(L.x0, L.y0 + 0.15, L.z0); L.vel.set(0, 0, 0); }
  BIRDS.guide = null;
}

function lightShrine(sh) {
  if (sh.lit) return;
  sh.lit = true; ENC.litCount++;
  sh.L.glowMat.color.copy(grey(244));
  birdBurst(sh.x, sh.y + 1.4, sh.z, 16);
  ENC.bands[ENC.litCount - 1].material.color.copy(grey(236));
  sfx('shrine'); emit({ type: 'shrine', n: ENC.litCount });
  if (ENC.litCount >= ENC.shrines.length) { ENC.awake = true; toast('all three shrines are lit: the spire\'s guardian wakes'); emit({ type: 'awake' }); }
  else toast(`a shrine is lit: ${ENC.litCount} of ${ENC.shrines.length}`);
  if (BIRDS.guide && BIRDS.guide.shrine === sh) BIRDS.guide.leave = true;
}

/** Strike the bell: it swings and tolls, and a flock rises to show the way to an unlit shrine. */
function ringBell() {
  const E = ENC.bell; if (!E) return;
  E.swing = 0.9; sfx('bell');
  if (GAME.time - E.ringT < 6) return; // the flock goes once per toll, not per strike
  E.ringT = GAME.time;
  const B = E.B, dark = ENC.shrines.filter(s => !s.lit);
  let target = null, shrine = null;
  if (dark.length) { shrine = dark.reduce((a, b) => (Math.hypot(a.x - B.x, a.z - B.z) < Math.hypot(b.x - B.x, b.z - B.z) ? a : b)); target = { x: shrine.x, y: shrine.y, z: shrine.z }; }
  else { const c = CRANES.find(c => !c.found); target = c ? { x: c.home.x, y: c.home.y, z: c.home.z } : { x: WORLD.spire.x, y: WORLD.spire.y + WORLD.spire.colH, z: WORLD.spire.z }; }
  const r = makeRng((GAME.steps * 13 + 7) >>> 0), birds = [];
  for (let i = 0; i < 22; i++) birds.push({ off: RU.bell(r), jx: RU.n(r) * 3, jy: RU.n(r) * 2, jz: RU.n(r) * 3, ph: r() * 6, s: 0.9 + r() * 0.5, orbit: r() * Math.PI * 2, orR: 5 + r() * 6 });
  BIRDS.guide = { from: { x: B.x, y: B.y + 1, z: B.z }, to: target, t: 0, travel: Math.max(6, Math.hypot(target.x - B.x, target.z - B.z) / 22), circle: 28, birds, shrine, leave: false };
  emit({ type: 'bell' });
}

/** One fixed step: shrines, the lost spirit, the bell's swing. */
function encountersStep(dt) {
  const p = P.pos;
  for (const sh of ENC.shrines) {
    if (sh.lit) { sh.thread.material.opacity = Math.max(0, sh.thread.material.opacity - dt * 0.2); continue; }
    if (Math.hypot(p.x - sh.x, p.z - sh.z) < 2.2 && Math.abs(p.y - sh.y) < 2.5) {
      if (!sh.needsSpirit) lightShrine(sh);
      else if (GAME.time - sh.nudgeT > 8) { sh.nudgeT = GAME.time; toast('this shrine is waiting for someone small'); }
    }
  }
  const L = ENC.lost;
  if (L) {
    if (L.state === 'waiting') {
      if (L.pos.distanceTo(p) < 2.6) { L.state = 'following'; sfx('crane'); emit({ type: 'found' }); toast('a lost little spirit follows you: take it home'); }
    } else if (L.state === 'following') {
      // a hop behind, a little to the side; it keeps up through anything
      const back = 1.4, tx = p.x - Math.cos(P.facing) * back + Math.sin(P.facing) * 0.6, tz = p.z - Math.sin(P.facing) * back - Math.cos(P.facing) * 0.6;
      const ty = P.grounded ? groundAt(tx, tz, p.y + 1).h + 0.17 : p.y + 0.9;
      L.vel.x += ((tx - L.pos.x) * 30 - L.vel.x * 9) * dt; L.vel.y += ((ty - L.pos.y) * 30 - L.vel.y * 9) * dt; L.vel.z += ((tz - L.pos.z) * 30 - L.vel.z * 9) * dt;
      L.pos.addScaledVector(L.vel, dt);
      if (L.pos.distanceTo(p) > 25) L.pos.set(p.x, p.y + 0.5, p.z); // after a respawn
      const home = ENC.shrines[L.home];
      if (home && Math.hypot(L.pos.x - home.x, L.pos.z - home.z) < 3.2) { L.state = 'home'; lightShrine(home); }
    } else if (L.state === 'home') {
      const home = ENC.shrines[L.home];
      L.pos.lerp(new THREE.Vector3(home.x, home.y + 1.16, home.z), Math.min(1, dt * 4));
    }
  }
  if (ENC.bell) { const E = ENC.bell; E.swing *= Math.exp(-dt * 1.2); }
}

/** Pose what moves, each frame. */
function drawEncounters(dt) {
  const t = GAME.time;
  if (ENC.bell) ENC.bell.pivot.rotation.z = Math.sin(t * 5.5) * ENC.bell.swing * 0.6;
  const L = ENC.lost;
  if (L) {
    L.grp.position.copy(L.pos);
    if (L.state === 'waiting') { L.grp.position.y += Math.sin(t * 1.3) * 0.02; L.grp.rotation.y = Math.sin(t * 0.4) * 0.6; L.grp.scale.set(1, 0.85 + Math.sin(t * 1.3) * 0.03, 1); }
    else { L.grp.rotation.y = Math.PI / 2 - Math.atan2(P.pos.z - L.pos.z, P.pos.x - L.pos.x); const hop = Math.abs(Math.sin(t * 9)); L.grp.position.y += L.state === 'following' && P.grounded ? hop * 0.08 : 0; L.grp.scale.set(1, 1, 1); }
    const blink = Math.sin(t * 0.9 + 1) > 0.97 ? 0.15 : 1; for (const e of L.eyes) e.scale.y = 1.3 * blink;
  }
  for (const sh of ENC.shrines) if (sh.lit) { const f = 0.92 + Math.sin(t * 3 + sh.i) * 0.08; sh.L.glowMat.color.copy(grey(244 * f)); }
}

/** A short note on screen. */
function toast(text) { GAME.toast = { text, t: 0 }; }
