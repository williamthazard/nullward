// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// Sparse synthesized sound (Web Audio, no files): wind that wanders, footfalls, wingbeats, the
// blade, a small chime on a cut, a low tone at the stones. Started on the first key or tap.
'use strict';

const SND = { wind: null, windGain: null, windFilter: null, noise: null };

function noiseBuffer(ac) {
  if (SND.noise) return SND.noise;
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
  let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
  return (SND.noise = b);
}
/** Called once the AudioContext exists: the wind bed. */
function audioInit() {
  if (!audio || SND.wind) return;
  const ac = audio.ac, src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.7;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(audio.out); src.start();
  Object.assign(SND, { wind: src, windGain: g, windFilter: f });
}
/** Each frame: the wind follows the wandering wind and the wanderer's speed. */
function audioFrame(speed) {
  if (!audio || !SND.wind) return;
  const t = audio.ac.currentTime, s = clamp(speed / 12, 0, 1.3);
  SND.windGain.gain.setTargetAtTime(0.05 + WIND.s * 0.09 + s * 0.12, t, 0.25);
  SND.windFilter.frequency.setTargetAtTime(280 + WIND.s * 240 + s * 520, t, 0.3);
}
function nburst(dur, freq, q, vol, type = 'bandpass', to = 0, delay = 0) {
  const ac = audio.ac, t = ac.currentTime + delay, src = ac.createBufferSource(); src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(audio.out); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function ping(freq, dur, type = 'sine', vol = 0.15, delay = 0, to = 0) {
  const ac = audio.ac, t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.out); o.start(t); o.stop(t + dur + 0.05);
}
/** Play a named sound. */
function sfx(name, arg = 1) {
  if (!audio || muted) return;
  switch (name) {
    case 'step': nburst(0.06, 900 + Math.random() * 300, 1.2, 0.05 + Math.min(arg, 12) * 0.004, 'bandpass'); break;
    case 'jump': nburst(0.14, 600, 0.8, 0.06, 'bandpass', 1400); break;
    case 'land': nburst(0.16, 260, 0.9, Math.min(0.22, 0.04 + arg * 0.008), 'lowpass'); ping(70, 0.18, 'sine', Math.min(0.2, arg * 0.01)); break;
    case 'roll': nburst(0.3, 500, 0.6, 0.08, 'bandpass', 200); break;
    case 'vault': nburst(0.1, 1200, 1, 0.05, 'bandpass', 700); break;
    case 'wall': nburst(0.35, 1800, 2, 0.05, 'bandpass', 900); break;
    case 'slide': nburst(0.5, 2500, 0.7, 0.05, 'highpass', 900); break;
    case 'bonk': ping(90, 0.12, 'triangle', 0.12); break;
    case 'swish': nburst(0.18, 3000, 1.4, 0.09, 'bandpass', 900); break;
    case 'cut': // the blade's ring and a small chime: bloodless, a little bright
      ping(1760, 0.08, 'triangle', 0.05); ping(880 * (arg > 1 ? 0.75 : 1), 0.5, 'sine', 0.12, 0.02); ping(1320 * (arg > 1 ? 0.75 : 1), 0.65, 'sine', 0.08, 0.06);
      break;
    case 'wings': for (let i = 0; i < Math.min(5, 1 + arg / 4); i++) nburst(0.09, 700 + i * 90, 1.5, 0.05, 'bandpass', 380, 0.05 + i * 0.075); break;
    case 'clang': ping(320, 0.35, 'square', 0.06); ping(477, 0.3, 'triangle', 0.05); break;
    case 'hurt': ping(150, 0.4, 'sine', 0.2, 0, 70); nburst(0.2, 300, 1, 0.08, 'lowpass'); break;
    case 'tell': ping(110, 0.5, 'triangle', 0.06, 0, 160); break;
    case 'open': ping(196, 0.6, 'sine', 0.1); ping(294, 0.6, 'sine', 0.06, 0.08); break;
    case 'crane': [784, 988, 1175].forEach((f, i) => ping(f, 0.7, 'sine', 0.07, i * 0.09)); break;
    case 'stone': ping(110, 2.4, 'sine', 0.16); ping(165, 2.2, 'sine', 0.08, 0.05); ping(220, 1.6, 'sine', 0.04, 0.1); break;
    case 'fall': nburst(0.8, 800, 0.8, 0.07, 'bandpass', 160); break;
    case 'glitch': nburst(0.12, 4000, 4, 0.03, 'bandpass'); break;
    case 'goal': [196, 247, 294, 392, 494].forEach((f, i) => ping(f, 3, 'sine', 0.07, i * 0.22)); break;
    case 'ui': ping(660, 0.08, 'sine', 0.05); break;
    case 'bell': ping(196, 4.5, 'sine', 0.2); ping(392.6, 3.2, 'sine', 0.08, 0.01); ping(523, 2.4, 'triangle', 0.035, 0.02); ping(98, 5, 'sine', 0.1); break;
    case 'shrine': [262, 330, 392, 523].forEach((f, i) => ping(f, 2.6, 'sine', 0.07, i * 0.12)); break;
  }
}
