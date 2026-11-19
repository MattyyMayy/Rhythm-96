// Voice list and synthesis recipes. Every sound is built from oscillators,
// filtered noise and envelopes at play time; there are no samples.

/** [key, display name, mixer bus] — "drum" voices sit on the drum side of the Balance knob. */
export const VOICES = [
  ['BD', 'Bass Drum', 'drum'], ['SD', 'Snare', 'drum'], ['RS', 'Rim Shot', 'drum'],
  ['HH', 'Hi-Hat', 'perc'], ['OH', 'Open Hat', 'perc'], ['CY', 'Cymbal', 'perc'], ['MB', 'Metal Beat', 'perc'],
  ['CGH', 'Conga Hi', 'perc'], ['CGL', 'Conga Lo', 'perc'], ['BOH', 'Bongo Hi', 'perc'], ['BOL', 'Bongo Lo', 'perc'],
  ['CV', 'Claves', 'perc'], ['CB', 'Cowbell', 'perc'], ['MA', 'Maracas', 'perc'], ['TB', 'Tambourine', 'perc'], ['GU', 'Guiro', 'perc'],
];
export const VKEYS = VOICES.map((v) => v[0]);
export const VGROUP = Object.fromEntries(VOICES.map((v) => [v[0], v[2]]));

/** Instrument-cancel switches on the panel: [id, label, voices it silences]. */
export const INST = [
  ['BD', 'Bass Drum', ['BD']], ['SD', 'Snare / Rim', ['SD', 'RS']], ['HH', 'Hi-Hat', ['HH', 'OH']], ['CY', 'Cymbal', ['CY']],
  ['HAND', 'Congas Bongos', ['CGH', 'CGL', 'BOH', 'BOL']], ['LAT', 'Latin Perc', ['CV', 'CB', 'MA', 'TB', 'GU', 'MB']],
];

/**
 * Build the synth recipes for one AudioContext.
 * Each recipe is (time, velocity, outputNode) => void.
 */
export function makeVoices(ctx, noiseBuf) {
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

  return {
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
}
