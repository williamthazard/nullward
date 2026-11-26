// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// Every way in, folded into one INPUT each step: keys (index.html's down/hit sets), the mouse with
// pointer lock, a gamepad, and touch designed first: a floating stick under the left thumb, a big
// jump button (hold to float), a strike button, and a drag anywhere else to look.
'use strict';

const INPUT = { wish: new THREE.Vector3(), stick: { x: 0, y: 0 }, jumpHeld: false, jumpPressed: false, strikePressed: false, slidePressed: false, device: 'keys' };
const TOUCH = { active: false, stick: null, look: new Map(), jump: null, strike: false, slide: false, pending: { jump: false, strike: false, slide: false } };
const PAD = { prev: [], connected: false };
let UI_BUTTONS = []; // hit areas the HUD draws this frame: { x, y, r, id, act }

// Touch controls' layout in HUD units (see hud.js: VW x VH, the short side is 720)
function touchLayout() {
  const sa = SAFE, r = VW - sa.r, b = VH - sa.b;
  return {
    jump: { x: r - 130, y: b - 130, r: 82 },
    strike: { x: r - 280, y: b - 168, r: 60 },
    slide: { x: r - 104, y: b - 286, r: 40 },
    pause: { x: r - 54, y: sa.t + 54, r: 34 },
  };
}
function hudPoint(e) { return { x: e.clientX / HUDK, y: e.clientY / HUDK }; }
const inCircle = (p, c, pad = 0) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + pad;

function initInput() {
  const el = document.getElementById('game');
  el.addEventListener('pointerdown', onPointerDown, { passive: false });
  addEventListener('pointermove', onPointerMove, { passive: false });
  addEventListener('pointerup', onPointerUp, { passive: false });
  addEventListener('pointercancel', onPointerUp, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && scene === 'play' && INPUT.device === 'keys' && !GAME.lockLostOk) scene = 'pause'; GAME.lockLostOk = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement && (scene === 'play')) { CAM.yaw += e.movementX * tune.look_sens; CAM.pitch = clamp(CAM.pitch - e.movementY * tune.look_sens, -1.1, 0.55); CAM.lookIdle = 0; }
  });
  addEventListener('gamepadconnected', () => { PAD.connected = true; });
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
}

function onPointerDown(e) {
  startAudio();
  e.preventDefault();
  const p = hudPoint(e);
  if (e.pointerType === 'touch' || e.pointerType === 'pen') { INPUT.device = 'touch'; TOUCH.active = true; } else INPUT.device = 'keys';
  // HUD buttons (menus, the Calm toggle) first; none while the mouse is captured
  if (!document.pointerLockElement) for (const b of UI_BUTTONS) if (inCircle(p, b, 6) || (b.w && Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2)) {
    b.act(); sfx('ui');
    if (scene === 'play' && e.pointerType === 'mouse' && !document.pointerLockElement) { try { const r = e.target.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
    return;
  }
  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    INPUT.device = 'touch'; TOUCH.active = true;
    if (scene !== 'play') { if (scene === 'title' || scene === 'results') return; }
    const L = touchLayout();
    if (inCircle(p, L.pause, 8)) { scene = scene === 'play' ? 'pause' : 'play'; return; }
    if (inCircle(p, L.jump, 14)) { TOUCH.jump = e.pointerId; TOUCH.pending.jump = true; return; }
    if (inCircle(p, L.strike, 12)) { TOUCH.pending.strike = true; TOUCH.strikeId = e.pointerId; return; }
    if (inCircle(p, L.slide, 10)) { TOUCH.pending.slide = true; return; }
    if (p.x < VW * 0.45 && !TOUCH.stick) { TOUCH.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }; return; }
    TOUCH.look.set(e.pointerId, { x: p.x, y: p.y });
    return;
  }
  // mouse
  INPUT.device = 'keys';
  if (scene === 'play') {
    if (!document.pointerLockElement && e.button === 0) { try { const r = e.target.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} return; }
    if (e.button === 0) hit.add('MouseStrike');
    if (e.button === 2) TOUCH.look.set('mouse', { x: p.x, y: p.y });
  }
}
function onPointerMove(e) {
  const p = hudPoint(e);
  if (TOUCH.stick && e.pointerId === TOUCH.stick.id) {
    const dx = p.x - TOUCH.stick.ox, dy = p.y - TOUCH.stick.oy, d = Math.hypot(dx, dy), R = 70;
    if (d > R) { TOUCH.stick.ox = p.x - dx / d * R; TOUCH.stick.oy = p.y - dy / d * R; } // the stick's base follows a long drag
    TOUCH.stick.x = p.x; TOUCH.stick.y = p.y; return;
  }
  const key = e.pointerType === 'mouse' ? 'mouse' : e.pointerId, lk = TOUCH.look.get(key);
  if (lk) {
    const sens = e.pointerType === 'mouse' ? tune.look_sens * 1.5 : tune.touch_look_sens;
    CAM.yaw += (p.x - lk.x) * sens * (e.pointerType === 'mouse' ? 1 : 1); CAM.pitch = clamp(CAM.pitch - (p.y - lk.y) * sens, -1.1, 0.55);
    lk.x = p.x; lk.y = p.y; CAM.lookIdle = 0;
  }
}
function onPointerUp(e) {
  if (TOUCH.stick && e.pointerId === TOUCH.stick.id) TOUCH.stick = null;
  if (TOUCH.jump === e.pointerId) TOUCH.jump = null;
  TOUCH.look.delete(e.pointerType === 'mouse' ? 'mouse' : e.pointerId);
}

/** Poll the gamepad; returns its state or null. */
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && Array.from(pads).find(p => p && p.connected);
  if (!gp) return null;
  const dz = v => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
  const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const now = gp.buttons.map(b => b.pressed), edge = i => now[i] && !PAD.prev[i];
  const s = { lx: dz(gp.axes[0] || 0), ly: dz(gp.axes[1] || 0), rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0), jump: btn(0), jumpE: edge(0), strikeE: edge(2) || edge(7), slideE: edge(1) || edge(6), startE: edge(9), calmE: edge(3) };
  PAD.prev = now;
  if (s.lx || s.ly || s.rx || s.ry || now.some(Boolean)) INPUT.device = 'pad';
  return s;
}

/** Fold everything into INPUT for this step (camera-relative move intent in world space). */
function readInput(dt) {
  const pad = readPad();
  let mx = 0, my = 0;
  if (down.has('KeyW') || down.has('ArrowUp')) my += 1;
  if (down.has('KeyS') || down.has('ArrowDown')) my -= 1;
  if (down.has('KeyD') || down.has('ArrowRight')) mx += 1;
  if (down.has('KeyA') || down.has('ArrowLeft')) mx -= 1;
  if (mx || my) INPUT.device = 'keys';
  if (pad) { mx += pad.lx; my -= pad.ly; CAM.yaw += pad.rx * tune.pad_look_speed * dt; CAM.pitch = clamp(CAM.pitch - pad.ry * tune.pad_look_speed * 0.7 * dt, -1.1, 0.55); if (pad.rx || pad.ry) CAM.lookIdle = 0; }
  if (TOUCH.stick) { const R = 70; mx += clamp((TOUCH.stick.x - TOUCH.stick.ox) / R, -1, 1); my -= clamp((TOUCH.stick.y - TOUCH.stick.oy) / R, -1, 1); }
  let m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; m = 1; }
  if (m < 0.12) { mx = 0; my = 0; }
  else if (TOUCH.stick || (pad && (pad.lx || pad.ly))) { // a console curve: a nudge walks, most of the throw runs
    const c = m < 0.34 ? lerp(0.38, 0.68, (m - 0.12) / 0.22) : m < 0.86 ? lerp(0.68, 1, (m - 0.34) / 0.52) : 1;
    mx *= c / m; my *= c / m;
  }
  INPUT.stick.x = mx; INPUT.stick.y = my;
  const fx = Math.cos(CAM.yaw), fz = Math.sin(CAM.yaw); // forward; right is (-fz, fx)
  INPUT.wish.set(fx * my - fz * mx, 0, fz * my + fx * mx);
  INPUT.jumpHeld = down.has('Space') || (pad && pad.jump) || TOUCH.jump !== null;
  INPUT.jumpPressed = pressed('Space') || (pad && pad.jumpE) || TOUCH.pending.jump;
  INPUT.strikePressed = pressed('KeyJ') || pressed('MouseStrike') || pressed('KeyF') || (pad && pad.strikeE) || TOUCH.pending.strike;
  INPUT.slidePressed = pressed('ShiftLeft') || pressed('ShiftRight') || pressed('KeyK') || (pad && pad.slideE) || TOUCH.pending.slide;
  INPUT.pausePressed = pressed('KeyP') || pressed('Escape') || (pad && pad.startE);
  INPUT.calmPressed = pressed('KeyC') || (pad && pad.calmE);
  TOUCH.pending.jump = TOUCH.pending.strike = TOUCH.pending.slide = false;
  return pad;
}
