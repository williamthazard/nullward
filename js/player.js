// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// The wanderer: the movement controller (fixed step), the chibi model, its procedural animation
// and the verlet scarf. Collision is a vertical capsule against the heightfield and yawed boxes.
'use strict';

const PR = 0.35, PH = 1.3, PH_LOW = 0.75, STEP_UP = 0.35;

const P = {
  pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), facing: 0,
  grounded: false, groundBox: null, coyote: 0, jumpBuf: 0, jumpRising: false, sinceLand: 1,
  momentum: 0, floating: false, airDash: true, mode: 'normal', modeT: 0,
  wall: null, wallCool: 0, wallCoolBox: null, dash: null, mantle: null, vaultBox: null, vaultT: 0,
  strikeCd: 0, chain: 0, flow: 0, bestFlow: 0, flowIdle: 0, groundedT: 0,
  pips: 3, invuln: 0, hurtT: 0, squash: 0, squashV: 0, strikeAnim: 0, rollT: 0, landHard: 0,
  lastGround: new THREE.Vector3(), lastGroundSpire: null, stepPhase: 0, height: PH, hspeedBeforeDash: 0,
};

function isCalm() { return SETTINGS.calm; }
function mantleMax() { return isCalm() ? tune.calm_mantle_max : tune.mantle_max; }
function wallrunMax() { return isCalm() ? tune.calm_wallrun_time : tune.wallrun_time; }
function maxPips() { return isCalm() ? tune.calm_pips : tune.pips; }

/** Put the wanderer at a spot, at rest. */
function playerPlace(x, y, z, facing) {
  P.pos.set(x, y, z); P.prev.copy(P.pos); P.vel.set(0, 0, 0); P.facing = facing;
  P.mode = 'normal'; P.dash = null; P.mantle = null; P.wall = null; P.momentum = 0; P.grounded = false;
  P.airDash = true; P.chain = 0; P.flow = 0; P.invuln = 0; P.lastGround.copy(P.pos);
  P.height = PH; P.lastGroundSpire = null;
  scarfReset();
}

function flowAdd() { P.flow++; P.flowIdle = 0; P.groundedT = 0; if (P.flow > P.bestFlow) P.bestFlow = P.flow; }
function flowBreak() { P.flow = 0; }

// ---------------------------------------------------------------------------------------------
// The strike: aim at the nearest critter in a cone ahead, or dash forward.
function strikeTarget() {
  let best = null, bestScore = Infinity;
  const range = tune.strike_range, cone = Math.cos(tune.strike_cone * Math.PI / 180);
  const fwd = INPUT.wish.lengthSq() > 0.01 ? INPUT.wish.clone().normalize() : new THREE.Vector3(Math.cos(P.facing), 0, Math.sin(P.facing));
  const camF = new THREE.Vector3(Math.cos(CAM.yaw), 0, Math.sin(CAM.yaw));
  for (const c of CRITTERS) {
    if (!c.alive || !c.targetable) continue;
    const dx = c.pos.x - P.pos.x, dy = c.pos.y + c.chest - (P.pos.y + 0.7), dz = c.pos.z - P.pos.z;
    const d = Math.hypot(dx, dy, dz); if (d > range || d < 0.01) continue;
    const hd = Math.hypot(dx, dz) || 1, dot = Math.max((dx * fwd.x + dz * fwd.z) / hd, (dx * camF.x + dz * camF.z) / hd);
    if (dot < cone && d > 2.2) continue;
    const score = d * (1.6 - dot);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}
function startStrike() {
  const t = strikeTarget();
  P.hspeedBeforeDash = Math.hypot(P.vel.x, P.vel.z);
  let dir;
  if (t) dir = new THREE.Vector3(t.pos.x - P.pos.x, t.pos.y + t.chest - (P.pos.y + 0.7), t.pos.z - P.pos.z).normalize();
  else {
    if (!P.grounded && !P.airDash) return;
    dir = INPUT.wish.lengthSq() > 0.01 ? INPUT.wish.clone().normalize() : new THREE.Vector3(Math.cos(P.facing), 0, Math.sin(P.facing));
    if (!P.grounded) P.airDash = false;
  }
  const dist = t ? 0 : (P.grounded ? 3 : tune.air_dash_distance);
  P.dash = { target: t, dir, t: 0, max: t ? tune.dash_time : dist / tune.dash_speed, from: P.pos.clone() };
  P.mode = 'dash'; P.modeT = 0; P.strikeCd = tune.strike_cooldown; P.strikeAnim = 0.32;
  P.facing = Math.atan2(dir.z, dir.x);
  trailStart();
  sfx('swish');
}
/** A cut landed on critter c. */
function strikeHit(c) {
  const res = critterCut(c, P.dash.dir);
  if (res === 'clang') { // the sentinel's guard: knocked back, no harm
    P.vel.set(-P.dash.dir.x * 8, 4, -P.dash.dir.z * 8); P.mode = 'normal'; P.dash = null;
    GAME.hitstop = tune.hitstop; camKick(0.25); sfx('clang'); return;
  }
  GAME.hitstop = tune.hitstop; camKick(0.4);
  const air = !P.grounded;
  P.chain = air ? P.chain + 1 : 1;
  const d = P.dash.dir, hd = Math.hypot(d.x, d.z) || 1;
  const top = tune.run_speed + tune.momentum_max + 4;
  const sp = Math.min(top, Math.max(P.hspeedBeforeDash, tune.run_speed) + tune.strike_carry * P.chain);
  P.vel.set(d.x / hd * sp, tune.strike_pop, d.z / hd * sp);
  P.airDash = true; P.grounded = false;
  P.momentum = Math.min(tune.momentum_max, P.momentum + tune.strike_carry * 0.6);
  P.mode = 'normal'; P.dash = null; P.jumpRising = false;
  flowAdd();
  emit({ type: 'cut', kind: c.kind, chain: P.chain });
}

function playerHurt(fromX, fromZ) {
  if (P.invuln > 0 || P.mode === 'dash' || GAME.respawnT > 0) return;
  P.pips--; P.invuln = tune.invuln; P.hurtT = 0.3;
  const dx = P.pos.x - fromX, dz = P.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
  P.vel.set(dx / d * 8, 5, dz / d * 8); P.mode = 'normal'; P.dash = null; P.wall = null; P.grounded = false;
  P.momentum *= 0.3; flowBreak(); camKick(0.5); sfx('hurt');
  emit({ type: 'hurt', pips: P.pips });
  if (P.pips <= 0) gameLose('hits');
}

// ---------------------------------------------------------------------------------------------
// One fixed step of the controller.
function playerStep(dt) {
  P.prev.copy(P.pos);
  P.coyote -= dt; P.jumpBuf -= dt; P.invuln -= dt; P.hurtT -= dt; P.wallCool -= dt; P.strikeCd -= dt; P.sinceLand += dt; P.vaultT -= dt; P.rollT -= dt;
  if (INPUT.jumpPressed) P.jumpBuf = tune.jump_buffer;
  if (P.mode === 'roll' && P.rollT <= 0) P.mode = 'normal';
  if (P.mode !== 'slide') P.height = PH;
  const wish = INPUT.wish, mag = Math.min(1, wish.length());
  const hv = Math.hypot(P.vel.x, P.vel.z);

  if (INPUT.strikePressed && P.strikeCd <= 0 && P.mode !== 'mantle') startStrike();

  if (P.mode === 'mantle') { P.floating = false; stepMantle(dt); return; }

  const wasGrounded = P.grounded;
  const speedCap = tune.run_speed + P.momentum;
  P.floating = false;

  if (P.mode === 'dash') {
    const D = P.dash; D.t += dt; P.modeT += dt;
    if (D.target) {
      if (!D.target.alive) { endDash(); }
      else {
        const tx = D.target.pos.x - P.pos.x, ty = D.target.pos.y + D.target.chest - (P.pos.y + 0.7), tz = D.target.pos.z - P.pos.z;
        const d = Math.hypot(tx, ty, tz);
        if (d < 1.25) { strikeHit(D.target); if (P.mode === 'dash') endDash(); }
        else { D.dir.set(tx / d, ty / d, tz / d); P.vel.copy(D.dir).multiplyScalar(tune.dash_speed); }
      }
    } else { P.vel.set(D.dir.x * tune.dash_speed, 0, D.dir.z * tune.dash_speed); }
    if (P.mode === 'dash' && D.t >= D.max) endDash();
  } else if (P.mode === 'wallrun') {
    stepWallrun(dt);
  } else {
    // ---- ground and air movement ----
    if (P.grounded) {
      if (P.mode === 'slide') {
        P.modeT += dt;
        const fr = Math.max(0, hv - 2.5 * dt) / (hv || 1); P.vel.x *= fr; P.vel.z *= fr;
        if (P.modeT > tune.slide_time || hv < 2.5) { P.mode = 'normal'; P.height = PH; }
      } else {
        const tx = wish.x * speedCap, tz = wish.z * speedCap;
        let dx = tx - P.vel.x, dz = tz - P.vel.z;
        const dl = Math.hypot(dx, dz), maxd = (mag > 0.05 ? tune.ground_accel : tune.ground_friction) * dt;
        if (dl > maxd) { dx *= maxd / dl; dz *= maxd / dl; }
        P.vel.x += dx; P.vel.z += dz;
        // momentum: built by clean running, lost by stopping, hard turns and walls
        const nh = Math.hypot(P.vel.x, P.vel.z);
        const align = nh > 0.1 && mag > 0.1 ? (P.vel.x * wish.x + P.vel.z * wish.z) / (nh * mag) : 0;
        if (mag > 0.7 && nh > tune.run_speed * 0.9 && align > 0.82) P.momentum += tune.momentum_gain * dt;
        else if (mag < 0.3 || align < 0.34) P.momentum -= tune.momentum_decay * dt;
        P.momentum = clamp(P.momentum, 0, tune.momentum_max);
        if (INPUT.slidePressed && nh > 5) { P.mode = 'slide'; P.modeT = 0; P.height = PH_LOW; const k = (nh + tune.slide_boost) / nh; P.vel.x *= k; P.vel.z *= k; flowAdd(); sfx('slide'); }
      }
    } else {
      const before = hv, gliding = INPUT.jumpHeld && P.vel.y <= 0;
      const acc = gliding ? tune.glide_steer : tune.air_accel;
      P.vel.x += wish.x * acc * dt; P.vel.z += wish.z * acc * dt;
      const nh = Math.hypot(P.vel.x, P.vel.z);
      if (gliding) { // under the wing: speed is kept, and eased up to the glide's own while you steer
        const gs = tune.glide_speed + GAME.cranes * tune.crane_speed, lim = Math.max(before, gs);
        const want = nh > 0.5 && mag > 0.2 && nh < gs ? Math.min(gs, nh + 5 * dt) : Math.min(nh, lim);
        if (nh > 0.01) { P.vel.x *= want / nh; P.vel.z *= want / nh; }
      } else { const lim = Math.max(before, speedCap * 0.8); if (nh > lim) { P.vel.x *= lim / nh; P.vel.z *= lim / nh; } }
    }
    // jump (buffered, with coyote time)
    if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0)) {
      if (P.sinceLand < tune.jump_buffer + 0.02 && hv > tune.run_speed * 0.8) { P.momentum = Math.min(tune.momentum_max, P.momentum + tune.flow_hop_bonus); flowAdd(); }
      P.vel.y = tune.jump_speed; P.grounded = false; P.coyote = 0; P.jumpBuf = 0; P.jumpRising = true;
      if (P.mode === 'slide') { P.mode = 'normal'; P.height = PH; }
      P.squash = -0.18; sfx('jump'); emit({ type: 'jump' });
    }
    // gravity, the variable jump and the held float
    if (!P.grounded) {
      if (P.vel.y > 0) {
        if (P.jumpRising && !INPUT.jumpHeld) { P.vel.y *= tune.jump_cut; P.jumpRising = false; }
        P.vel.y -= (INPUT.jumpHeld && P.vel.y < tune.apex_band ? tune.apex_gravity : tune.gravity_up) * dt; // a hang at the top
      } else {
        P.jumpRising = false;
        if (INPUT.jumpHeld) { // the kite-wing, for as long as it is held; each crane found lifts it
          const fm = (isCalm() ? tune.calm_float_fall : tune.float_fall_max) * (1 - Math.min(0.6, GAME.cranes * tune.crane_lift));
          P.vel.y = P.vel.y < -fm ? Math.min(-fm, P.vel.y + tune.gravity_up * dt) : Math.max(P.vel.y - tune.float_gravity * dt, -fm); // a fast fall eases into the glide
          P.floating = true;
        } else P.vel.y -= (INPUT.jumpHeld && P.vel.y > -tune.apex_band ? tune.apex_gravity : tune.gravity_down) * dt;
      }
    }
  }

  // ---- integrate and collide ----
  const hvPre = { x: P.vel.x, z: P.vel.z };
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  const contacts = resolveBoxes();
  dynamicBodies();
  if (P.mode !== 'wallrun' && P.mode !== 'dash') { handleContacts(contacts, hvPre, wasGrounded); if (P.mode === 'normal' && !P.grounded) wallMagnet(hvPre); }
  else if (P.mode === 'dash' && contacts.some(c => c.impact > 4)) endDash();
  if (P.mode === 'mantle') return;

  const prevY = P.pos.y, vy = P.vel.y;
  P.pos.y += P.vel.y * dt;
  const g = groundAt(P.pos.x, P.pos.z, prevY, STEP_UP);
  const snap = wasGrounded && P.vel.y <= 0 && P.mode !== 'dash' ? 0.45 : 0;
  if (P.vel.y <= 0 && P.pos.y <= g.h + snap) {
    P.pos.y = g.h;
    if (!wasGrounded) onLand(-vy);
    P.vel.y = 0; P.grounded = true; P.groundBox = g.box;
    if (P.mode === 'wallrun') endWallrun();
  } else {
    if (wasGrounded && P.grounded && P.vel.y <= 0) P.coyote = tune.coyote; // walked off an edge
    P.grounded = false;
  }
  if (P.vel.y > 0) { // ceilings
    for (const b of boxesAt(P.pos.x, P.pos.z)) {
      if (b.off || b.bottom < prevY + P.height - 0.05 || b.bottom > P.pos.y + P.height) continue;
      const l = boxLocal(b, P.pos.x, P.pos.z);
      if (Math.abs(l[0]) <= b.hx && Math.abs(l[1]) <= b.hz) { P.pos.y = b.bottom - P.height; P.vel.y = 0; P.jumpRising = false; }
    }
  }

  // ---- bookkeeping: safe ground, flow, falls ----
  if (P.grounded) {
    P.airDash = true; P.chain = 0;
    P.lastGround.copy(P.pos);
    P.lastGroundSpire = P.groundBox && P.groundBox.spire ? P.pos.clone() : (P.pos.y > WORLD.spire.y + 3 ? P.lastGroundSpire : null);
    P.groundedT += dt;
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (sp < 3) P.flowIdle += dt; else P.flowIdle = 0;
    if (P.flowIdle > 0.6 || P.groundedT > 3) flowBreak();
    P.stepPhase += sp * dt * 1.4;
    if (P.stepPhase > 1 && sp > 1.5 && P.mode === 'normal') { P.stepPhase = 0; sfx('step', sp); }
  } else P.groundedT = 0;
  if (P.pos.y < tune.kill_y) gameFall();
  else if (P.lastGroundSpire && P.pos.y < P.lastGroundSpire.y - 7 && !P.grounded) gameCalmCatch(P.lastGroundSpire); // a fall off the climb puts you back on its last step
  { // the region's rim: a soft wall far out in the mountains
    const R = WORLD.region, dx = P.pos.x - R.cx, dz = P.pos.z - R.cz, d = Math.hypot(dx, dz), lim = R.R * 0.9;
    if (d > lim) { P.pos.x = R.cx + dx / d * lim; P.pos.z = R.cz + dz / d * lim; const vn = (P.vel.x * dx + P.vel.z * dz) / d; if (vn > 0) { P.vel.x -= dx / d * vn; P.vel.z -= dz / d * vn; } }
  }

  // facing follows motion
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (sp > 0.6 && P.mode !== 'dash') {
    const want = Math.atan2(P.vel.z, P.vel.x);
    P.facing += angleDiff(P.facing, want) * Math.min(1, tune.turn_rate * dt);
  }
}

function endDash() {
  const D = P.dash; P.mode = 'normal'; P.dash = null;
  const top = tune.run_speed + P.momentum, hd = Math.hypot(D.dir.x, D.dir.z) || 1;
  const sp = Math.min(top, Math.max(P.hspeedBeforeDash, tune.run_speed * 0.8));
  P.vel.set(D.dir.x / hd * sp, D.target ? 2 : 0.5, D.dir.z / hd * sp);
}

/** Push the capsule out of boxes; returns contacts with world normals. */
function resolveBoxes() {
  const out = [];
  for (let iter = 0; iter < 2; iter++) {
    for (const b of boxesAt(P.pos.x, P.pos.z)) {
      if (b.off || b.top <= P.pos.y + STEP_UP || b.bottom >= P.pos.y + P.height) continue;
      if (b === P.vaultBox && P.vaultT > 0) continue; // rising over it
      const l = boxLocal(b, P.pos.x, P.pos.z);
      const qx = clamp(l[0], -b.hx, b.hx), qz = clamp(l[1], -b.hz, b.hz);
      const dx = l[0] - qx, dz = l[1] - qz, d2 = dx * dx + dz * dz;
      if (d2 >= PR * PR) continue;
      let nx, nz, pen;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = PR - d; }
      else { const px = b.hx - Math.abs(l[0]), pz = b.hz - Math.abs(l[1]); if (px < pz) { nx = Math.sign(l[0]) || 1; nz = 0; pen = px + PR; } else { nx = 0; nz = Math.sign(l[1]) || 1; pen = pz + PR; } }
      const wx = nx * b.cos - nz * b.sin, wz = nx * b.sin + nz * b.cos;
      P.pos.x += wx * pen; P.pos.z += wz * pen;
      const vn = P.vel.x * wx + P.vel.z * wz;
      let impact = 0;
      if (vn < 0) { P.vel.x -= wx * vn; P.vel.z -= wz * vn; impact = -vn; }
      if (iter === 0 || impact > 0) out.push({ b, wx, wz, impact });
    }
  }
  return out;
}
/** The sentinel's body is solid while it stands. */
function dynamicBodies() {
  for (const c of CRITTERS) {
    if (!c.alive || !c.solidR) continue;
    const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, d = Math.hypot(dx, dz), m = PR + c.solidR;
    if (d < m && P.pos.y < c.pos.y + c.height && d > 0.001) { P.pos.x += dx / d * (m - d); P.pos.z += dz / d * (m - d); }
  }
}

/** Vault, mantle, wall-run or bonk, from the contacts of this step. */
function handleContacts(contacts, hvPre, wasGrounded) {
  if (!contacts.length) return;
  const hspeed = Math.hypot(hvPre.x, hvPre.z);
  for (const c of contacts) {
    const b = c.b, rel = b.top - P.pos.y;
    const into = hspeed > 0.01 ? -(hvPre.x * c.wx + hvPre.z * c.wz) / hspeed : 0; // 1 = straight into the face
    const nearGround = wasGrounded || P.coyote > 0;
    // vault: a low ledge at a run
    if (nearGround && rel >= 0.25 && rel <= tune.vault_max && hspeed > 3 && into > 0.3) {
      P.vel.x = hvPre.x; P.vel.z = hvPre.z; P.vel.y = Math.sqrt(2 * tune.gravity_up * (rel + 0.45));
      P.grounded = false; P.vaultBox = b; P.vaultT = 0.3; P.momentum = Math.min(tune.momentum_max, P.momentum + 0.4);
      P.jumpRising = false; flowAdd(); sfx('vault'); emit({ type: 'vault' });
      return;
    }
    if (P.grounded) {
      if (into > 0.8 && c.impact > 7) { P.momentum *= 0.3; P.squash = 0.12; sfx('bonk'); }
      continue;
    }
    // wall-run: a tall tagged wall, met moving along it
    if (b.tag === 'wall' && rel > 1.0 && !(P.wallCool > 0 && P.wallCoolBox === b)) {
      let ax = -c.wz, az = c.wx;
      let along = hvPre.x * ax + hvPre.z * az;
      if (along < 0) { ax = -ax; az = -az; along = -along; }
      if (along > 3.5 && along / (hspeed || 1) > 0.35) { startWallrun(b, c.wx, c.wz, ax, az, along); return; }
    }
    // mantle: a ledge caught in the air
    if (rel > 0.25 && rel <= mantleMax() && P.vel.y > -9 && (into > 0.25 || INPUT.wish.lengthSq() > 0.2)) {
      const to = new THREE.Vector3(P.pos.x - c.wx * 0.55, b.top, P.pos.z - c.wz * 0.55);
      const keep = Math.max(4, hspeed * 0.65);
      P.mantle = { from: P.pos.clone(), to, t: 0, max: 0.16 + rel * 0.05, vx: -c.wx * keep, vz: -c.wz * keep };
      P.mode = 'mantle'; P.vel.set(0, 0, 0); flowAdd(); sfx('vault'); emit({ type: 'mantle' });
      return;
    }
    if (into > 0.85 && c.impact > 6) P.momentum *= 0.4;
  }
}
/** A tall wall close by in the air, met moving along it: drawn onto it (a forgiving reach). */
function wallMagnet(hvPre) {
  const hs = Math.hypot(hvPre.x, hvPre.z); if (hs < 3.5) return;
  for (const b of boxesAt(P.pos.x, P.pos.z)) {
    if (b.off || b.tag !== 'wall' || b.top - P.pos.y < 1.0 || b.bottom > P.pos.y + 0.5 || (P.wallCool > 0 && P.wallCoolBox === b)) continue;
    const l = boxLocal(b, P.pos.x, P.pos.z), qx = clamp(l[0], -b.hx, b.hx), qz = clamp(l[1], -b.hz, b.hz);
    const dx = l[0] - qx, dz = l[1] - qz, d = Math.hypot(dx, dz);
    if (d < 0.01 || d > PR + 0.6) continue;
    const nx = dx / d, nz = dz / d, wx = nx * b.cos - nz * b.sin, wz = nx * b.sin + nz * b.cos;
    let ax = -wz, az = wx, along = hvPre.x * ax + hvPre.z * az;
    if (along < 0) { ax = -ax; az = -az; along = -along; }
    if (along < 3.5 || along / hs < 0.45) continue;
    P.pos.x -= wx * (d - PR - 0.02); P.pos.z -= wz * (d - PR - 0.02);
    startWallrun(b, wx, wz, ax, az, along); return;
  }
}

function stepMantle(dt) {
  const M = P.mantle; M.t += dt;
  const k = Math.min(1, M.t / M.max), e = k * k * (3 - 2 * k);
  P.pos.x = lerp(M.from.x, M.to.x, e); P.pos.z = lerp(M.from.z, M.to.z, e);
  P.pos.y = lerp(M.from.y, M.to.y, Math.min(1, e * 1.3));
  if (k >= 1) {
    P.mode = 'normal'; P.mantle = null; P.pos.copy(M.to); P.vel.set(M.vx, 0, M.vz); P.grounded = true; P.sinceLand = 0;
    P.squash = 0.15;
  }
}

function startWallrun(b, nx, nz, ax, az, along) {
  const sp = Math.max(along, tune.wallrun_min_speed);
  P.wall = { b, nx, nz, ax, az, sp }; P.mode = 'wallrun'; P.modeT = 0;
  P.vel.set(ax * sp, Math.max(P.vel.y, 2.5), az * sp);
  P.airDash = true; P.jumpRising = false;
  flowAdd(); sfx('wall'); emit({ type: 'wallrun' });
}
function endWallrun() {
  if (P.wall) { P.wallCool = 0.35; P.wallCoolBox = P.wall.b; }
  P.wall = null; if (P.mode === 'wallrun') P.mode = 'normal';
}
function stepWallrun(dt) {
  const w = P.wall; P.modeT += dt;
  // still beside the wall? (local face distance and along extent)
  const b = w.b, l = boxLocal(b, P.pos.x, P.pos.z);
  const qx = clamp(l[0], -b.hx, b.hx), qz = clamp(l[1], -b.hz, b.hz);
  const dist = Math.hypot(l[0] - qx, l[1] - qz);
  const onWall = dist < PR + 0.5 && P.pos.y < b.top - 0.2; // the clamped distance grows past the wall's end
  if (P.jumpBuf > 0) { // jump off the wall
    P.jumpBuf = 0;
    P.vel.set(w.ax * w.sp * 0.92 + w.nx * tune.walljump_push, tune.walljump_speed, w.az * w.sp * 0.92 + w.nz * tune.walljump_push);
    P.jumpRising = true; P.airDash = true;
    endWallrun(); flowAdd(); sfx('jump'); P.squash = -0.2; emit({ type: 'walljump' });
    return;
  }
  if (!onWall || P.modeT > wallrunMax()) { endWallrun(); return; }
  P.vel.x = w.ax * w.sp - w.nx * 1.0; P.vel.z = w.az * w.sp - w.nz * 1.0; // a little pull to the wall
  P.vel.y -= tune.wallrun_gravity * dt;
  if (INPUT.wish.lengthSq() > 0.04) { // steering against the run ends it early
    const a = INPUT.wish.x * w.ax + INPUT.wish.z * w.az; if (a < -0.6) endWallrun();
  }
}

function onLand(fall) {
  P.sinceLand = 0;
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (fall > tune.hard_landing) {
    if (sp > tune.roll_speed_min && P.mode === 'normal') { P.mode = 'roll'; P.rollT = 0.36; P.modeT = 0; flowAdd(); sfx('roll'); emit({ type: 'roll' }); }
    else { P.vel.x *= 0.5; P.vel.z *= 0.5; P.landHard = 0.25; camKick(0.3); }
    P.squash = 0.32; sfx('land', fall);
  } else { P.squash = Math.min(0.25, fall * 0.025); if (fall > 3) sfx('land', fall); }
}

// ---------------------------------------------------------------------------------------------
// The wanderer: a little headband spirit of ink and paper. A round paper head with big ink eyes,
// a small robe of woven cloth whose hem is real cloth (it drapes, swings, lifts and flares), wide
// sleeves, and a pale headband whose two tails are broad cloth strips. Built facing +z;
// root.rotation.y = pi/2 - facing. Quiet and curious: it looks at things.
const MODEL = {};
let TOON_RAMP = null;
function toonRamp() { // three tones, the darkest still light: the one pale figure, even backlit
  if (TOON_RAMP) return TOON_RAMP;
  const d = new Uint8Array([140, 140, 140, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  TOON_RAMP = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); TOON_RAMP.minFilter = TOON_RAMP.magFilter = THREE.NearestFilter; TOON_RAMP.needsUpdate = true;
  return TOON_RAMP;
}
/** A greyscale texture drawn once: 'paper' (fibres and mottling) or 'weave' (cloth). */
function fabricTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = makeRng(kind === 'paper' ? 11 : 23);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  if (kind === 'paper') {
    for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 256, a = r() * Math.PI, l = 4 + r() * 18; g.strokeStyle = `rgba(0,0,0,${0.02 + r() * 0.05})`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${0.015 + r() * 0.03})`; g.beginPath(); g.arc(r() * 256, r() * 256, 6 + r() * 30, 0, 7); g.fill(); }
  } else {
    for (let y = 0; y < 256; y += 4) { g.fillStyle = `rgba(0,0,0,${0.10 + r() * 0.06})`; g.fillRect(0, y, 256, 1.4); }
    for (let x = 0; x < 256; x += 4) { g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.05})`; g.fillRect(x, 0, 1.2, 256); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
/** The ink outline: the same shape, back faces only, pushed out along its normals. */
function outlineMat(w) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${w.toFixed(4)};`); };
  m.customProgramCacheKey = () => 'ink' + w; return m;
}
const RIM = { value: 0.45 };
function toonMat(v, opt = {}) {
  const base = Object.assign({ color: grey(v), emissive: grey(v * (opt.glow ?? 0.28)) }, opt.map ? { map: opt.map } : {}, opt.side ? { side: opt.side } : {});
  // faceted cloth and visor: flat-shaded Lambert (the toon material has no flat shading in r186)
  const m = opt.flat ? new THREE.MeshLambertMaterial(Object.assign(base, { flatShading: true })) : new THREE.MeshToonMaterial(Object.assign(base, { gradientMap: toonRamp() }));
  if (opt.rim) { // a moonlit edge, so a dark figure still reads against the dark
    const k = opt.rim;
    m.onBeforeCompile = (sh) => { sh.uniforms.uRim = RIM; sh.fragmentShader = 'uniform float uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.6);
      outgoingLight += vec3(uRim * ${k.toFixed(2)} * rimF);
      #include <opaque_fragment>`); };
    m.customProgramCacheKey = () => 'rim' + k + (opt.flat ? 'f' : '');
  }
  return m;
}
function inked(geo, v, w = 0.012, opt = {}) {
  const m = new THREE.Mesh(geo, toonMat(v, opt)); m.castShadow = true;
  const o = new THREE.Mesh(geo, MODEL.ink[w] || (MODEL.ink[w] = outlineMat(w))); m.add(o);
  return m;
}
function buildWanderer() {
  MODEL.ink = {};
  const paper = fabricTexture('paper'), knit = fabricTexture('weave'); knit.repeat.set(4, 3);
  MODEL.tex = { paper, weave: knit };
  const W_INK = 0.016;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.17;
  const GI = 80, GI2 = 104, WRAP = 132, SASH = 150, HOOD = 64, VISOR = 184, BOOT = 30, R = { rim: 1 };
  const ink = (geo, v, w, opt) => inked(geo, v, w, Object.assign({ glow: 0.06, rim: 1 }, opt));
  // the gi: a dark layered wrap, a lighter sash with a knot and short ends
  const prof = [[0.0, -0.01], [0.19, -0.01], [0.205, 0.03], [0.21, 0.13], [0.19, 0.22], [0.14, 0.29], [0.07, 0.31], [0.0, 0.315]].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = ink(new THREE.LatheGeometry(prof, 32), GI, W_INK, { map: knit }); body.add(torso);
  for (const sd of [-1, 1]) { const lap = ink(new THREE.BoxGeometry(0.05, 0.25, 0.025), GI2, 0.006, { map: knit }); lap.position.set(sd * 0.045, 0.2, 0.18); lap.rotation.set(-0.36, 0, sd * 0.52); body.add(lap); }
  const sash = ink(new THREE.CylinderGeometry(0.214, 0.214, 0.06, 32, 1, true), SASH, 0.008, { map: knit, side: THREE.DoubleSide, glow: 0.12 }); sash.position.y = 0.06; body.add(sash);
  const sashKnot = ink(new THREE.SphereGeometry(0.04, 10, 8), SASH, 0.008, { map: knit, glow: 0.12 }); sashKnot.scale.set(1.3, 0.9, 0.7); sashKnot.position.set(-0.1, 0.06, 0.19); body.add(sashKnot);
  const sashEnds = [0, 1].map(k => { const e = ink(new THREE.BoxGeometry(0.045, 0.13, 0.012), SASH, 0.006, { map: knit, glow: 0.12 }); e.geometry.translate(0, -0.065, 0); e.position.set(-0.1 + k * 0.03, 0.05, 0.2); e.rotation.z = 0.15 - k * 0.3; body.add(e); return e; });
  // the katana across the back: a dark scabbard, a wrapped hilt over the right shoulder
  const scab = ink(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 10), 20, 0.008); scab.position.set(-0.02, 0.2, -0.22); scab.rotation.set(0.22, 0, 0.9); body.add(scab);
  const hilt = new THREE.Group(); hilt.position.set(0.2, 0.43, -0.25); hilt.rotation.set(0.22, 0, 0.9); body.add(hilt);
  const grip = ink(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8), 150, 0.006, { glow: 0.2 }); hilt.add(grip);
  for (let k = 0; k < 4; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 4, 10), new THREE.MeshBasicMaterial({ color: grey(14) })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.055 + k * 0.035; hilt.add(ring); }
  const tsuba = ink(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12), 30, 0.005); tsuba.position.y = -0.085; hilt.add(tsuba);
  MODEL.scab = scab; MODEL.hilt = hilt;
  // the scarf's collar: a faceted wrap of cloth at the neck (its tails are simulated cloth)
  const collar = ink(new THREE.TorusGeometry(0.13, 0.062, 5, 9), 158, W_INK * 0.8, { map: knit, flat: true, glow: 0.18 }); collar.rotation.x = Math.PI / 2 - 0.15; collar.position.set(0, 0.31, -0.01); body.add(collar);
  MODEL.collar = collar;
  // the head: a round dark hood-helmet with panel seams and a pale faceted visor
  const neck = new THREE.Group(); neck.position.y = 0.31; body.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.33; neck.add(headG);
  const head = ink(new THREE.SphereGeometry(0.36, 48, 36), HOOD, W_INK, { map: knit }); head.scale.set(1.04, 1.0, 1.0); headG.add(head);
  const seamMat = new THREE.MeshBasicMaterial({ color: grey(92) });
  const seam1 = new THREE.Mesh(new THREE.TorusGeometry(0.364, 0.005, 4, 48, Math.PI * 1.15), seamMat); seam1.rotation.set(0, Math.PI / 2, Math.PI * 0.42); headG.add(seam1);
  for (const sd of [-1, 1]) { const sm = new THREE.Mesh(new THREE.TorusGeometry(0.364, 0.004, 4, 32, Math.PI * 0.55), seamMat); sm.rotation.set(0, Math.PI / 2 + sd * 0.55, Math.PI * 0.5); headG.add(sm); }
  const visorGeo = new THREE.SphereGeometry(0.372, 7, 3, Math.PI / 2 - 1.02, 2.04, 1.2, 0.62);
  const visor = ink(visorGeo, VISOR, 0.01, { flat: true, glow: 0.3, rim: 0.4 }); visor.scale.set(1.04, 1, 1.0); headG.add(visor);
  MODEL.visor = visor;
  // the eyes: glowing lenses in dark sockets; their shape is rebuilt every frame from the mood
  const lensMat = new THREE.MeshBasicMaterial({ color: grey(248) }), sockMat = new THREE.MeshBasicMaterial({ color: grey(6) });
  const eyes = [-1, 1].map(sd => {
    const g = new THREE.Group(); const ex = sd * 0.13, ey = -0.005, ez = 0.372; g.position.set(ex, ey, ez); g.lookAt(ex * 3, ey * 3, ez * 3); headG.add(g);
    const mk = (mat, z) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EYE_N * 3 + 3), 3)); const idx = []; for (let i = 0; i < EYE_N; i++) idx.push(0, 1 + i, 1 + (i + 1) % EYE_N); geo.setIndex(idx); const m = new THREE.Mesh(geo, mat); m.position.z = z; g.add(m); return m; };
    const sock = mk(sockMat, 0.004), lens = mk(lensMat, 0.008);
    const e = { g, sock, lens, sd, shape: { w: 1, h: 1, top: 0.04, tilt: 0, bot: 0, botCurve: 0 } };
    writeEye(sock, e.shape, 1.32, sd); writeEye(lens, e.shape, 1.0, sd); // a resting shape before the first frame
    return e;
  });
  // arms: dark sleeves, light wrapped forearms, dark gloves
  const arms = [-1, 1].map(sd => {
    const sh = new THREE.Group(); sh.position.set(sd * 0.19, 0.25, 0); body.add(sh);
    const sleeve = ink(new THREE.CapsuleGeometry(0.058, 0.09, 6, 14), GI, W_INK * 0.8, { map: knit }); sleeve.position.y = -0.08; sh.add(sleeve);
    const cuff = new THREE.Group(); cuff.position.y = -0.17; sh.add(cuff);
    const wrap = ink(new THREE.CylinderGeometry(0.052, 0.046, 0.09, 14), WRAP, 0.008, { map: knit, glow: 0.12 }); wrap.position.y = -0.02; cuff.add(wrap);
    const hand = ink(new THREE.SphereGeometry(0.052, 14, 10), 30, 0.01); hand.scale.set(1, 1.1, 0.9); hand.position.y = -0.085; cuff.add(hand);
    return { sh, sleeve, cuff, hand };
  });
  // legs: baggy trousers, wrapped shins, split-toe boots
  const legs = [-1, 1].map(sd => {
    const hip = new THREE.Group(); hip.position.set(sd * 0.09, 0.0, 0); body.add(hip);
    const leg = ink(new THREE.CapsuleGeometry(0.068, 0.05, 4, 12), GI - 6, W_INK * 0.8, { map: knit }); leg.position.y = -0.06; hip.add(leg);
    const shin = ink(new THREE.CylinderGeometry(0.05, 0.045, 0.06, 12), WRAP - 20, 0.006, { map: knit, glow: 0.1 }); shin.position.y = -0.115; hip.add(shin);
    const foot = ink(new THREE.SphereGeometry(0.062, 14, 10), BOOT, W_INK * 0.8); foot.scale.set(0.9, 0.62, 1.4); foot.position.set(0, -0.15, 0.03); hip.add(foot);
    return hip;
  });
  // the blade, drawn for a stroke
  const sword = new THREE.Group(); arms[1].hand.add(sword);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.66), new THREE.MeshBasicMaterial({ color: grey(242) })); blade.position.z = 0.4; sword.add(blade);
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.016, 12), new THREE.MeshBasicMaterial({ color: grey(10) })); guard.rotation.x = Math.PI / 2; guard.position.z = 0.06; sword.add(guard);
  sword.visible = false;
  // the kite-wing: the scarf unfurled across the back, held at its front edge (shown while gliding)
  const wing = new THREE.Group(); wing.position.set(0, 0.3, -0.16); body.add(wing);
  const WX = 8, WZ = 3, wgeo = new THREE.BufferGeometry(), widx = [], wuv = [];
  for (let j = 0; j < WZ; j++) for (let i = 0; i < WX; i++) wuv.push(i / (WX - 1) * 3, j / (WZ - 1) * 1.2);
  for (let j = 0; j < WZ - 1; j++) for (let i = 0; i < WX - 1; i++) { const a = j * WX + i; widx.push(a, a + WX, a + 1, a + 1, a + WX, a + WX + 1); }
  wgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WX * WZ * 3), 3)); wgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(wuv), 2)); wgeo.setIndex(widx);
  const wingMesh = new THREE.Mesh(wgeo, toonMat(162, { map: knit, side: THREE.DoubleSide, flat: true, glow: 0.22, rim: 0.6 })); wingMesh.castShadow = true; wingMesh.frustumCulled = false;
  const wingInk = new THREE.Mesh(wgeo, outlineMat(0.01)); wingInk.frustumCulled = false; wingMesh.add(wingInk);
  wing.add(wingMesh); wing.visible = false;
  const wr = makeRng(77); MODEL.wingJag = Array.from({ length: WX * WZ }, () => (wr() - 0.5) * 0.06);
  Object.assign(MODEL, { root, body, neck, headG, head, eyes, arms, legs, sword, torso, sashEnds, wing, wingMesh, WX, WZ });
  return root;
}
/** Shape the kite-wing: a faceted canopy, arched in the middle, tips drooping, its trailing edge fluttering. */
function shapeWing(k, t, bank) {
  const M = MODEL, pa = M.wingMesh.geometry.attributes.position, WX = M.WX, WZ = M.WZ, span = 0.9 * k;
  for (let j = 0; j < WZ; j++) for (let i = 0; i < WX; i++) {
    const u = i / (WX - 1) * 2 - 1, v = j / (WZ - 1), id = j * WX + i;
    const x = u * span * (1 - v * 0.18), z = -v * 0.62 * Math.sqrt(k) - 0.02;
    const y = 0.16 * (1 - u * u) * k - 0.12 * u * u * k + (v > 0.5 ? Math.sin(t * 14 + u * 4) * 0.035 * v : 0) + u * bank * 0.18 + M.wingJag[id] * v;
    pa.setXYZ(id, x, y, z);
  }
  pa.needsUpdate = true; M.wingMesh.geometry.computeVertexNormals(); M.wingMesh.geometry.computeBoundingSphere(); // the ink outline is pushed out along these
}
/** One eye's lens: an ellipse cut by a lid line above (tilted) and a lifted cheek below. */
const EYE_N = 40;
function writeEye(mesh, S, scale, sd) {
  const pa = mesh.geometry.attributes.position, w = 0.075 * S.w * scale, h = 0.095 * S.h * scale;
  const topY = h * (1 - 2 * S.top), botY = -h * (1 - 2 * S.bot);
  pa.setXYZ(0, 0, (topY + botY + S.botCurve * 0.9 * h) / 2, 0); // the fan's centre stays inside the shape, even for the smile's crescent
  for (let i = 0; i < EYE_N; i++) {
    const a = i / EYE_N * Math.PI * 2; let x = Math.cos(a) * w, y = Math.sin(a) * h;
    const lid = topY + S.tilt * sd * x / w * h * 0.6;           // an angled lid: brows that set
    const cheek = botY + S.botCurve * (1 - (x / w) ** 2) * h * 0.9; // a lifted, curved lower lid: a smile in the eyes
    y = clamp(y, Math.min(cheek, lid - 0.004), Math.max(lid, cheek + 0.004));
    pa.setXYZ(1 + i, x, y, 0);
  }
  pa.needsUpdate = true; mesh.geometry.computeBoundingSphere();
}

// Personality: what the spirit looks at, and the small things it does.
const MOOD = { stoneT: -9, craneT: -9, flipT: -9, lookYaw: 0, lookPitch: 0, tilt: 0, idleT: 0, peer: 0 };
function onEvent(e) {
  if (e.type === 'stone') MOOD.stoneT = GAME.time;
  if (e.type === 'crane') MOOD.craneT = GAME.time;
  if (e.type === 'walljump') MOOD.flipT = GAME.time; // a flip off the wall
}
/** Where the head wants to look: a crane, a critter, the edge below, the moon, or ahead. */
function lookTarget(hs) {
  const fx = Math.cos(P.facing), fz = Math.sin(P.facing);
  let best = null, bd = 9;
  for (const c of CRANES) if (!c.found) { const d = c.home.distanceTo(P.pos); if (d < bd) { bd = d; best = c.home; } }
  let kind = best ? 'crane' : '';
  if (!best) for (const c of CRITTERS) if (c.alive) { const d = c.pos.distanceTo(P.pos); if (d < 8 && d < bd) { bd = d; best = c.pos; kind = 'critter'; } }
  // an edge ahead: peer down
  MOOD.peer = 0;
  if (P.grounded && hs < 2) { const ax = P.pos.x + fx * 1.4, az = P.pos.z + fz * 1.4; if (groundAt(ax, az, P.pos.y + 0.3).h < P.pos.y - 3) MOOD.peer = 1; }
  if (best) {
    const dx = best.x - P.pos.x, dy = best.y - (P.pos.y + 0.9), dz = best.z - P.pos.z;
    return { yaw: angleDiff(P.facing, Math.atan2(dz, dx)), pitch: Math.atan2(dy, Math.hypot(dx, dz)), kind };
  }
  if (MOOD.peer) return { yaw: 0, pitch: -0.6, kind: 'edge' };
  if (MOOD.idleT > 1.6) { // the moon, then a slow look around
    const my = angleDiff(P.facing, Math.atan2(MOON.z, MOON.x)), mp = Math.asin(MOON.y);
    const wander = Math.sin(GAME.time * 0.23) * 0.5;
    return { yaw: clamp(my, -1.2, 1.2) * (0.6 + 0.4 * Math.cos(GAME.time * 0.23)) + wander * 0.4, pitch: mp + 0.1, kind: 'moon' };
  }
  return { yaw: 0, pitch: -0.05, kind: '' };
}

const ANIM = { phase: 0, roll: 0, sword: 0, prevFacing: 0, yawRate: 0, prevHs: 0, accel: 0, blinkT: 2, j: {} };
function spring(name, target, k, dt) {
  const j = ANIM.j[name] || (ANIM.j[name] = { x: target, v: 0 });
  const c = 2 * Math.sqrt(k); j.v += (k * (target - j.x) - c * j.v) * dt; j.x += j.v * dt; return j.x;
}
/** Pose the spirit for this frame (cosmetic, frame-rate based). */
function animateWanderer(dt, pos) {
  const M = MODEL, hs = Math.hypot(P.vel.x, P.vel.z), runK = clamp(hs / 9, 0, 1.3);
  dt = Math.min(dt, 1 / 30);
  M.root.position.copy(pos);
  M.root.rotation.set(0, Math.PI / 2 - P.facing, 0);
  if (dt > 0) {
    ANIM.yawRate += (angleDiff(ANIM.prevFacing, P.facing) / dt - ANIM.yawRate) * damp(8, dt);
    ANIM.accel += ((hs - ANIM.prevHs) / dt - ANIM.accel) * damp(6, dt);
  }
  ANIM.prevFacing = P.facing; ANIM.prevHs = hs;
  MOOD.idleT = P.grounded && hs < 0.3 && P.mode === 'normal' ? MOOD.idleT + dt : 0;
  P.squashV += (-P.squash * 190 - P.squashV * 15) * dt; P.squash += P.squashV * dt;
  const sq = clamp(P.squash, -0.35, 0.4);
  let sx = 1 + sq * 0.6, sy = 1 - sq, sz = 1 + sq * 0.6;
  let pitch = 0, roll = 0, twist = 0, by = 0.17, lL = 0, lR = 0, aLx = 0.05, aLz = 0.42, aRx = 0.05, aRz = -0.42, kLeg = 260, kArm = 160, kBody = 140;
  const t = GAME.time, sinceCrane = t - MOOD.craneT, sinceStone = t - MOOD.stoneT;
  if (P.grounded && P.mode !== 'roll' && P.mode !== 'slide') {
    const freq = 1.6 + hs * 0.38; ANIM.phase += dt * freq * Math.PI * 2;
    const sn = Math.sin(ANIM.phase);
    lL = sn * 0.9 * runK; lR = -lL; aLx = -sn * 0.7 * runK + 0.05; aRx = sn * 0.7 * runK + 0.05; aLz = 0.42 + runK * 0.1; aRz = -aLz;
    by += (1 - Math.cos(ANIM.phase * 2)) * 0.5 * 0.07 * runK - 0.02 * runK;
    pitch = 0.06 + 0.14 * runK + clamp(ANIM.accel * 0.02, -0.15, 0.22);
    twist = sn * 0.12 * runK;
    roll = clamp(-ANIM.yawRate * hs * 0.012, -0.36, 0.36);
    // at full momentum: lean hard, arms stream straight back
    const nk = smooth(0.62, 0.92, hs / (tune.run_speed + tune.momentum_max));
    if (nk > 0) { aLx = lerp(aLx, 1.45, nk); aRx = lerp(aRx, 1.45, nk); aLz = lerp(aLz, 0.3, nk); aRz = lerp(aRz, -0.3, nk); pitch = lerp(pitch, 0.6, nk); twist *= 1 - nk * 0.7; }
    if (hs < 0.4) { // breathing, a small sway
      by += Math.sin(t * 2.0) * 0.007; aLz = 0.4 + Math.sin(t * 2.0) * 0.03; aRz = -aLz; roll = Math.sin(t * 0.7) * 0.03;
      if (MOOD.peer) { pitch = 0.32; aLx = -0.3; aRx = -0.3; } // leaning to peer over an edge
    }
    if (sinceCrane < 0.9) { const k = sinceCrane / 0.9; by += Math.sin(k * Math.PI) * 0.16; sy *= 1 + Math.sin(k * Math.PI * 2) * 0.08; aLz = 0.9; aRz = -0.9; } // a little hop of joy
    kLeg = 160 + hs * 40;
  } else if (P.mode === 'slide') {
    pitch = -0.5; by = 0.12; lL = -1.3; lR = -0.3; aLz = 0.9; aRz = -0.6; aLx = -0.4;
  } else if (P.mode === 'roll') {
    by = 0.2; lL = -1.5; lR = -1.5; aLx = -1.3; aRx = -1.3;
  } else if (P.mode === 'wallrun') {
    ANIM.phase += dt * (2.4 + hs * 0.4) * Math.PI * 2;
    const sn = Math.sin(ANIM.phase); lL = sn * 1.05; lR = -lL; aLx = -sn * 0.5; aRx = sn * 0.5;
    const side = Math.sign((P.wall.nx * -Math.sin(P.facing) + P.wall.nz * Math.cos(P.facing)) || 1);
    roll = side * 0.5; pitch = 0.2;
    if (side > 0) aLz = 1.3; else aRz = -1.3;
  } else if (P.mode === 'mantle') {
    pitch = 0.5; aLx = -2.6; aRx = -2.6; lL = -1.0; lR = -0.2; kArm = 400;
  } else if (P.mode === 'dash') {
    pitch = 0.45; lL = -0.7; lR = 0.4; aLx = 0.6; aLz = 0.6; sx = 0.84; sy = 0.86; sz = 1.3;
  } else { // air: rising tucks, the top opens, the float spreads the sleeves like wings
    if (P.vel.y > 1) { lL = -1.0; lR = -0.3; aLx = -0.5; aRx = -0.3; aLz = 0.7; aRz = -0.7; pitch = 0.12; }
    else if (P.floating) { aLz = 1.5 + Math.sin(t * 3) * 0.05; aRz = -aLz; aLx = -0.35; aRx = -0.35; lL = 0.35 + Math.sin(t * 3.6) * 0.1; lR = 0.2 - Math.sin(t * 3.6) * 0.1; pitch = 0.32; by += Math.sin(t * 3.6) * 0.015; } // arms out along the wing's edge, body leaning into the glide
    else { lL = 0.3; lR = -0.1; aLx = -0.9; aRx = -0.9; aLz = 0.8; aRz = -0.8; pitch = -0.04; }
    roll = clamp(-ANIM.yawRate * hs * 0.008, -0.3, 0.3);
  }
  if (P.landHard > 0) { P.landHard -= dt; by -= 0.12; pitch = 0.5; lL = -1.2; lR = 0.5; aRx = -1.1; aRz = -0.15; aLx = 0.7; aLz = 0.8; } // a crouched three-point landing
  if (P.strikeAnim > 0) { P.strikeAnim -= dt; ANIM.sword = 0.2; }
  ANIM.sword = Math.max(0, ANIM.sword - dt);
  const striking = ANIM.sword > 0;
  if (striking) { const k = 1 - Math.pow(1 - clamp(1 - P.strikeAnim / 0.32, 0, 1), 3); aRx = -2.2 + k * 3.4; aRz = 0.4 - k * 0.8; kArm = 900; }
  const B = M.body;
  B.position.y = spring('by', by, kBody * 1.6, dt);
  const flipK = (t - MOOD.flipT) / 0.5;
  if (P.mode === 'roll') { const k = 1 - Math.max(0, P.rollT) / 0.36; B.rotation.x = k * Math.PI * 2; ANIM.j.pitch = { x: 0.3, v: 0 }; }
  else if (flipK >= 0 && flipK < 1 && !P.grounded) { const e = 1 - Math.pow(1 - flipK, 2); B.rotation.x = e * Math.PI * 2; ANIM.j.pitch = { x: 0.2, v: 0 }; lL = -1.4; lR = -1.4; } // tucked
  else B.rotation.x = spring('pitch', pitch, kBody, dt);
  B.rotation.z = spring('roll', roll, kBody * 0.7, dt);
  B.rotation.y = spring('twist', twist, kBody * 1.4, dt);
  M.root.scale.set(sx, sy, sz);
  M.legs[0].rotation.x = spring('lL', lL, kLeg, dt); M.legs[1].rotation.x = spring('lR', lR, kLeg, dt);
  M.arms[0].sh.rotation.x = spring('aLx', aLx, kArm, dt); M.arms[0].sh.rotation.z = spring('aLz', aLz, kArm, dt);
  M.arms[1].sh.rotation.x = spring('aRx', aRx, kArm, dt); M.arms[1].sh.rotation.z = spring('aRz', aRz, kArm, dt);
  // the sleeves' mouths trail the arms: cloth lags the limb it hangs from
  M.arms.forEach((a, i) => { const id = i ? 'R' : 'L'; a.cuff.rotation.x = spring('cuff' + id, -(a.sh.rotation.x - (ANIM.j['cuffT' + id] || { x: 0 }).x) * 0.6, 90, dt); ANIM.j['cuffT' + id] = { x: a.sh.rotation.x, v: 0 }; });
  M.sword.visible = striking; if (M.hilt) M.hilt.visible = !striking;
  // the scarf unfurls into the kite-wing while gliding, and wraps back when released
  ANIM.wingK = spring('wing', P.floating ? 1 : 0, P.floating ? 320 : 180, dt);
  const wk = clamp(ANIM.wingK, 0, 1.15);
  M.wing.visible = wk > 0.03; if (M.wing.visible) { shapeWing(wk, t, clamp(-ANIM.yawRate * 0.25, -1, 1)); M.wing.rotation.x = -0.12 - clamp(-P.vel.y * 0.03, 0, 0.2); }
  // the sash's short ends trail the motion
  M.sashEnds.forEach((e, i) => { e.rotation.x = spring('se' + i, 0.2 + runK * 0.8 + (!P.grounded && P.vel.y < 0 ? 0.7 : 0) + Math.sin(t * 10 + i) * 0.1 * runK, 110, dt); });
  // the head: steadied against the body, then turned toward what it is curious about
  const L = lookTarget(hs);
  const nod = sinceStone < 1.4 ? Math.sin(clamp(sinceStone / 1.4, 0, 1) * Math.PI) * 0.45 : 0; // a small proud nod at a stone
  const tilt = L.kind === 'crane' ? 0.28 : L.kind === 'moon' ? Math.sin(t * 0.31) * 0.12 : L.kind === 'critter' ? -0.1 : 0;
  M.neck.rotation.order = 'YXZ';
  M.neck.rotation.y = spring('hy', clamp(-L.yaw, -1.1, 1.1) * (striking ? 0 : 1) - B.rotation.y, 60, dt);
  M.neck.rotation.x = spring('hp', clamp(-L.pitch, -0.55, 0.65) + nod - B.rotation.x * 0.6, 60, dt);
  M.neck.rotation.z = spring('ht', tilt - B.rotation.z * 0.5, 50, dt);
  // the eyes: the face is all in the lenses' shape and size
  ANIM.blinkT -= dt; if (ANIM.blinkT < -0.12) ANIM.blinkT = 2.4 + (Math.sin(t * 13.7) * 0.5 + 0.5) * 3.2;
  const happy = P.floating || sinceCrane < 1.6 || (sinceStone < 1.2 && sinceStone > 0.3);
  const fallScared = !P.grounded && P.vel.y < -9 && !P.floating;
  let want;                                                       // w, h, top (lid), tilt, bot, botCurve
  if (P.hurtT > 0) want = [1.15, 0.28, 0, 0, 0, 0];
  else if (striking || P.mode === 'dash') want = [1.12, 0.82, 0.34, 0.9, 0, 0];      // set, angled: determined
  else if (fallScared) want = [1.22, 1.25, 0, 0, 0, 0];                             // wide
  else if (happy) want = [1.05, 0.95, 0, 0, 0.42, 0.75];                            // a smile in the eyes
  else if (L.kind === 'crane') want = [1.0, 1.12, 0, -0.3, 0, 0];                   // curious, brows up
  else if (L.kind === 'critter') want = [1.05, 0.9, 0.22, 0.6, 0, 0];               // wary
  else if (MOOD.peer) want = [0.95, 1.05, 0.1, -0.2, 0, 0];
  else if (L.kind === 'moon') want = [1.0, 0.92, 0.12, -0.15, 0.08, 0.2];          // soft, a little dreamy
  else if (runK > 0.75) want = [1.08, 0.86, 0.22, 0.55, 0, 0];                      // focused at speed
  else want = [1, 1, 0.04, 0, 0, 0];
  const keys = ['w', 'h', 'top', 'tilt', 'bot', 'botCurve'];
  for (const e of M.eyes) {
    const S = e.shape;
    keys.forEach((k, i) => {
      let v = want[i];
      if (L.kind === 'crane' && k === 'h' && e.sd > 0) v *= 1.12;                   // one eye bigger: a head-tilt of curiosity
      S[k] = spring('eye' + k + e.sd, v, 260, dt);
    });
    const blink = ANIM.blinkT < 0 ? 0.08 : 1, saved = S.h; S.h = Math.max(0.05, S.h * blink);
    writeEye(e.sock, S, 1.32, e.sd); writeEye(e.lens, S, 1.0, e.sd); S.h = saved;
    e.g.position.x = e.sd * 0.13 + clamp(-L.yaw, -1, 1) * 0.008;                   // the eyes drift toward what they watch
  }
  M.root.visible = !(P.invuln > 0 && Math.floor(GAME.time * 12) % 2 === 0);
}

// ---------------------------------------------------------------------------------------------
// Cloth: the scarf's two torn, faceted tails (ladders of two edges, so they twist and catch the
// light on their facets; follow-the-leader links, pushed out of the head and body), and pale
// flecks that break off their tips at speed and on landings.
const CLOTH = { tails: [], ties: [], ready: false, flecks: [], fleckMesh: null };
const SCARF = { mesh: null };
function buildScarf() {
  const grp = new THREE.Group(), r = makeRng(404);
  [{ n: 12, w: 0.27, seg: 0.11, off: -0.05 }, { n: 9, w: 0.19, seg: 0.1, off: 0.04 }].forEach(T => {
    const idx = [], uv = [];
    for (let i = 0; i < T.n; i++) uv.push(0, i / (T.n - 1) * 2, 1, i / (T.n - 1) * 2);
    for (let i = 0; i < T.n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T.n * 2 * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, toonMat(178, { map: MODEL.tex.weave, side: THREE.DoubleSide, flat: true, glow: 0.24, rim: 0.6 })); m.castShadow = true;
    const o = new THREE.Mesh(g, outlineMat(0.008)); m.add(o); m.frustumCulled = false; o.frustumCulled = false;
    // torn edges: each rung a little wider or narrower, the tip ragged and notched
    T.jag = Array.from({ length: T.n }, (_, i) => [1 + (r() - 0.5) * 0.5 * (i / T.n + 0.3), 1 + (r() - 0.5) * 0.5 * (i / T.n + 0.3)]);
    const tail = Object.assign(T, { mesh: m, L: [], R: [], oL: [], oR: [] });
    for (let i = 0; i < T.n; i++) { tail.L.push(new THREE.Vector3()); tail.R.push(new THREE.Vector3()); tail.oL.push(new THREE.Vector3()); tail.oR.push(new THREE.Vector3()); }
    CLOTH.tails.push(tail); grp.add(m);
  });
  // hood ties: two short dark strips at the back of the helmet that swing
  CLOTH.ties = [-1, 1].map(sd => {
    const n = 5, segs = [];
    for (let i = 0; i < n - 1; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.028, 1, 0.008), toonMat(70, { glow: 0.1, rim: 0.5 })); m.castShadow = true; grp.add(m); segs.push(m); }
    return { n, seg: 0.05, sd, segs, pts: Array.from({ length: n }, () => new THREE.Vector3()), old: Array.from({ length: n }, () => new THREE.Vector3()) };
  });
  // flecks: small pale shards
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.03, 0, -0.022, -0.02, 0.005, 0.025, -0.015, -0.004]), 3));
  CLOTH.fleckMesh = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: grey(200), side: THREE.DoubleSide }), 48);
  CLOTH.fleckMesh.count = 0; CLOTH.fleckMesh.frustumCulled = false; grp.add(CLOTH.fleckMesh);
  grp.frustumCulled = false; SCARF.mesh = grp;
  return grp;
}
function clothAnchors() {
  const M = MODEL; M.root.updateMatrixWorld(true);
  return {
    roots: [new THREE.Vector3(-0.07, 0.31, -0.16).applyMatrix4(M.body.matrixWorld), new THREE.Vector3(-0.02, 0.3, -0.17).applyMatrix4(M.body.matrixWorld)],
    across: new THREE.Vector3(1, 0, 0).transformDirection(M.body.matrixWorld),
    headC: new THREE.Vector3(0, 0, 0).applyMatrix4(M.headG.matrixWorld), bodyC: new THREE.Vector3(0, 0.15, 0).applyMatrix4(M.body.matrixWorld),
    ties: [-1, 1].map(sd => new THREE.Vector3(sd * 0.06, 0.02, -0.365).applyMatrix4(M.headG.matrixWorld)),
  };
}
function scarfReset() {
  if (!CLOTH.tails.length || !MODEL.root) return;
  MODEL.root.position.copy(P.pos);
  const A = clothAnchors(), back = new THREE.Vector3(-Math.cos(P.facing), 0, -Math.sin(P.facing));
  CLOTH.tails.forEach((T, k) => { for (let i = 0; i < T.n; i++) { T.L[i].copy(A.roots[k]).addScaledVector(back, i * T.seg * 0.8); T.L[i].y -= i * T.seg * 0.5; T.R[i].copy(T.L[i]).addScaledVector(A.across, T.w); T.oL[i].copy(T.L[i]); T.oR[i].copy(T.R[i]); } });
  CLOTH.ties.forEach((S, k) => S.pts.forEach((p, i) => { p.copy(A.ties[k]); p.y -= i * S.seg; S.old[i].copy(p); }));
  CLOTH.ready = true;
}
function clothGround(x, z) { return scene === 'figures' ? 0 : terrainH(x, z); }
function verletStep(p, o, damping, ax, ay, az, h) {
  const vx = (p.x - o.x) * damping, vy = (p.y - o.y) * damping, vz = (p.z - o.z) * damping;
  o.copy(p); p.x += vx + ax * h * h; p.y += vy + ay * h * h; p.z += vz + az * h * h;
}
function follow(a, b, ob, len) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6;
  if (d > len) { const f = (d - len) / d, cx = dx * f, cy = dy * f, cz = dz * f; b.x -= cx; b.y -= cy; b.z -= cz; ob.x -= cx * 0.8; ob.y -= cy * 0.8; ob.z -= cz * 0.8; }
}
function spacing(a, b, len, k) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, f = (d - len) / d * 0.5 * k;
  a.x += dx * f; a.y += dy * f; a.z += dz * f; b.x -= dx * f; b.y -= dy * f; b.z -= dz * f;
}
function pushOutSphere(p, c, r) { const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz); if (d < r && d > 1e-6) { const k = (r - d) / d; p.x += dx * k; p.y += dy * k; p.z += dz * k; } }
let _fleckT = 0; const _tv = new THREE.Vector3(), _ty = new THREE.Vector3(0, 1, 0);
function spawnFleck(p, n = 1) {
  for (let k = 0; k < n && CLOTH.flecks.length < 48; k++) {
    const s = (CLOTH.flecks.length * 7919 + GAME.steps * 31) % 1000 / 1000;
    CLOTH.flecks.push({ x: p.x, y: p.y, z: p.z, vx: P.vel.x * -0.05 + (s - 0.5) * 1.2, vy: 0.4 + s * 0.8, vz: P.vel.z * -0.05 + (0.5 - s) * 1.2, life: 0.7 + s * 0.5, rx: s * 6, ry: s * 3 });
  }
}
function updateScarf(dt, wind) {
  if (!CLOTH.ready) scarfReset();
  dt = Math.min(dt, 1 / 30); if (dt <= 0) return;
  const A = clothAnchors(), steps = 2, h = dt / steps, hs = Math.hypot(P.vel.x, P.vel.z);
  const g = P.floating ? -2.5 : -9.8;
  for (let st = 0; st < steps; st++) {
    CLOTH.tails.forEach((T, ti) => {
      const root = A.roots[ti];
      T.L[0].copy(root); T.oL[0].copy(root); T.R[0].copy(root).addScaledVector(A.across, T.w * 0.6); T.oR[0].copy(T.R[0]);
      for (let i = 1; i < T.n; i++) {
        const fl = Math.sin(GAME.time * 8 + i * 0.75 + ti * 2.1) * (0.9 + wind.s * 1.8 + hs * 0.12) * (i / T.n);
        verletStep(T.L[i], T.oL[i], 0.95, wind.x * 2.4 + fl * wind.z, g * 0.6 + fl * 0.4, wind.z * 2.4 - fl * wind.x, h);
        verletStep(T.R[i], T.oR[i], 0.95, wind.x * 2.4 - fl * wind.z, g * 0.6 - fl * 0.4, wind.z * 2.4 + fl * wind.x, h);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < T.n; i++) {
          follow(T.L[i - 1], T.L[i], T.oL[i], T.seg); follow(T.R[i - 1], T.R[i], T.oR[i], T.seg);
          spacing(T.L[i], T.R[i], T.w * (1 - i / T.n * 0.45), 0.7);
        }
        for (let i = 1; i < T.n; i++) for (const p of [T.L[i], T.R[i]]) { pushOutSphere(p, A.headC, 0.4); pushOutSphere(p, A.bodyC, 0.24); const gh = clothGround(p.x, p.z) + 0.02; if (p.y < gh) p.y = gh; }
      }
    });
  }
  // the hood ties: follow-the-leader chains that swing behind the helmet
  for (const [k, S] of CLOTH.ties.entries()) {
    S.pts[0].copy(A.ties[k]); S.old[0].copy(S.pts[0]);
    for (let i = 1; i < S.n; i++) { const fl = Math.sin(GAME.time * 9 + i + k * 2) * (0.6 + hs * 0.08); verletStep(S.pts[i], S.old[i], 0.92, wind.x * 0.9 + fl * 0.3, g * 0.8, wind.z * 0.9 - fl * 0.3, dt); }
    for (let i = 1; i < S.n; i++) { follow(S.pts[i - 1], S.pts[i], S.old[i], S.seg); pushOutSphere(S.pts[i], A.headC, 0.39); }
    for (let i = 0; i < S.n - 1; i++) {
      const a = S.pts[i], b = S.pts[i + 1], m = S.segs[i]; m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      _tv.set(b.x - a.x, b.y - a.y, b.z - a.z); const len = _tv.length() || 1e-4; m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(_ty, _tv.multiplyScalar(1 / len));
      m.visible = MODEL.root.visible;
    }
  }
  // write the tails: ragged rungs, a notched tip
  for (const T of CLOTH.tails) {
    const tp = T.mesh.geometry.attributes.position;
    for (let i = 0; i < T.n; i++) {
      const L0 = T.L[i], R0 = T.R[i], mx = (L0.x + R0.x) / 2, my = (L0.y + R0.y) / 2, mz = (L0.z + R0.z) / 2, [jl, jr] = T.jag[i];
      const tipK = i === T.n - 1 ? 0.35 : 1;
      tp.setXYZ(i * 2, mx + (L0.x - mx) * jl * tipK, my + (L0.y - my) * jl * tipK + (i === T.n - 1 ? -0.03 : 0), mz + (L0.z - mz) * jl * tipK);
      tp.setXYZ(i * 2 + 1, mx + (R0.x - mx) * jr, my + (R0.y - my) * jr, mz + (R0.z - mz) * jr);
    }
    tp.needsUpdate = true; T.mesh.geometry.computeVertexNormals();
  }
  // flecks break off the tips at speed
  _fleckT -= dt;
  if (scene !== 'figures' && hs > 8.5 && _fleckT <= 0) { const T = CLOTH.tails[0]; spawnFleck(T.L[T.n - 1]); _fleckT = 0.09; }
  const fm = CLOTH.fleckMesh, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
  let n = 0;
  CLOTH.flecks = CLOTH.flecks.filter(f => (f.life -= dt) > 0);
  for (const f of CLOTH.flecks) { f.vy -= 2.2 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.rx += dt * 7; f.ry += dt * 5; e.set(f.rx, f.ry, 0); q.setFromEuler(e); const k = Math.min(1, f.life * 2); sc.set(k, k, k); pp.set(f.x, f.y, f.z); m4.compose(pp, q, sc); fm.setMatrixAt(n++, m4); }
  fm.count = n; fm.instanceMatrix.needsUpdate = true;
  const vis = MODEL.root.visible && (ANIM.wingK || 0) < 0.35; for (const T of CLOTH.tails) T.mesh.visible = vis; // the tails become the wing
}

// ---------------------------------------------------------------------------------------------
// The strike's smear: a tapering ink-brush stroke along the dash, fading after.
const TRAIL = { n: 12, pts: [], life: 0, mesh: null };
function buildTrail() {
  const geo = new THREE.BufferGeometry(), n = TRAIL.n;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  TRAIL.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: grey(228), side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  TRAIL.mesh.frustumCulled = false; TRAIL.mesh.visible = false;
  return TRAIL.mesh;
}
function trailStart() { TRAIL.pts = []; TRAIL.life = 1; }
function updateTrail(dt, pos) {
  if (TRAIL.life <= 0) { TRAIL.mesh.visible = false; return; }
  if (P.mode === 'dash') { TRAIL.pts.push(pos.clone().add(new THREE.Vector3(0, 0.75, 0))); if (TRAIL.pts.length > TRAIL.n) TRAIL.pts.shift(); TRAIL.life = 1; }
  else TRAIL.life -= dt * 3.2;
  const pts = TRAIL.pts; if (pts.length < 2) { TRAIL.mesh.visible = false; return; }
  TRAIL.mesh.visible = true; TRAIL.mesh.material.opacity = 0.85 * clamp(TRAIL.life, 0, 1);
  const pa = TRAIL.mesh.geometry.attributes.position, n = TRAIL.n, cam = CAM.camera.position, side = new THREE.Vector3(), dir = new THREE.Vector3(), view = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = pts[Math.min(pts.length - 1, Math.floor(i / (n - 1) * (pts.length - 1)))];
    const q = pts[Math.min(pts.length - 1, Math.floor(i / (n - 1) * (pts.length - 1)) + 1)] || p;
    dir.subVectors(q, p); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    view.subVectors(cam, p); side.crossVectors(dir, view).normalize();
    const t = i / (n - 1), w = 0.28 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * clamp(TRAIL.life, 0, 1);
    pa.setXYZ(i * 2, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
    pa.setXYZ(i * 2 + 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
  }
  pa.needsUpdate = true;
}
