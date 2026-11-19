// Voice list and synthesis recipes. Every sound is built from oscillators,
// filtered noise and envelopes at play time; there are no samples.

/** [key, display name, mixer bus] — "drum" voices sit on the drum side of the Balance knob. */
export const VOICES = [
  ['BD', 'Bass Drum', 'drum'], ['SD', 'Snare', 'drum'], ['RS', 'Rim Shot', 'drum'], ['CP', 'Hand Clap', 'drum'],
  ['HH', 'Hi-Hat', 'perc'], ['OH', 'Open Hat', 'perc'], ['CY', 'Cymbal', 'perc'], ['MB', 'Metal Beat', 'perc'],
  ['CGH', 'Conga Hi', 'perc'], ['CGL', 'Conga Lo', 'perc'], ['BOH', 'Bongo Hi', 'perc'], ['BOL', 'Bongo Lo', 'perc'],
  ['CV', 'Claves', 'perc'], ['CB', 'Cowbell', 'perc'], ['MA', 'Maracas', 'perc'], ['TB', 'Tambourine', 'perc'], ['GU', 'Guiro', 'perc'],
];
export const VKEYS = VOICES.map((v) => v[0]);
export const VGROUP = Object.fromEntries(VOICES.map((v) => [v[0], v[2]]));

/** Instrument-cancel switches on the panel: [id, label, voices it silences]. */
export const INST = [
  ['BD', 'Bass Drum', ['BD']], ['SD', 'Snare / Rim', ['SD', 'RS']], ['CP', 'Clap', ['CP']], ['HH', 'Hi-Hat', ['HH', 'OH']], ['CY', 'Cymbal', ['CY']],
  ['HAND', 'Congas Bongos', ['CGH', 'CGL', 'BOH', 'BOL']], ['LAT', 'Latin Perc', ['CV', 'CB', 'MA', 'TB', 'GU', 'MB']],
];

/** Sound kits: [id, panel name, short description]. "96" is the machine's own sound. */
export const KITS = [
  ['96', '96', 'The machine\'s own sound'],
  ['studio', 'Studio', 'Warm, round studio kit'],
  ['house', 'House', 'Punchy kick, crisp hats, big clap'],
  ['techno', 'Techno', 'Deep driven kick, hard metal hats'],
];
export const KIT_IDS = KITS.map((k) => k[0]);

/** Master tone per kit: low-pass cutoff in Hz (the Studio kit is darker and warmer). */
export const KIT_TONE = { 96: 18000, studio: 7800, house: 16000, techno: 18000 };

/**
 * Build the synth recipes for one AudioContext, one set per kit.
 * Each recipe is (time, velocity, outputNode) => void.
 * Kits other than "96" override some voices and fall back to "96" for the rest.
 */
export function makeKits(ctx, noiseBuf) {
  const gain = () => ctx.createGain();
  const filt = (type, f, q = 0.707) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const env = (g, t, peak, dec, att = 0.001) => {
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  };
  const osc = (type, f, t, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; };
  const noise = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05); return s; };

  // Six detuned square waves through a band-pass: the classic metallic cluster.
  function metal(t, v, dur, hp, out, bpF = 10000, q = 0.5) {
    const sum = gain(); sum.gain.value = 0.22;
    [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => osc('square', 40 * r, t, dur + 0.05).connect(sum));
    const g = gain(); env(g, t, v, dur);
    sum.connect(filt('bandpass', bpF, q)).connect(filt('highpass', hp)).connect(g).connect(out);
  }
  // Sine body with a short pitch drop plus a noise click: congas and bongos.
  function pitchedDrum(t, v, out, f0, f1, dec, click = 0.15) {
    const o = osc('sine', f0, t, dec + 0.1); o.frequency.exponentialRampToValueAtTime(f1, t + 0.03);
    const g = gain(); env(g, t, v, dec); o.connect(g).connect(out);
    const n = noise(t, 0.02), ng = gain(); env(ng, t, v * click, 0.012);
    n.connect(filt('bandpass', 2400, 1.2)).connect(ng).connect(out);
  }

  // Soft-clip waveshaper for driven kicks.
  const driveCurve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; driveCurve[i] = Math.tanh(x * 3); }
  const drive = () => { const w = ctx.createWaveShaper(); w.curve = driveCurve; w.oversample = '2x'; return w; };
  // Kick: sine with a pitch sweep, optional drive and click.
  function kick(t, v, out, { f0, f1, sweep, dec, click = 0.15, clickF = 1100, driven = 0, lp = 0 }) {
    const s = osc('sine', f0, t, dec + 0.15); s.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const g = gain(); env(g, t, v, dec);
    let node = s;
    if (driven) { const pre = gain(); pre.gain.value = driven; node = node.connect(pre).connect(drive()); }
    if (lp) node = node.connect(filt('lowpass', lp));
    node.connect(g).connect(out);
    if (click) { const c = osc('triangle', clickF, t, 0.02), cg = gain(); env(cg, t, v * click, 0.01); c.connect(cg).connect(out); }
  }
  // Noise hi-hat: high-passed noise with a short envelope.
  function noiseHat(t, v, out, dec, hp = 8000, bp = 11000) {
    const n = noise(t, dec + 0.05), g = gain(); env(g, t, v, dec);
    n.connect(filt('highpass', hp)).connect(filt('bandpass', bp, 0.6)).connect(g).connect(out);
  }
  // Hand clap: a few quick noise bursts, then a decaying tail.
  function clap(t, v, out, { bp = 1150, q = 1.4, bursts = 3, gap = 0.011, tail = 0.16, hp = 600 }) {
    const n = noise(t, bursts * gap + tail + 0.05), g = gain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < bursts; i++) {
      const tt = t + i * gap;
      g.gain.setValueAtTime(Math.max(0.0002, v), tt);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * 0.2), tt + gap * 0.9);
    }
    const tt = t + bursts * gap;
    g.gain.setValueAtTime(Math.max(0.0002, v * 0.9), tt);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + tail);
    n.connect(filt('bandpass', bp, q)).connect(filt('highpass', hp)).connect(g).connect(out);
  }
  // Snare: tonal body plus filtered noise.
  function snare(t, v, out, { f0, f1, body, bodyDec, nz, nzDec, bp = 4200, hp = 900, lp = 0 }) {
    const s = osc('triangle', f0, t, bodyDec + 0.1); s.frequency.exponentialRampToValueAtTime(f1, t + 0.08);
    const g = gain(); env(g, t, v * body, bodyDec); s.connect(g).connect(out);
    const n = noise(t, nzDec + 0.1), ng = gain(); env(ng, t, v * nz, nzDec);
    let node = n.connect(filt('bandpass', bp, 0.6)).connect(filt('highpass', hp));
    if (lp) node = node.connect(filt('lowpass', lp));
    node.connect(ng).connect(out);
  }

  const base = {
    BD(t, v, o) {
      const s = osc('sine', 155, t, 0.5); s.frequency.exponentialRampToValueAtTime(50, t + 0.07);
      const g = gain(); env(g, t, v * 1.15, 0.36); s.connect(g).connect(o);
      const c = osc('triangle', 1100, t, 0.02), cg = gain(); env(cg, t, v * 0.18, 0.01); c.connect(cg).connect(o);
    },
    SD(t, v, o) {
      const s = osc('triangle', 215, t, 0.2); s.frequency.exponentialRampToValueAtTime(165, t + 0.08);
      const g = gain(); env(g, t, v * 0.5, 0.09); s.connect(g).connect(o);
      const n = noise(t, 0.25), ng = gain(); env(ng, t, v * 0.62, 0.16);
      n.connect(filt('bandpass', 4200, 0.6)).connect(filt('highpass', 900)).connect(ng).connect(o);
    },
    CP(t, v, o) { clap(t, v * 0.75, o, {}); },
    RS(t, v, o) {
      const s = osc('sine', 1720, t, 0.05), g = gain(); env(g, t, v * 0.5, 0.026); s.connect(g).connect(o);
      const q = osc('square', 510, t, 0.03), g2 = gain(); env(g2, t, v * 0.32, 0.018);
      q.connect(filt('bandpass', 1600, 3)).connect(g2).connect(o);
    },
    HH(t, v, o) { metal(t, v * 0.5, 0.045, 7600, o); },
    OH(t, v, o) { metal(t, v * 0.42, 0.3, 7600, o); },
    CY(t, v, o) {
      metal(t, v * 0.36, 0.85, 5400, o, 9000, 0.4);
      const n = noise(t, 0.9), g = gain(); env(g, t, v * 0.12, 0.8); n.connect(filt('highpass', 7000)).connect(g).connect(o);
    },
    MB(t, v, o) { metal(t, v * 0.6, 0.07, 2500, o, 4600, 4); },
    CGH(t, v, o) { pitchedDrum(t, v * 0.75, o, 375, 335, 0.17); },
    CGL(t, v, o) { pitchedDrum(t, v * 0.8, o, 250, 220, 0.24); },
    BOH(t, v, o) { pitchedDrum(t, v * 0.65, o, 470, 430, 0.1, 0.2); },
    BOL(t, v, o) { pitchedDrum(t, v * 0.7, o, 330, 300, 0.13, 0.2); },
    CV(t, v, o) { const s = osc('sine', 2480, t, 0.06), g = gain(); env(g, t, v * 0.55, 0.04); s.connect(g).connect(o); },
    CB(t, v, o) {
      const g = gain(), f = filt('bandpass', 900, 1.2);
      osc('square', 562, t, 0.35).connect(f); osc('square', 845, t, 0.35).connect(f);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * 0.42), t + 0.001);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * 0.12), t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      f.connect(filt('highpass', 380)).connect(g).connect(o);
    },
    MA(t, v, o) { const n = noise(t, 0.08), g = gain(); env(g, t, v * 0.42, 0.035, 0.005); n.connect(filt('highpass', 6500)).connect(g).connect(o); },
    TB(t, v, o) {
      const n = noise(t, 0.25), g = gain(); env(g, t, v * 0.4, 0.18, 0.003);
      n.connect(filt('bandpass', 9500, 1)).connect(g).connect(o);
      metal(t, v * 0.14, 0.12, 8000, o);
    },
    GU(t, v, o) {
      const n = noise(t, 0.2), g = gain(); g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 9; i++) {
        const tt = t + i * 0.015;
        g.gain.setValueAtTime(Math.max(0.0002, v * 0.55 * (1 - i * 0.05)), tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.011);
      }
      n.connect(filt('bandpass', 2900, 6)).connect(g).connect(o);
    },
  };

  const studio = {
    BD(t, v, o) { kick(t, v * 1.2, o, { f0: 120, f1: 47, sweep: 0.09, dec: 0.42, click: 0.08, clickF: 800, lp: 900 }); },
    SD(t, v, o) { snare(t, v, o, { f0: 190, f1: 150, body: 0.65, bodyDec: 0.14, nz: 0.5, nzDec: 0.22, bp: 3000, hp: 500, lp: 6500 }); },
    RS(t, v, o) { pitchedDrum(t, v * 0.55, o, 900, 780, 0.05, 0.35); },
    CP(t, v, o) { clap(t, v * 0.7, o, { bp: 1000, q: 1, bursts: 3, gap: 0.013, tail: 0.28, hp: 400 }); },
    HH(t, v, o) { noiseHat(t, v * 0.32, o, 0.05, 6500, 9000); metal(t, v * 0.18, 0.04, 7000, o); },
    OH(t, v, o) { noiseHat(t, v * 0.26, o, 0.34, 6000, 8500); metal(t, v * 0.14, 0.3, 7000, o); },
    CY(t, v, o) { metal(t, v * 0.26, 1.2, 4200, o, 6500, 0.4); noiseHat(t, v * 0.1, o, 1.1, 5000, 8000); },
  };

  const house = {
    BD(t, v, o) { kick(t, v * 1.15, o, { f0: 175, f1: 52, sweep: 0.05, dec: 0.38, click: 0.22, clickF: 1600, driven: 1.3 }); },
    SD(t, v, o) { snare(t, v, o, { f0: 240, f1: 190, body: 0.35, bodyDec: 0.07, nz: 0.7, nzDec: 0.13, bp: 5200, hp: 1500 }); },
    CP(t, v, o) { clap(t, v * 0.85, o, { bp: 1250, q: 1.6, bursts: 4, gap: 0.01, tail: 0.24, hp: 700 }); },
    HH(t, v, o) { noiseHat(t, v * 0.45, o, 0.04, 8500, 11500); },
    OH(t, v, o) { noiseHat(t, v * 0.38, o, 0.24, 7500, 10500); },
    CY(t, v, o) { noiseHat(t, v * 0.24, o, 0.7, 6000, 9000); metal(t, v * 0.18, 0.6, 6000, o, 9000, 0.4); },
  };

  const techno = {
    BD(t, v, o) { kick(t, v * 1.1, o, { f0: 140, f1: 42, sweep: 0.08, dec: 0.55, click: 0.12, clickF: 2200, driven: 2.6, lp: 2400 }); },
    SD(t, v, o) { snare(t, v, o, { f0: 200, f1: 170, body: 0.3, bodyDec: 0.06, nz: 0.75, nzDec: 0.1, bp: 3600, hp: 1200 }); metal(t, v * 0.12, 0.05, 3000, o, 5000, 3); },
    RS(t, v, o) { metal(t, v * 0.5, 0.03, 2000, o, 3200, 6); },
    CP(t, v, o) { clap(t, v * 0.7, o, { bp: 1500, q: 2, bursts: 3, gap: 0.008, tail: 0.1, hp: 900 }); },
    HH(t, v, o) { metal(t, v * 0.5, 0.03, 9000, o, 12000, 1.2); },
    OH(t, v, o) { metal(t, v * 0.45, 0.18, 8500, o, 11000, 1.2); },
    CY(t, v, o) { metal(t, v * 0.32, 1.0, 6000, o, 9500, 0.6); },
  };

  return {
    96: base,
    studio: { ...base, ...studio },
    house: { ...base, ...house },
    techno: { ...base, ...techno },
  };
}
