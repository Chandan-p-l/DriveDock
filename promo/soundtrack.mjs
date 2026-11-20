// Original produced soundtrack for the DriveDock promo, synthesized in code and timed to video.html.
// Tempo is chosen so the drop lands on the logo reveal (4.82s) and the final hit on the end card (42.0s).
// usage: node soundtrack.mjs out.wav
import { writeFileSync } from 'node:fs';

const SR = 44100, DUR = 45, N = SR * DUR, TAU = Math.PI * 2;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const MUS = bus(), ARP = bus(), DRM = bus(), SFX = bus(), SEND = bus();

function add(target, start, dur, fn, pan = 0, send = 0) {
  const s0 = Math.max(0, Math.floor(start * SR)), s1 = Math.min(N, Math.floor((start + dur) * SR));
  const gl = Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = Math.sin((pan + 1) * Math.PI / 4) * 1.414;
  for (let i = s0; i < s1; i++) {
    const v = fn((i - s0) / SR);
    target[0][i] += v * gl; target[1][i] += v * gr;
    if (send) { SEND[0][i] += v * gl * send; SEND[1][i] += v * gr * send; }
  }
}
const adsr = (t, a, r, total) => Math.min(1, t / a) * Math.min(1, Math.max(0, (total - t) / r));

/* ---- oscillators & filters ---- */
function saw(f) {
  let ph = Math.abs(rnd()); const dt = f / SR;
  return () => {
    ph += dt; if (ph >= 1) ph -= 1;
    let v = 2 * ph - 1;
    if (ph < dt) { const x = ph / dt; v -= x + x - x * x - 1; }
    else if (ph > 1 - dt) { const x = (ph - 1) / dt; v -= x * x + x + x + 1; }
    return v;
  };
}
const onePole = () => { let y = 0; return (x, fc) => (y += (1 - Math.exp(-TAU * fc / SR)) * (x - y)); };
function biquad(type, f, q = 0.707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (ff) => {
    const w = TAU * ff / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), a0 = 1 + al;
    if (type === 'lp') { b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; }
    else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
    a1 = -2 * c / a0; a2 = (1 - al) / a0;
  };
  set(f);
  const p = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  p.set = set;
  return p;
}

/* ---- musical grid ---- */
const T_LOGO = 4.82, T_END = 42.0;
const BAR = (T_END - T_LOGO) / 18;          // 2.0656 s  (~116 BPM)
const BEAT = BAR / 4;
const BAR0 = T_LOGO - 2 * BAR;              // first bar start (0.689 s)
const barT = b => BAR0 + b * BAR;           // bar index -> time
const CH = [
  { n: [60, 64, 67, 71], b: 36 },  // Cmaj7
  { n: [59, 62, 67, 74], b: 43 },  // G
  { n: [60, 64, 69, 72], b: 45 },  // Am
  { n: [60, 65, 69, 72], b: 41 },  // F
];
// sections (bar indices): intro 0-1, logo 2-3, grooveA 4-7, grooveB 8-14, focus 15-17, breakdown 18-19, final 20
const sec = b => b < 2 ? 'intro' : b < 4 ? 'logo' : b < 8 ? 'A' : b < 15 ? 'B' : b < 18 ? 'focus' : b < 20 ? 'break' : 'final';

/* ---- instruments ---- */
function pad(t0, dur, notes, amp) {
  notes.forEach((m, k) => {
    [-0.08, 0.08].forEach((det, j) => {
      const o1 = saw(mtof(m - 12 + det)), lp = onePole(), lp2 = onePole();
      add(MUS, t0, dur + 1.0, t => {
        const e = adsr(t, 0.45, 1.0, dur + 1.0);
        return amp * e * lp2(lp(o1(), 1400 + 500 * Math.sin(t * 1.3)), 2200);
      }, (k - 1.5) * 0.25 + (j ? 0.3 : -0.3), 0.45);
    });
  });
}
function pluck(t0, m, amp, pan) {
  const o = saw(mtof(m)), o2 = saw(mtof(m + 0.07)), lp = onePole();
  add(ARP, t0, 0.45, t => {
    const e = Math.exp(-t / 0.13) * Math.min(1, t / 0.002);
    return amp * e * lp((o() + o2()) * 0.5, 600 + 5200 * Math.exp(-t / 0.08));
  }, pan, 0.25);
}
function lead(t0, dur, m, amp) {
  const vib = (t) => 1 + 0.004 * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.25);
  const f = mtof(m);
  const oscs = [-0.12, 0, 0.12].map(d => { let ph = Math.abs(rnd()); return t => { ph += f * Math.pow(2, d / 12) * vib(t) / SR; ph -= Math.floor(ph); return 2 * ph - 1; }; });
  const lp = onePole(), lp2 = onePole();
  add(MUS, t0, dur + 0.25, t => {
    const e = adsr(t, 0.008, 0.2, dur + 0.25) * (0.75 + 0.25 * Math.exp(-t / 0.2));
    const x = (oscs[0](t) + oscs[1](t) + oscs[2](t)) / 3;
    return amp * e * lp2(lp(x, 1600 + 3200 * Math.exp(-t / 0.18)), 5000);
  }, 0, 0.35);
  // ping-pong echo of the lead
  [[0.75, 0.32, -0.6], [1.5, 0.16, 0.6]].forEach(([d, g, p]) => {
    const o = saw(f), lp3 = onePole();
    add(MUS, t0 + d * BEAT, dur + 0.25, t => amp * g * adsr(t, 0.01, 0.2, dur + 0.25) * lp3(o(), 1800), p, 0.3);
  });
}
function bell(t0, m, amp, pan) {
  const f = mtof(m);
  add(MUS, t0, 2.4, t => amp * Math.min(1, t / 0.003) * (Math.sin(TAU * f * t) * Math.exp(-t * 1.6) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 3) + 0.12 * Math.sin(TAU * 4.01 * f * t) * Math.exp(-t * 6)), pan, 0.5);
}
function bassNote(t0, dur, m, amp) {
  const f = mtof(m), o = saw(f), lp = onePole();
  add(MUS, t0, dur, t => {
    const e = adsr(t, 0.004, 0.04, dur);
    return amp * e * (0.9 * Math.sin(TAU * f * t) + 0.35 * lp(o(), 420 + 900 * Math.exp(-t / 0.06)));
  });
}
const kicks = [];
function kick(t0, amp = 0.46) {
  kicks.push(t0);
  let ph = 0;
  add(DRM, t0, 0.42, t => { ph += TAU * (47 + 120 * Math.exp(-t * 32)) / SR; return amp * Math.exp(-t * 7.5) * Math.sin(ph) + (t < 0.004 ? rnd() * 0.25 * amp : 0); });
}
function clap(t0, amp = 0.2, pan = 0, target = DRM) {
  const bp = biquad('bp', 1500, 0.9), hp = biquad('hp', 600);
  add(target, t0, 0.3, t => {
    const burst = [0, 0.011, 0.022].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) / (o === 0.022 ? 0.09 : 0.008)) : 0), 0);
    return amp * burst * hp(bp(rnd())) * 2.2;
  }, pan, 0.4);
}
function hat(t0, amp = 0.05, open = false, pan = 0.25) {
  const hp = biquad('hp', 7500, 0.8);
  add(DRM, t0, open ? 0.3 : 0.06, t => amp * Math.exp(-t / (open ? 0.09 : 0.018)) * hp(rnd()), pan, 0.08);
}
function crash(t0, amp = 0.12) {
  const hp = biquad('hp', 5000, 0.7);
  add(DRM, t0, 2.4, t => amp * Math.exp(-t * 1.6) * hp(rnd()), 0, 0.35);
  const hp2 = biquad('hp', 5200, 0.7);
  add(DRM, t0, 2.4, t => amp * 0.8 * Math.exp(-t * 1.7) * hp2(rnd()), 0.5, 0.35);
}

/* ---- arrangement ---- */
const LEAD = [ // [midi, beats] per 4-bar phrase (C G Am F)
  [[76, .5], [79, .5], [84, 1], [83, .5], [79, .5], [76, 1]],
  [[74, .5], [79, .5], [83, 1], [81, .5], [79, .5], [74, 1]],
  [[72, .5], [76, .5], [81, 1], [79, .5], [76, .5], [72, 1]],
  [[77, .5], [76, .5], [74, .5], [72, .5], [74, 1.5], [null, .5]],
];
const ARP_SEQ = [0, 1, 2, 3, 2, 1, 3, 2];
for (let b = 0; b < 20; b++) {
  const s = sec(b), t0 = barT(b), ch = CH[b % 4];
  // pad everywhere
  pad(t0, BAR, ch.n, s === 'intro' ? 0.034 : s === 'break' ? 0.04 : 0.042);
  // intro bells
  if (s === 'intro') ch.n.forEach((m, k) => bell(t0 + k * BEAT, m + 12, 0.07, (k - 1.5) * 0.4));
  // arps
  if (s !== 'intro') for (let i = 0; i < 16; i++) {
    const m = ch.n[ARP_SEQ[i % 8]] + 12 + (i >= 8 && s === 'B' ? 12 : 0);
    pluck(t0 + i * BEAT / 4, m, (i % 4 === 0 ? 0.075 : 0.05) * (s === 'logo' ? 0.8 : 1), i % 2 ? 0.45 : -0.45);
  }
  // drums + bass
  if (['A', 'B', 'focus', 'break'].includes(s)) {
    for (let q = 0; q < 4; q++) {
      const tq = t0 + q * BEAT;
      kick(tq, s === 'break' ? 0.34 : 0.46);
      if (q === 1 || q === 3) clap(tq, s === 'focus' ? 0.15 : 0.2);
      hat(tq + BEAT / 2, 0.06, s === 'B', 0.3);
      if (s !== 'focus') hat(tq + BEAT / 4, 0.025, false, -0.3), hat(tq + 3 * BEAT / 4, 0.025, false, -0.3);
    }
    if (s !== 'break') for (let e = 0; e < 8; e++) bassNote(t0 + e * BEAT / 2 + 0.02, BEAT / 2 - 0.04, ch.b + (e % 2 && s === 'B' ? 12 : 0), 0.14);
  }
  if (s === 'logo') { kick(t0, 0.5); kick(t0 + 2 * BEAT, 0.4); hat(t0 + BEAT, 0.04, true); hat(t0 + 3 * BEAT, 0.04, true); }
  // lead melody in the main section
  if (s === 'B') {
    let tt = t0;
    for (const [m, beats] of LEAD[(b - 8) % 4]) { if (m) lead(tt, beats * BEAT * 0.92, m, 0.065); tt += beats * BEAT; }
  }
}
// snare roll building into the finale (last breakdown bar)
for (let i = 0; i < 16; i++) clap(barT(19) + i * BEAT / 4, 0.06 + 0.2 * Math.pow(i / 15, 1.5), (i % 2 ? 0.2 : -0.2), SFX);
// crashes on section starts
[barT(2), barT(4), barT(8), T_END].forEach(t => crash(t, 0.13));
// finale: big chord + sub + bells
[48, 60, 64, 67, 72, 76, 79].forEach((m, k) => {
  [-0.1, 0.1].forEach(det => {
    const o = saw(mtof(m + det)), lp = onePole();
    add(MUS, T_END, 3.0, t => 0.028 * Math.exp(-t * 0.9) * Math.min(1, t / 0.01) * lp(o(), 900 + 3000 * Math.exp(-t * 1.5)), (k - 3) * 0.25, 0.6);
  });
});
bassNote(T_END, 2.6, 36, 0.2); kick(T_END, 0.7);
[84, 88, 91, 96].forEach((m, k) => bell(T_END + k * 0.09, m, 0.05, (k - 1.5) * 0.5));

/* ---- sound design ---- */
function whoosh(at, dur = 0.8, amp = 0.22, dirPan = 1) {
  const bp = biquad('bp', 500, 1.2);
  add(SFX, at - dur * 0.6, dur, t => {
    const k = t / dur;
    bp.set(300 + 7000 * Math.pow(Math.sin(Math.PI * k), 2));
    return amp * Math.pow(Math.sin(Math.PI * k), 2) * bp(rnd()) * 2.5;
  }, 0, 0.3);
  const bp2 = biquad('bp', 500, 1.2);
  add(SFX, at - dur * 0.6, dur, t => { const k = t / dur; bp2.set(300 + 7000 * Math.pow(Math.sin(Math.PI * k), 2)); return amp * 0.7 * Math.pow(Math.sin(Math.PI * k), 2) * bp2(rnd()) * 2.5; }, dirPan * 0.7, 0.3);
}
function riser(at, dur, amp = 0.12) {
  const bp = biquad('bp', 400, 2);
  add(SFX, at, dur, t => { const k = t / dur; bp.set(300 + 9000 * k * k); return amp * k * k * (bp(rnd()) * 2 + 0.25 * Math.sin(TAU * (180 + 1500 * k * k) * t)); }, 0, 0.4);
}
function impact(at, amp = 0.55) {
  let ph = 0;
  add(SFX, at, 2.0, t => { ph += TAU * (36 + 90 * Math.exp(-t * 7)) / SR; return amp * Math.exp(-t * 2.6) * Math.sin(ph); });
  const lp = biquad('lp', 1200);
  add(SFX, at, 1.0, t => amp * 0.45 * Math.exp(-t * 6) * lp(rnd()) * 2, 0, 0.6);
}
function pop(at, f = 1100, amp = 0.12, pan = 0) {
  add(SFX, at, 0.14, t => amp * Math.exp(-t / 0.04) * Math.sin(TAU * f * (1 + 0.5 * Math.exp(-t * 60)) * t), pan, 0.35);
}
function chime(at, amp = 0.09) {
  [[1046.5, 0], [1568, 0.08], [2093, 0.16]].forEach(([f, d], k) =>
    add(SFX, at + d, 1.6, t => amp * Math.exp(-t * 3) * Math.min(1, t / 0.003) * (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2.76 * f * t) * Math.exp(-t * 8)), (k - 1) * 0.4, 0.55));
}
function errorBuzz(at) {
  [233, 220].forEach((f, k) => { const o = saw(f), lp = onePole(); add(SFX, at + k * 0.13, 0.28, t => 0.09 * Math.exp(-t / 0.1) * lp(o(), 1500), -0.1, 0.2); });
}
function keyClick(at) {
  const hp = biquad('hp', 2500), bp = biquad('bp', 4000, 1.5);
  add(SFX, at, 0.035, t => 0.11 * Math.exp(-t / 0.005) * bp(hp(rnd())) * 3, rnd() * 0.3, 0.1);
}

[0.75, 1.05, 1.35].forEach((t, k) => pop(t, 880 + k * 140, 0.12, (k - 1) * 0.45));
errorBuzz(1.86);
whoosh(2.95, 0.9, 0.2);
riser(barT(1), BAR, 0.14);
impact(T_LOGO, 0.6);
whoosh(9.0, 0.8, 0.16, -1);
[11.0, 11.35, 11.7].forEach((t, k) => pop(t, 1250 + k * 90, 0.12, 0.25));
[12.6, 12.88, 13.16].forEach((t, k) => pop(t, 700 + k * 260, 0.09, -0.25));
chime(15.95, 0.09);
whoosh(17.15, 0.8, 0.16);
[17.8, 18.05, 18.3, 18.55].forEach((t, k) => pop(t, 950 + k * 110, 0.1, k % 2 ? 0.45 : -0.45));
whoosh(23.2, 1.0, 0.22, -1);
[24.65, 25.35, 26.05].forEach((t, k) => pop(t, 1300 + k * 120, 0.1, 0.3));
whoosh(28.45, 0.7, 0.16, 1);
pop(29.45, 520, 0.14); whoosh(29.8, 0.45, 0.12, -1); chime(30.05, 0.07);
whoosh(31.6, 0.8, 0.16);
[32.05, 32.25, 32.45, 32.65].forEach((t, k) => pop(t, 800 + k * 170, 0.08, (k - 1.5) * 0.35));
pop(34.05, 1600, 0.09);
whoosh(37.65, 0.8, 0.16, -1);
for (let t = 38.2; t < 39.7; t += 0.038 + Math.abs(rnd()) * 0.03) keyClick(t);
for (let t = 40.0; t < 40.9; t += 0.034 + Math.abs(rnd()) * 0.03) keyClick(t);
chime(41.0, 0.09);
riser(barT(19), BAR, 0.16);
impact(T_END, 0.55);

/* ---- effects & mix ---- */
// ping-pong delay on the arp (dotted eighth)
const dly = Math.round(BEAT * 0.75 * SR);
for (let i = 0; i < N; i++) {
  const a = i - dly;
  if (a >= 0) { ARP[0][i] += ARP[1][a] * 0.38; ARP[1][i] += ARP[0][a] * 0.38; }
}
for (let i = 0; i < N; i++) { MUS[0][i] += ARP[0][i] * 0.8; MUS[1][i] += ARP[1][i] * 0.8; }

// sidechain pump from kicks
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  const s0 = Math.floor(k * SR);
  for (let i = s0; i < Math.min(N, s0 + SR * 0.4); i++) duck[i] = Math.min(duck[i], 1 - 0.55 * Math.exp(-(i - s0) / SR * 10));
}
// breakdown filter sweep on music + drums
const lpL = biquad('lp', 400, 0.9), lpR = biquad('lp', 400, 0.9), dlL = biquad('lp', 400, 0.9), dlR = biquad('lp', 400, 0.9);
const bs = Math.floor(barT(18) * SR), be = Math.floor(T_END * SR);
for (let i = 0; i < N; i++) {
  MUS[0][i] *= duck[i]; MUS[1][i] *= duck[i];
  if (i >= bs && i < be) {
    if ((i - bs) % 64 === 0) { const k = (i - bs) / (be - bs); const fc = 900 * Math.pow(14000 / 900, k * k); lpL.set(fc); lpR.set(fc); dlL.set(fc); dlR.set(fc); }
    MUS[0][i] = lpL(MUS[0][i]); MUS[1][i] = lpR(MUS[1][i]);
    DRM[0][i] = dlL(DRM[0][i]); DRM[1][i] = dlR(DRM[1][i]);
  }
}

// Freeverb on the send bus
function freeverb(inL, inR) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  const mk = (len) => ({ buf: new Float32Array(len), i: 0, store: 0 });
  const out = [new Float32Array(N), new Float32Array(N)];
  [0, 1].forEach(ch => {
    const sp = ch ? 23 : 0;
    const cs = combs.map(l => mk(l + sp)), as = aps.map(l => mk(l + sp));
    const src = ch ? inR : inL, dst = out[ch];
    const fb = 0.86, damp = 0.25;
    for (let n = 0; n < N; n++) {
      const x = src[n] * 0.015;
      let y = 0;
      for (const c of cs) {
        const o = c.buf[c.i]; c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * fb; if (++c.i >= c.buf.length) c.i = 0; y += o;
      }
      for (const a of as) {
        const b = a.buf[a.i]; const o = -y + b; a.buf[a.i] = y + b * 0.5; if (++a.i >= a.buf.length) a.i = 0; y = o;
      }
      dst[n] = y;
    }
  });
  return out;
}
const REV = freeverb(SEND[0], SEND[1]);

const mix = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
const hpL = biquad('hp', 28), hpR = biquad('hp', 28);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.3) * Math.min(1, (DUR - t) / 1.2);
  const l = MUS[0][i] * 1.45 + DRM[0][i] + SFX[0][i] * 0.95 + REV[0][i] * 2.6;
  const r = MUS[1][i] * 1.45 + DRM[1][i] + SFX[1][i] * 0.95 + REV[1][i] * 2.6;
  mix[0][i] = Math.tanh(hpL(l) * 1.25) * fade;
  mix[1][i] = Math.tanh(hpR(r) * 1.25) * fade;
  peak = Math.max(peak, Math.abs(mix[0][i]), Math.abs(mix[1][i]));
}
const g = 0.9 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++)
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[c][i] * g)) * 32767), 44 + (i * 2 + c) * 2);
writeFileSync(process.argv[2] || 'soundtrack.wav', out);
console.log(`soundtrack written · ${(60 / BEAT).toFixed(1)} BPM · peak ${peak.toFixed(2)}`);
