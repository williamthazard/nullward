// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// The nullscape's look, at full resolution: a low moon behind the spire lighting every silhouette
// from behind, soft shadows that follow the wanderer, exponential fog toward the far-ridge grey,
// genscape's sky (haze, moon, single-pixel stars), far ridges that follow the camera at a fraction
// of its speed, drifting motes, and the finish: MSAA, soft bloom on the pale things, then
// genscape's ordered dither on true screen pixels, grain, vignette, brightness, the glitch slice.
'use strict';

const QUALITY = {
  high:   { pr: 2,   msaa: 4, bloom: true,  shadows: true,  shadowMap: 2048, grass: 1.0,  motes: 900 },
  medium: { pr: 1.5, msaa: 4, bloom: true,  shadows: true,  shadowMap: 1024, grass: 0.6,  motes: 500 },
  low:    { pr: 1,   msaa: 0, bloom: false, shadows: false, shadowMap: 512,  grass: 0.35, motes: 0 },
};
const RENDER = { tier: 'high', ft: [], world: null, veil: null, hint: null, stones: [], grassMats: [], ringAnchor: { x: 0, z: 0 }, lowFor: 0 };
const CAM = { camera: null, yaw: 0, pitch: -0.22, dist: 5.6, lookIdle: 9, shake: 0, fov: 62, target: new THREE.Vector3(), vel: new THREE.Vector3() };
const MOON = new THREE.Vector3(0.3, 0.3, 0.8).normalize();

function initRender() {
  THREE.ColorManagement.enabled = false; // grey values pass straight through, as genscape's
  const canvas = document.getElementById('world');
  const r = new THREE.WebGLRenderer({ canvas, antialias: CHEAP ? false : true, powerPreference: 'high-performance', alpha: false });
  r.outputColorSpace = THREE.LinearSRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;
  r.setClearColor(grey(16), 1);
  r.shadowMap.type = THREE.PCFShadowMap;
  RENDER.renderer = r;
  const S = RENDER.scene = new THREE.Scene();
  S.fog = new THREE.FogExp2(grey(tune.fog_value), tune.fog_density);
  CAM.camera = new THREE.PerspectiveCamera(tune.fov, 16 / 9, 0.1, 4200);
  // light: a dim sky, and the moon low behind the spire
  RENDER.hemi = new THREE.HemisphereLight(grey(150), grey(40), tune.sky_light);
  S.add(RENDER.hemi);
  const moon = RENDER.moon = new THREE.DirectionalLight(0xffffff, tune.moon_light);
  moon.castShadow = true;
  const sc = moon.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 260;
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
  S.add(moon); S.add(moon.target);
  RENDER.tier = CHEAP ? 'low' : (savedTier() || bootTier(r));
  buildSky();
  buildMotes();
  buildComposer();
  applyTier();
  addEventListener('resize', resizeRender);
}
/** The starting tier: low on a Chromebook or a software renderer, medium on a phone or tablet. */
function bootTier(r) {
  try {
    const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/CrOS/.test(navigator.userAgent) || /swiftshader|llvmpipe|softpipe|software/i.test(gpu)) return 'low';
  } catch (_) {}
  if (/iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)) || matchMedia('(pointer: coarse)').matches) return 'medium';
  return 'high';
}
function savedTier() { try { const t = JSON.parse(localStorage.getItem('nullward') || '{}').quality; return QUALITY[t] ? t : null; } catch (_) { return null; } }
function tierCfg() { return QUALITY[RENDER.tier]; }
function pixelRatio() { return CHEAP ? 0.5 : Math.min(devicePixelRatio || 1, tierCfg().pr); }

function buildComposer() {
  if (CHEAP) return;
  const r = RENDER.renderer, cfg = tierCfg();
  if (RENDER.composer) RENDER.composer.dispose();
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: cfg.msaa });
  const C = RENDER.composer = new THREE.EffectComposer(r, rt);
  C.addPass(new THREE.RenderPass(RENDER.scene, CAM.camera));
  RENDER.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), tune.bloom_strength, tune.bloom_radius, tune.bloom_threshold);
  RENDER.bloom.enabled = cfg.bloom;
  C.addPass(RENDER.bloom);
  RENDER.finish = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(4, 4) }, uTime: { value: 0 }, uBright: { value: 1 }, uLevels: { value: 40 },
      uGlitch: { value: 0 }, uGY: { value: 0.5 }, uGH: { value: 0.03 }, uGS: { value: 0.02 }, uFade: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uBright, uLevels, uGlitch, uGY, uGH, uGS, uFade;
      varying vec2 vUv;
      float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv; float band = 0.0;
        if (uGlitch > 0.0 && abs(uv.y - uGY) < uGH) { uv.x = fract(uv.x + uGS); band = 1.0; }
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float v = dot(c, vec3(0.299, 0.587, 0.114));                         // greyscale, always
        v = pow(clamp(v, 0.0, 1.0), 1.0 / uBright) * 255.0;
        vec2 px = floor(gl_FragCoord.xy);
        v += (hash(px + fract(uTime * 0.37) * 91.0) + hash(px.yx * 1.3 + fract(uTime * 0.53) * 57.0) - 1.0) * 1.6; // fine grain
        vec2 n = vUv * 2.0 - 1.0;
        v *= clamp(1.0 - 0.07 * dot(n, n), 0.0, 1.0);                         // genscape's vignette
        v *= 1.0 - 0.28 * smoothstep(0.6, 1.5, length(n * vec2(uRes.x / uRes.y, 1.0) * 0.62));
        float step = 255.0 / (uLevels - 1.0);
        v = floor(v / step + bayer8(px)) * step;                               // genscape's ordered dither, on screen pixels
        if (band > 0.0 && hash(vec2(px.y, floor(uTime * 30.0))) > 0.97) v = 255.0;
        v *= 1.0 - uFade;
        gl_FragColor = vec4(vec3(clamp(v, 0.0, 255.0) / 255.0), 1.0);
      }`,
  });
  C.addPass(RENDER.finish);
}
/** Apply the quality tier: resolution, MSAA, bloom, shadows, grass density, motes. */
function applyTier() {
  const cfg = tierCfg(), r = RENDER.renderer;
  r.shadowMap.enabled = !CHEAP && cfg.shadows;
  RENDER.moon.castShadow = !CHEAP && cfg.shadows;
  if (RENDER.moon.shadow.mapSize.x !== cfg.shadowMap) { RENDER.moon.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap); if (RENDER.moon.shadow.map) { RENDER.moon.shadow.map.dispose(); RENDER.moon.shadow.map = null; } }
  if (RENDER.composer && RENDER.composer.renderTarget1.samples !== cfg.msaa) buildComposer();
  if (RENDER.bloom) RENDER.bloom.enabled = cfg.bloom;
  if (RENDER.grass) for (const g of RENDER.grass) g.mesh.count = Math.floor(g.total * cfg.grass);
  if (RENDER.motes) RENDER.motes.geometry.setDrawRange(0, cfg.motes);
  resizeRender();
}
function setTier(t) { RENDER.tier = t; applyTier(); try { const s = JSON.parse(localStorage.getItem('nullward') || '{}'); s.quality = t; localStorage.setItem('nullward', JSON.stringify(s)); } catch (_) {} }
function cycleTier() { const order = ['high', 'medium', 'low']; setTier(order[(order.indexOf(RENDER.tier) + 1) % 3]); }
function resizeRender() {
  const w = innerWidth, h = innerHeight, pr = pixelRatio(), r = RENDER.renderer;
  r.setPixelRatio(pr); r.setSize(w, h, true);
  if (RENDER.composer) {
    RENDER.composer.setPixelRatio(pr); RENDER.composer.setSize(w, h);
    RENDER.finish.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
    RENDER.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
  }
  CAM.camera.aspect = w / h; CAM.camera.updateProjectionMatrix();
}
/** Step the quality down when frames stay slow; never in a check. */
function adaptScale(frameMs) {
  if (CHEAP || !(frameMs > 0) || frameMs > 250) return;
  RENDER.ft.push(frameMs); if (RENDER.ft.length < 120) return;
  const sorted = RENDER.ft.slice().sort((a, b) => a - b), med = sorted[60]; RENDER.ft = [];
  if (med > 24) { RENDER.lowFor++; if (RENDER.lowFor >= 2 && RENDER.tier !== 'low') { RENDER.lowFor = 0; setTier(RENDER.tier === 'high' ? 'medium' : 'low'); } }
  else RENDER.lowFor = 0;
}

// ---------------------------------------------------------------------------------------------
// Sky, motes and the far ridges
function buildSky() {
  const geo = new THREE.SphereGeometry(3000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMoon: { value: MOON }, uFog: { value: tune.fog_value }, uTime: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uMoon; uniform float uFog, uTime, uSeed;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1 + uSeed); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1.0, 0.0), 1.0)), c = hash(vec3(i + vec2(0.0, 1.0), 1.0)), d = hash(vec3(i + 1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s / 0.96875; }
      void main(){
        vec3 d = normalize(vDir); float e = d.y;
        vec2 sp = d.xz / (abs(e) + 0.28);
        float haze = fbm(sp * 0.9 + vec2(uTime * 0.004, uSeed * 7.0));
        float v = 16.0 + haze * 22.0;
        v = mix(v, uFog + 6.0, smoothstep(0.22, 0.0, e));        // a soft seam of light at the horizon
        if (e < 0.0) v = mix(uFog + 6.0, uFog, smoothstep(0.0, -0.08, e));
        float ang = acos(clamp(dot(d, uMoon), -1.0, 1.0));
        float disc = smoothstep(0.0125, 0.0108, ang);
        if (disc > 0.0) { // the moon's face: dark seas and a soft limb
          vec3 mr = normalize(cross(vec3(0.0, 1.0, 0.0), uMoon)), mu = cross(uMoon, mr);
          vec2 mp = vec2(dot(d, mr), dot(d, mu)) / 0.0125; float mz = sqrt(max(0.0, 1.0 - dot(mp, mp)));
          float maria = fbm(mp * 2.1 + vec2(3.7, 8.2)); float alb = mix(0.62, 1.0, smoothstep(0.38, 0.68, maria));
          v += 215.0 * disc * alb * pow(mz, 0.3);
        }
        v += 70.0 * exp(-ang * ang / (2.0 * 0.03 * 0.03)) + 40.0 * exp(-ang * ang / (2.0 * 0.16 * 0.16));
        vec3 sc = floor(d * 1400.0); float h = hash(sc);
        if (h > 0.99965 && e > 0.04) v = max(v, (80.0 + 90.0 * hash(sc + 7.0)) * (0.8 + 0.2 * sin(uTime * (1.0 + 3.0 * hash(sc + 3.0)) + h * 50.0)));
        gl_FragColor = vec4(vec3(v / 255.0), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  RENDER.sky = new THREE.Mesh(geo, mat); RENDER.sky.renderOrder = -10; RENDER.sky.frustumCulled = false;
  RENDER.scene.add(RENDER.sky);
}
function buildMotes() { // drifting specks in the air near the camera: dust, ash, seeds
  const N = 900, pos = new Float32Array(N * 3), r = makeRng(77);
  for (let i = 0; i < N * 3; i++) pos[i] = (r() - 0.5) * 60;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: grey(95), size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, fog: true });
  RENDER.motes = new THREE.Points(g, m); RENDER.motes.frustumCulled = false; RENDER.scene.add(RENDER.motes);
  RENDER.motePos = pos;
}
function updateMotes(dt, cam) {
  const p = RENDER.motePos, n = tierCfg().motes, w = WIND, t = GAME.time;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    p[k] += (w.x * 1.6 + Math.sin(t * 0.3 + i) * 0.15) * dt; p[k + 1] += (Math.sin(t * 0.5 + i * 1.7) * 0.12 - 0.05) * dt; p[k + 2] += (w.z * 1.6 + Math.cos(t * 0.27 + i) * 0.15) * dt;
    for (let a = 0; a < 3; a++) { const c = [cam.x, cam.y, cam.z][a], d = p[k + a] - c; if (d > 30) p[k + a] -= 60; else if (d < -30) p[k + a] += 60; }
  }
  RENDER.motes.geometry.attributes.position.needsUpdate = true;
}
function buildRidges(seed) {
  if (RENDER.rings) for (const r of RENDER.rings) RENDER.scene.remove(r.mesh);
  RENDER.rings = [];
  const layers = [{ R: 2600, f: 0.95, v: 32, lo: 0.04, hi: 0.16, sc: 2.0 }, { R: 2000, f: 0.9, v: 28, lo: 0.025, hi: 0.12, sc: 2.8 }, { R: 1500, f: 0.84, v: 24, lo: 0.01, hi: 0.09, sc: 3.6 }];
  layers.forEach((L, li) => {
    const N = 720, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      const n = ridged(x * L.sc + 40 * li, z * L.sc, seed + 77 * li, 4);
      const elev = L.lo + Math.pow(n, 1.6) * (L.hi - L.lo);
      pos.push(x * L.R, -L.R * 0.06, z * L.R, x * L.R, Math.tan(elev) * L.R, z * L.R);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: grey(L.v), fog: false, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = -9 + li; m.frustumCulled = false;
    RENDER.scene.add(m); RENDER.rings.push({ mesh: m, f: L.f });
  });
}

// ---------------------------------------------------------------------------------------------
// The world's meshes
const ENV = 2.9; // environment albedo = genscape value x ENV; the dim lights bring it back into genscape's range
function envGrey(v) { return grey(v * ENV); }
const SWAY_GLSL = (amount, fade) => `
      vec4 mvPosition = vec4( transformed, 1.0 );
      ${fade ? `float fd = 1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length((modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
      mvPosition.y *= fd; mvPosition.xz *= mix(0.2, 1.0, fd);` : ''}
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float sw = position.y * position.y * ${amount.toFixed(3)};
      float wv = sin(uTime * 1.25 + mvPosition.x * 0.07 + mvPosition.z * 0.05) * 0.7 + sin(uTime * 3.1 + mvPosition.x * 0.31 + mvPosition.z * 0.23) * 0.3;
      mvPosition.x += wv * uWind * sw;
      mvPosition.z += cos(uTime * 1.05 + mvPosition.x * 0.06) * uWind * sw * 0.55;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`;
function swayMaterial(amount, side = THREE.FrontSide, fade = null) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side });
  mat.userData.amount = amount; mat.userData.fade = fade;
  mat.userData.u = { uTime: { value: 0 }, uWind: { value: 0.5 }, uMoonView: { value: new THREE.Vector3(0, 0, -1) }, uBack: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    // moonlight through thin blades: they glow at the edges when you look toward the moon
    sh.fragmentShader = 'uniform vec3 uMoonView; uniform float uBack;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float bl = pow(max(dot(normalize(-vViewPosition), -uMoonView) * -1.0, 0.0), 5.0);
      outgoingLight += vec3(uBack * bl * vColor.r * vColor.r);
      #include <opaque_fragment>`);
    sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', SWAY_GLSL(amount, fade));
  };
  mat.customProgramCacheKey = () => 'sway' + amount + (fade ? 'f' : '');
  mat.userData.back = amount > 0.2 ? 1 : 0.6;
  RENDER.grassMats.push(mat);
  return mat;
}
/** Also cast the swaying shape into the shadow map. */
function swayDepth(mat) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.userData = { u: { uTime: mat.userData.u.uTime, uWind: mat.userData.u.uWind } };
  d.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, d.userData.u); sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', SWAY_GLSL(mat.userData.amount)); };
  d.customProgramCacheKey = () => 'swaydepth' + mat.userData.amount;
  return d;
}
function boxGeometry() { // a unit box: top a little lighter than the sides (vertex colours)
  const g = new THREE.BoxGeometry(1, 1, 1), n = g.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { const k = n.getY(i) > 0.5 ? 1 : n.getY(i) < -0.5 ? 0.4 : 0.62; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function prismGeometry() {
  const s = new THREE.Shape(); s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(0.15, 0.9); s.lineTo(-1, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
}
/** A spike of grass: a tapered, gently bent blade with a spine, apex at y = 1. */
function bladeGeometry(segs, bend, darkBase = 0.55) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, w = (1 - t) * (1 - t * 0.15), z = bend * t * t;
    // three verts per row: left, spine (a little forward), right: a folded blade catches the light
    pos.push(-w, t, z, 0, t, z + 0.18 * w, w, t, z);
    const k = darkBase + (1 - darkBase) * Math.pow(t, 0.8); col.push(k, k, k, k * 1.08, k * 1.08, k * 1.08, k, k, k);
    if (i < segs) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Build every mesh of a world; returns the group (added to the scene). */
function buildWorldMeshes(W) {
  const S = RENDER.scene;
  if (RENDER.world) { S.remove(RENDER.world); RENDER.world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
  RENDER.grassMats = []; RENDER.grass = [];
  const G = new THREE.Group(); RENDER.world = G;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const shuffle = (arr, seed) => { const r = makeRng(seed); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  // terrain: lit, smooth normals, genscape's ground values in the albedo
  {
    const T = W.terrain, n = T.n, n1 = n + 1, pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), idx = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * n1 + i, x = T.x0 + i * T.cs, z = T.z0 + j * T.cs, h = T.h[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      let v = 9 + (fbm(x / 19, z / 19, W.seed + 3, 3) - 0.5) * 7 + T.path[k] * 11;
      if (h < -20) v = 2.5;
      v = clamp(v, 2, 22) * ENV / 255; col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = v;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; idx.push(a, c, d, a, d, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.frustumCulled = false; mesh.receiveShadow = true; G.add(mesh);
  }
  // boxes: slabs, ledges, monoliths, ruins, the climb
  {
    const list = W.vis, mesh = new THREE.InstancedMesh(boxGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
    list.forEach((b, i) => { p.set(b.cx, b.cy, b.cz); e.set(0, -b.yaw, 0); q.setFromEuler(e); s.set(b.hx * 2, b.hy * 2, b.hz * 2); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, b.col === false ? grey(b.v * 1.6) : envGrey(b.v)); });
    mesh.castShadow = true; mesh.receiveShadow = true; G.add(mesh);
  }
  // spike grass: tall bent blades, genscape's spikes
  {
    const list = shuffle(W.spikes.slice(), W.seed + 1), mat = swayMaterial(0.3, THREE.DoubleSide);
    const mesh = new THREE.InstancedMesh(bladeGeometry(5, 0.35), mat, list.length), r = makeRng(W.seed + 99);
    list.forEach((k, i) => { p.set(k.x, k.y, k.z); e.set(k.tx, r() * 6.28, k.tz); q.setFromEuler(e); s.set(k.w, k.h, k.w); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, envGrey(k.v * 0.9 + 3)); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.customDepthMaterial = swayDepth(mat);
    G.add(mesh); RENDER.grass.push({ mesh, total: list.length });
  }
  // short grass along the route: a soft carpet that moves with the wind
  {
    const r = makeRng(W.seed + 7), blades = [];
    for (let s0 = 0; s0 < W.spine.length; s0 += 1) {
      const sp = W.spine[s0], nx = -Math.sin(sp.h), nz = Math.cos(sp.h);
      for (let k = 0; k < 26; k++) {
        const lat = RU.sign(r) * (1.2 + Math.pow(r(), 1.6) * 30), x = sp.x + nx * lat + RU.u(r, -0.5, 0.5), z = sp.z + nz * lat + RU.u(r, -0.5, 0.5);
        const gh = terrainH(x, z); if (gh < -5) continue;
        if (boxesAt(x, z).some(b => b.tag === 'slab' && insideBox(b, x, b.top, z, 0.2))) continue;
        blades.push({ x, y: gh - 0.05, z, h: RU.u(r, 0.22, 0.62) * (Math.abs(lat) < 2.5 ? 0.6 : 1), w: RU.u(r, 0.035, 0.06), v: RU.u(r, 6, 15), yaw: r() * 6.28, tx: RU.u(r, -0.3, 0.3) });
      }
    }
    const list = shuffle(blades, W.seed + 2), mat = swayMaterial(0.5, THREE.DoubleSide, [40, 70]);
    const mesh = new THREE.InstancedMesh(bladeGeometry(2, 0.25, 0.45), mat, list.length);
    list.forEach((k, i) => { p.set(k.x, k.y, k.z); e.set(k.tx, k.yaw, 0); q.setFromEuler(e); s.set(k.w, k.h, k.w); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, envGrey(k.v)); });
    mesh.receiveShadow = true; G.add(mesh); RENDER.grass.push({ mesh, total: list.length });
  }
  // trees: leaning cones
  {
    const list = W.trees, g = new THREE.ConeGeometry(1, 1, 7); g.translate(0, 0.5, 0);
    const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i++) c[i] = 1; g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const mat = swayMaterial(0.1), mesh = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((t, i) => { p.set(t.x, t.y, t.z); e.set(0, t.lean * 3, t.lean * 0.25); q.setFromEuler(e); s.set(t.w, t.h, t.w); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, envGrey(t.v)); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.customDepthMaterial = swayDepth(mat); G.add(mesh);
  }
  // pitched ruin tops
  if (W.roofs.length) {
    const mesh = new THREE.InstancedMesh(prismGeometry(), new THREE.MeshLambertMaterial(), W.roofs.length);
    W.roofs.forEach((t, i) => { p.set(t.x, t.y - 0.02, t.z); e.set(0, -t.yaw, 0); q.setFromEuler(e); s.set(t.w, t.w * 0.7, 0.9); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, envGrey(12)); });
    mesh.castShadow = true; G.add(mesh);
  }
  // pale streaks on the walls to run: brush strokes
  for (const d of W.decals) {
    const a = d.faceA !== undefined ? d.faceA : Math.atan2(Math.cos(d.yaw) * d.face, -Math.sin(d.yaw) * d.face);
    const g = new THREE.PlaneGeometry(d.len, d.ht, 16, 1), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const t = pa.getX(i) / d.len + 0.5; pa.setY(i, pa.getY(i) * (0.4 + Math.sin(t * Math.PI) * 0.9) + Math.sin(t * 19) * 0.03); }
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: grey(d.v + 20) }));
    m.position.set(d.x + Math.cos(a) * 0.03, d.y, d.z + Math.sin(a) * 0.03); m.rotation.y = Math.PI / 2 - a; G.add(m);
  }
  // standing stones: a dark slab with a pale glyph that glows when touched
  RENDER.stones = W.stones.map((st) => {
    const grp = new THREE.Group(); grp.position.set(st.x, st.y, st.z); grp.rotation.y = Math.PI / 2 - st.heading + 0.3;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.7, 6), new THREE.MeshLambertMaterial({ color: envGrey(14), flatShading: true }));
    slab.rotation.y = Math.PI / 6; slab.position.y = 1.3; slab.scale.z = 0.55; slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
    const glyphMat = new THREE.MeshBasicMaterial({ color: grey(44) });
    const bar = (w, h, x, y, rz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), glyphMat); m.position.set(x, y, 0.24); m.rotation.z = rz; grp.add(m); };
    bar(0.06, 0.95, 0, 1.45, 0); bar(0.05, 0.42, -0.12, 1.75, 0.7); bar(0.05, 0.42, 0.12, 1.75, -0.7); bar(0.05, 0.3, 0, 1.0, 1.57);
    for (let k = 0; k < 5; k++) { const pb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (k % 2) * 0.06, 0), new THREE.MeshLambertMaterial({ color: envGrey(9), flatShading: true })); const a = k * 1.3; pb.position.set(Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9); pb.castShadow = true; grp.add(pb); }
    G.add(grp); return { grp, glyphMat };
  });
  // the spire: a pale column and needle, seen from anywhere (no fog), and the gate's ink veil
  {
    const S2 = W.spire, colH = S2.colH;
    const col = new THREE.Mesh(new THREE.BoxGeometry(8, colH, 8), new THREE.MeshBasicMaterial({ color: grey(30), fog: false }));
    col.position.set(S2.x, S2.y + colH / 2 - 1, S2.z); col.rotation.y = -S2.heading; G.add(col);
    const crownBand = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 8.6), new THREE.MeshBasicMaterial({ color: grey(54), fog: false }));
    crownBand.position.set(S2.x, S2.y + colH - 1.2, S2.z); crownBand.rotation.y = -S2.heading; G.add(crownBand);
    const needle = new THREE.Mesh(new THREE.ConeGeometry(5.2, 230, 4), new THREE.MeshBasicMaterial({ color: grey(64), fog: false }));
    needle.position.set(S2.x, S2.y + colH + 115, S2.z); needle.rotation.y = Math.PI / 4 - S2.heading; G.add(needle);
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: grey(235), fog: false }));
    glint.position.set(S2.x, S2.y + colH + 232, S2.z); G.add(glint); RENDER.glint = glint;
    const g0 = W.gates[0];
    if (g0) {
      const veil = new THREE.Group(); veil.position.set(g0.x, g0.y, g0.z); veil.rotation.y = -g0.yaw;
      for (let k = 0; k < 9; k++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5.6, 1, 6), new THREE.MeshBasicMaterial({ color: grey(5), side: THREE.DoubleSide })); st.position.set(0, 2.9, -1.8 + k * 0.45); st.rotation.y = Math.PI / 2; veil.add(st); }
      G.add(veil); RENDER.veil = veil;
    }
  }
  // the ghost of the scarf: shows the way across the first wall-run gap after a stall
  if (W.hints.length) {
    const h = W.hints[0], g = new THREE.BufferGeometry(), pos = [], idx = [];
    h.pts.forEach((pt, i) => { pos.push(pt.x, pt.y + 0.06, pt.z, pt.x, pt.y - 0.06, pt.z); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: grey(170), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.frustumCulled = false; G.add(m); RENDER.hint = m;
  } else RENDER.hint = null;
  S.add(G);
  buildRidges(W.seed);
  RENDER.sky.material.uniforms.uSeed.value = (W.seed % 97) / 97;
  const r2 = makeRng(W.seed + 5), ma = W.spire.heading + RU.u(r2, -0.35, 0.35);
  MOON.set(Math.cos(ma), RU.u(r2, 0.2, 0.34), Math.sin(ma)).normalize(); // the moon low, behind the spire
  applyTier();
  return G;
}

// ---------------------------------------------------------------------------------------------
// The camera: an orbit behind the wanderer on springs, pulled back with speed, kept out of walls.
function camKick(a) { CAM.shake = Math.max(CAM.shake, a); }
const _ct = new THREE.Vector3();
function updateCamera(dt, target, sp) {
  const c = CAM.camera;
  CAM.lookIdle += dt;
  if (CAM.lookIdle > tune.cam_follow_delay && sp > 2 && P.mode !== 'dash') {
    const behind = Math.atan2(P.vel.z, P.vel.x), d = angleDiff(CAM.yaw, behind);
    if (Math.abs(d) < 2.6) CAM.yaw += d * damp(tune.cam_follow_rate * clamp(sp / 8, 0.3, 1.2), dt);
    CAM.pitch += (-0.2 - CAM.pitch) * damp(0.8, dt);
  }
  const k = clamp(sp / (tune.run_speed + tune.momentum_max), 0, 1.3);
  const want = tune.cam_distance + k * tune.cam_speed_pull;
  // the look-at point follows on a critically damped spring: smooth, never late for long
  _ct.set(target.x, target.y + 1.25, target.z);
  const w = 11, x = _ct.sub(CAM.target);
  CAM.vel.addScaledVector(x, w * w * dt).multiplyScalar(Math.max(0, 1 - 2 * w * dt));
  CAM.target.addScaledVector(CAM.vel, dt);
  if (CAM.target.distanceTo(new THREE.Vector3(target.x, target.y + 1.25, target.z)) > 6) CAM.target.set(target.x, target.y + 1.25, target.z);
  const cp = Math.cos(CAM.pitch), fx = Math.cos(CAM.yaw) * cp, fy = Math.sin(CAM.pitch), fz = Math.sin(CAM.yaw) * cp;
  let dist = want;
  for (let i = 1; i <= 8; i++) {
    const t = want * i / 8, x2 = CAM.target.x - fx * t, y2 = CAM.target.y - fy * t, z2 = CAM.target.z - fz * t;
    if (solidAt(x2, y2, z2)) { dist = Math.max(1.2, t - want / 8); break; }
  }
  CAM.dist += (dist - CAM.dist) * damp(dist < CAM.dist ? 20 : 3.5, dt);
  c.position.set(CAM.target.x - fx * CAM.dist, CAM.target.y - fy * CAM.dist, CAM.target.z - fz * CAM.dist);
  const gh = terrainH(c.position.x, c.position.z) + 0.5; if (c.position.y < gh) c.position.y = gh;
  if (CAM.shake > 0.001) {
    const s2 = CAM.shake * 0.12; c.position.x += Math.sin(GAME.time * 61) * s2; c.position.y += Math.sin(GAME.time * 47 + 1) * s2; c.position.z += Math.cos(GAME.time * 53) * s2;
    CAM.shake *= Math.exp(-dt * 12);
  }
  c.lookAt(CAM.target);
  CAM.fov += (tune.fov + k * tune.fov_speed - CAM.fov) * damp(3, dt);
  if (Math.abs(c.fov - CAM.fov) > 0.01) { c.fov = CAM.fov; c.updateProjectionMatrix(); }
}

const _mv = new THREE.Vector3(), _ld = new THREE.Vector3(), _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _wy = new THREE.Vector3(0, 1, 0);
/** Draw the 3D scene through the finish. */
function renderWorld(time, dt) {
  const r = RENDER.renderer, c = CAM.camera;
  RENDER.sky.position.copy(c.position);
  RENDER.sky.material.uniforms.uTime.value = time;
  RENDER.sky.material.uniforms.uFog.value = tune.fog_value;
  if (RENDER.rings) for (const g of RENDER.rings) g.mesh.position.set(c.position.x * g.f + RENDER.ringAnchor.x * (1 - g.f), c.position.y, c.position.z * g.f + RENDER.ringAnchor.z * (1 - g.f));
  const f = RENDER.scene.fog; f.color.copy(grey(tune.fog_value)); f.density = tune.fog_density;
  RENDER.hemi.intensity = tune.sky_light; RENDER.moon.intensity = tune.moon_light;
  // the moon's light follows the wanderer, snapped to its shadow texels so edges never crawl
  { // in the light's own frame, snapped to whole shadow texels (as Blobby Worlds does)
    const L = _ld.copy(MOON).normalize(), R = _lr.crossVectors(_wy, L).normalize(), U = _lu.crossVectors(L, R);
    const ts = 76 / RENDER.moon.shadow.mapSize.x, p = P.pos;
    const u = Math.round(p.dot(R) / ts) * ts, v = Math.round(p.dot(U) / ts) * ts, w = p.dot(L);
    RENDER.moon.target.position.set(R.x * u + U.x * v + L.x * w, R.y * u + U.y * v + L.y * w, R.z * u + U.z * v + L.z * w);
    RENDER.moon.target.updateMatrixWorld();
    RENDER.moon.position.copy(RENDER.moon.target.position).addScaledVector(L, 120);
  }
  const mv = _mv.copy(MOON).transformDirection(c.matrixWorldInverse);
  for (const m of RENDER.grassMats) { const u = m.userData.u; if (!u.uMoonView) continue; u.uTime.value = time; u.uWind.value = 0.35 + WIND.s * 0.9; u.uMoonView.value.copy(mv); u.uBack.value = tune.grass_glow * (m.userData.back || 1); }
  if (RENDER.motes && tierCfg().motes) updateMotes(dt || 0, c.position);
  if (CHEAP || !RENDER.composer) { r.setRenderTarget(null); r.render(RENDER.scene, c); return; }
  const u = RENDER.finish.uniforms; u.uTime.value = time; u.uBright.value = SETTINGS.bright; u.uLevels.value = tune.dither_levels;
  const g = GAME.glitch; u.uGlitch.value = g && g.t < g.dur ? 1 : 0; if (g) { u.uGY.value = g.y; u.uGH.value = g.h; u.uGS.value = g.shift; }
  u.uFade.value = GAME.fade;
  RENDER.bloom.strength = tune.bloom_strength; RENDER.bloom.radius = tune.bloom_radius; RENDER.bloom.threshold = tune.bloom_threshold;
  RENDER.composer.passes[0].scene = RENDER.scene; RENDER.composer.passes[0].camera = c;
  RENDER.composer.render(dt);
}
/** Draw any scene and camera through the same finish (the figures scene). */
function renderThrough(scene, camera) {
  const r = RENDER.renderer;
  if (CHEAP || !RENDER.composer) { r.setRenderTarget(null); r.render(scene, camera); return; }
  const rp = RENDER.composer.passes[0]; rp.scene = scene; rp.camera = camera;
  const u = RENDER.finish.uniforms; u.uGlitch.value = 0; u.uFade.value = 0; u.uBright.value = 1; u.uLevels.value = tune.dither_levels;
  RENDER.composer.render(0.016);
}
