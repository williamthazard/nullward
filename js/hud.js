// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// The 2D overlay: pips as ink drops, cranes found, flow, the teaching hints, touch controls, and
// the title, pause and results screens. Every icon is drawn, never a font symbol.
'use strict';

const INKC = '#000', PALE = '#d6d6d6', DIM = '#9a9a9a', FAINT = 'rgba(214,214,214,0.35)';

function shadowText(s, x, y, size, c = PALE, align = 'center') {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = size * 0.35; text(s, x, y, size, c, align); ctx.restore();
}
function drawDrop(x, y, s, full) { // an ink drop
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.bezierCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.75, y - s * 0.05, x + s * 0.62, y + s * 0.38);
  ctx.arc(x, y + s * 0.3, s * 0.62, 0.15, Math.PI - 0.15); ctx.bezierCurveTo(x - s * 0.75, y - s * 0.05, x - s * 0.2, y - s * 0.5, x, y - s); ctx.closePath();
  ctx.fillStyle = full ? PALE : 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = full ? '#000' : FAINT; ctx.stroke();
}
function drawCraneIcon(x, y, s, c = PALE) { // a folded paper crane
  ctx.fillStyle = c; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  const tri = (a, b, d) => { ctx.beginPath(); ctx.moveTo(x + a[0] * s, y + a[1] * s); ctx.lineTo(x + b[0] * s, y + b[1] * s); ctx.lineTo(x + d[0] * s, y + d[1] * s); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  tri([-1, 0.1], [0, -0.85], [0.15, 0.25]); tri([1, 0.1], [0, -0.85], [-0.15, 0.25]);
  tri([-0.9, 0.2], [-0.55, -0.55], [-0.3, 0.25]); tri([0.9, 0.2], [0.55, -0.6], [0.3, 0.25]);
}
function drawChevron(x, y, s, up = true, c = PALE) {
  ctx.beginPath(); const k = up ? 1 : -1;
  ctx.moveTo(x - s, y + s * 0.45 * k); ctx.lineTo(x, y - s * 0.45 * k); ctx.lineTo(x + s, y + s * 0.45 * k);
  ctx.lineWidth = s * 0.32; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = c; ctx.stroke();
}
function drawSlash(x, y, s, c = PALE) { // a brush stroke, thick in the middle
  ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.8); ctx.quadraticCurveTo(x - s * 0.1, y + s * 0.05, x + s, y - s * 0.85);
  ctx.quadraticCurveTo(x + s * 0.05, y + s * 0.3, x - s, y + s * 0.8); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.9, y + s * 0.7); ctx.quadraticCurveTo(x, y + s * 0.15, x + s * 0.9, y - s * 0.7); ctx.lineWidth = s * 0.18; ctx.strokeStyle = c; ctx.stroke();
}
function drawLanternIcon(x, y, s, lit) { // a stone lantern: cap, light box, post
  ctx.fillStyle = lit ? '#efefef' : 'rgba(150,150,150,0.55)'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.35); ctx.lineTo(x, y - s * 1.05); ctx.lineTo(x + s, y - s * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(x - s * 0.55, y - s * 0.3, s * 1.1, s * 0.75); ctx.strokeRect(x - s * 0.55, y - s * 0.3, s * 1.1, s * 0.75);
  ctx.fillRect(x - s * 0.18, y + s * 0.45, s * 0.36, s * 0.7); ctx.fillRect(x - s * 0.6, y + s * 1.1, s * 1.2, s * 0.22);
}
function drawPauseIcon(x, y, s, c = PALE) { ctx.fillStyle = c; ctx.fillRect(x - s * 0.55, y - s * 0.7, s * 0.38, s * 1.4); ctx.fillRect(x + s * 0.17, y - s * 0.7, s * 0.38, s * 1.4); }
function ring(x, y, r, fill, line = FAINT, w = 3) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.lineWidth = w; ctx.strokeStyle = line; ctx.stroke(); }

/** A labelled button: drawn, and registered so a tap or click on it acts. */
function button(x, y, w, h, label, act, on = false) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = on ? 'rgba(214,214,214,0.22)' : 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = on ? PALE : FAINT; ctx.stroke();
  text(label, x, y + 1, Math.min(26, h * 0.5), on ? '#fff' : PALE);
  UI_BUTTONS.push({ x, y, w, h, act });
}
/** Name a control for the device in use. */
function K(name) {
  const d = INPUT.device;
  const t = { jump: { keys: 'Space', pad: 'A', touch: 'jump' }, strike: { keys: 'click or F', pad: 'X', touch: 'strike' }, move: { keys: 'WASD', pad: 'the left stick', touch: 'your left thumb' },
    calm: { keys: 'C', pad: 'Y', touch: 'tap here' }, slide: { keys: 'Shift', pad: 'B', touch: 'slide' } };
  return t[name][d] || t[name].keys;
}

// ---------------------------------------------------------------------------------------------
function hudPlay() {
  const sa = SAFE;
  // pips: ink drops, top left
  const max = maxPips();
  for (let i = 0; i < max; i++) drawDrop(sa.l + 40 + i * 38, sa.t + 44, 15, i < P.pips);
  // cranes found, top right (left of the pause on touch)
  const cx = VW - sa.r - (INPUT.device === 'touch' ? 150 : 60);
  drawCraneIcon(cx - 40, sa.t + 44, 18, GAME.cranes ? PALE : DIM);
  shadowText(`${GAME.cranes}/${WORLD.cranes.length}`, cx, sa.t + 46, 26, PALE, 'left');
  ENC.shrines.forEach((sh, i) => drawLanternIcon(cx - 150 + i * 30, sa.t + 44, 12, sh.lit)); // the shrines lit
  // a short note when something changes
  if (GAME.toast) { const a = clamp(Math.min(GAME.toast.t * 3, (4.5 - GAME.toast.t) * 1.5), 0, 1); ctx.globalAlpha = a; shadowText(GAME.toast.text, VW / 2, sa.t + 110, 24, '#ececec'); ctx.globalAlpha = 1; }
  // flow and time, quiet, under the pips
  if (!SETTINGS.calm) {
    shadowText(fmtTime(GAME.runTime), sa.l + 26, sa.t + 92, 20, DIM, 'left');
    if (P.flow >= 3) shadowText(`flow ${P.flow}`, sa.l + 26, sa.t + 122, 22, P.flow >= 8 ? '#fff' : PALE, 'left');
  } else shadowText('calm', sa.l + 26, sa.t + 92, 20, DIM, 'left');
  // a hint, low and centred
  const h = GAME.hintText;
  if (h) { ctx.globalAlpha = clamp(GAME.hintA, 0, 1); shadowText(h, VW / 2, VH - sa.b - (INPUT.device === 'touch' ? 300 : 70), 26, PALE); ctx.globalAlpha = 1; }
  // at a standing stone: the Calm switch
  if (GAME.atStone >= 0 && GAME.respawnT <= 0) {
    const y = VH / 2 + 150;
    button(VW / 2, y, 300, 52, SETTINGS.calm ? 'Calm: on' : 'Calm: off', toggleCalm, SETTINGS.calm);
    text(INPUT.device === 'touch' ? '' : `${K('calm')} to switch`, VW / 2, y + 44, 18, DIM);
  }
  if (INPUT.device === 'touch') drawTouch();
}
function drawTouch() {
  const L = touchLayout();
  ring(L.jump.x, L.jump.y, L.jump.r, TOUCH.jump !== null ? 'rgba(214,214,214,0.25)' : 'rgba(0,0,0,0.3)', P.floating ? PALE : FAINT, 3);
  drawChevron(L.jump.x, L.jump.y - 4, 26, true, P.floating ? '#fff' : PALE);
  ring(L.strike.x, L.strike.y, L.strike.r, 'rgba(0,0,0,0.3)', P.airDash || P.grounded ? FAINT : 'rgba(214,214,214,0.15)', 3);
  drawSlash(L.strike.x, L.strike.y, 22, P.airDash || P.grounded ? PALE : DIM);
  ring(L.slide.x, L.slide.y, L.slide.r, 'rgba(0,0,0,0.25)', FAINT, 2); drawChevron(L.slide.x, L.slide.y + 2, 13, false, DIM);
  ring(L.pause.x, L.pause.y, L.pause.r, 'rgba(0,0,0,0.3)', FAINT, 2); drawPauseIcon(L.pause.x, L.pause.y, 14);
  if (TOUCH.stick) { ring(TOUCH.stick.ox, TOUCH.stick.oy, 70, 'rgba(0,0,0,0.2)', FAINT, 2); ring(TOUCH.stick.x, TOUCH.stick.y, 30, 'rgba(214,214,214,0.25)', PALE, 2); }
  else if (GAME.runTime < 8) { ring(SAFE.l + 150, VH - SAFE.b - 150, 70, null, 'rgba(214,214,214,0.18)', 2); text('move', SAFE.l + 150, VH - SAFE.b - 150, 20, DIM); }
}
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

function hudTitle() {
  const cy = VH * 0.24;
  shadowText('N U L L W A R D', VW / 2, cy, Math.min(84, VW / 11), '#e6e6e6');
  shadowText('cross the nullscape to the spire', VW / 2, cy + 64, 24, DIM);
  const dev = INPUT.device, lines = dev === 'touch'
    ? ['left thumb: move    right: jump (hold to float), strike    drag: look']
    : dev === 'pad' ? ['left stick: move    right stick: look    A: jump (hold to float)    X: strike    B: slide']
    : CONTROLS;
  lines.forEach((c, i) => shadowText(c, VW / 2, VH * 0.47 + i * 27, 20, PALE));
  const by = Math.min(VH * 0.47 + lines.length * 27 + 42, VH - SAFE.b - 178);
  button(VW / 2, by, 320, 60, dev === 'touch' ? 'tap to begin' : 'Enter to begin', () => startRun(), true);
  button(VW / 2 - 330, by + 80, 300, 48, SETTINGS.calm ? 'Calm: on (C)' : 'Calm: off (C)', toggleCalm, SETTINGS.calm);
  button(VW / 2, by + 80, 300, 48, `Brightness ${Math.round(SETTINGS.bright * 100)}% (B)`, cycleBright);
  button(VW / 2 + 330, by + 80, 300, 48, `Quality: ${RENDER.tier} (Q)`, cycleTier);
  shadowText('Calm is for younger players: more hits, slower critters, longer glides and wall-runs, gentler falls', VW / 2, by + 124, 18, DIM);
  shadowText(`world ${WORLD.seed}   ·   N: a new world   ·   M: mute`, VW / 2, VH - SAFE.b - 26, 18, DIM);
}
function hudPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, VW, VH);
  shadowText('paused', VW / 2, VH * 0.26, 52, '#e6e6e6');
  const y = VH * 0.42;
  button(VW / 2, y, 340, 54, INPUT.device === 'touch' ? 'resume' : 'resume (P)', () => { scene = 'play'; }, true);
  button(VW / 2, y + 70, 340, 50, SETTINGS.calm ? 'Calm: on (C)' : 'Calm: off (C)', toggleCalm, SETTINGS.calm);

  button(VW / 2 - 180, y + 134, 340, 50, `Brightness ${Math.round(SETTINGS.bright * 100)}% (B)`, cycleBright);
  button(VW / 2 + 180, y + 134, 340, 50, `Quality: ${RENDER.tier} (Q)`, cycleTier);
  button(VW / 2, y + 198, 340, 50, 'back to the last stone (R)', () => { scene = 'play'; respawnAt(stoneSpot(GAME.lastStone), true); });
  button(VW / 2, y + 262, 340, 50, 'a new world (N)', () => { newWorld(nextSeed()); startRun(); });
  button(VW / 2, y + 326, 340, 50, muted ? 'sound: off (M)' : 'sound: on (M)', () => setMuted(!muted));
  shadowText('Calm is for younger players: more hits, slower critters, longer glides and wall-runs, gentler falls', VW / 2, VH - SAFE.b - 70, 18, DIM);
  if (INPUT.device === 'keys') shadowText(CONTROLS.join('    '), VW / 2, VH - SAFE.b - 40, 18, DIM);
}
function hudResults() {
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, VW, VH);
  shadowText('the spire', VW / 2, VH * 0.2, 58, '#efefef');
  const R = GAME.result, y = VH * 0.34;
  shadowText(`time ${fmtTime(R.time)}${R.par ? `   (par ${fmtTime(R.par)})` : ''}`, VW / 2, y, 30, PALE);
  if (!SETTINGS.calm) shadowText(`longest flow ${R.flow}`, VW / 2, y + 46, 30, PALE);
  drawCraneIcon(VW / 2 - 90, y + 96, 18); shadowText(`${R.cranes} of ${R.total} cranes`, VW / 2 - 60, y + 98, 30, PALE, 'left');
  shadowText(`world ${WORLD.seed}: share the link and play the same land`, VW / 2, y + 150, 22, DIM);
  button(VW / 2 - 180, y + 230, 320, 58, INPUT.device === 'touch' ? 'this world again' : 'this world again (Enter)', () => startRun(), true);
  button(VW / 2 + 180, y + 230, 320, 58, INPUT.device === 'touch' ? 'a new world' : 'a new world (N)', () => { newWorld(nextSeed()); startRun(); });
}
function hudFigures(items) {
  for (const it of items) {
    const v = it.obj.position.clone(); v.y += it.labelY; v.project(FIG.camera);
    const x = (v.x * 0.5 + 0.5) * VW, y = (-v.y * 0.5 + 0.5) * VH;
    shadowText(it.label, x, y, 26, '#f0f0f0');
  }
  shadowText('who walks the nullscape', VW / 2, SAFE.t + 50, 30, '#f0f0f0');
}
