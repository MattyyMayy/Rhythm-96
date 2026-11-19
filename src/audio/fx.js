// Master effects: drive, crush, filter (low or high pass), phaser, tempo-synced delay and reverb.
//
// Chain:  in -> drive -> crush -> filter -> phaser -> out (dry)
//                                             \-> delay  -> out
//                                             \-> reverb -> out
//
// Every knob runs 0..10 and 0 means "off", so the chain is transparent at rest.
// The mapping functions below are pure so they can be tested in Node.

/** Delay time choices for the Time knob, in beats. */
export const DELAY_TIMES = [
  ['1/16', 0.25], ['1/8', 0.5], ['1/8.', 0.75], ['1/4', 1], ['1/4.', 1.5], ['1/2', 2],
];

/** Filter cutoff in Hz. 0 = fully open for both types. */
export function filterFreq(amount, type) {
  const a = Math.max(0, Math.min(10, amount)) / 10;
  return type === 'hp' ? 20 * Math.pow(8000 / 20, a) : 20000 * Math.pow(120 / 20000, a);
}

export const filterQ = (reso) => 0.7 + Math.pow(Math.max(0, reso) / 10, 1.5) * 11;

/**
 * Level correction after the filter: resonance boosts the cutoff peak, so turn it down to match.
 * With the filter open the peak is out of hearing range, so the correction fades in with the Filter knob.
 */
export const resoMakeup = (reso, filter) =>
  Math.pow(1 / Math.sqrt(filterQ(reso) / 0.7), Math.min(1, Math.max(0, filter) / 3));

/** Level correction after Drive, so a typical note keeps about the same level as with Drive off. */
export function driveMakeup(amount) {
  const k = Math.max(0, amount) * 5, ref = 0.15;
  return ref / (((1 + k) * ref) / (1 + k * ref));
}

/** Delay time in seconds for a Time knob index and a tempo. */
export const delaySeconds = (idx, tempo) => (DELAY_TIMES[idx][1] * 60) / tempo;

/** Waveshaper curve for Drive. amount 0 gives a straight line (no change). */
export function driveCurve(amount, n = 2048) {
  const k = Math.max(0, amount) * 5;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

/** Waveshaper curve for Crush: fewer amplitude levels as the knob goes up. 0 = no change. */
export function crushCurve(amount, n = 8192) {
  const c = new Float32Array(n);
  const bits = amount <= 0 ? 0 : 12 - amount * 0.9; // 11.1 bits at 1, 3 bits at 10
  const levels = Math.pow(2, bits);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = amount <= 0 ? x : Math.round(x * levels) / levels;
  }
  return c;
}

/** Build the effects chain between `input` and `output` for one AudioContext. */
export function buildFx(ctx, input, output) {
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  // Drive
  const drive = ctx.createWaveShaper(); drive.oversample = '4x';
  const driveOut = gain();
  // Crush
  const crush = ctx.createWaveShaper();
  // Filter
  const filter = ctx.createBiquadFilter(), filterOut = gain();
  // Phaser: dry + four modulated all-pass stages with feedback.
  const phIn = gain(), phOut = gain(), phWet = gain(0), phFb = gain(0);
  const stages = [400, 900, 1700, 3200].map((f) => {
    const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.frequency.value = f; ap.Q.value = 0.6; return ap;
  });
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35;
  stages.forEach((ap) => {
    const depth = gain(ap.frequency.value * 0.7);
    lfo.connect(depth).connect(ap.frequency);
  });
  lfo.start();
  phIn.connect(phOut);
  let node = phIn;
  stages.forEach((ap) => { node = node.connect(ap); });
  node.connect(phWet).connect(phOut);
  // A feedback cycle must contain a DelayNode or Web Audio silences it.
  const phLoop = ctx.createDelay(0.05); phLoop.delayTime.value = 0.003;
  node.connect(phFb).connect(phLoop).connect(stages[0]);

  // Delay: send with feedback; a low-pass in the loop darkens each repeat.
  const dSend = gain(0), delay = ctx.createDelay(4), dFb = gain(0), dTone = ctx.createBiquadFilter();
  dTone.type = 'lowpass'; dTone.frequency.value = 4500;
  dSend.connect(delay); delay.connect(dTone); dTone.connect(dFb).connect(delay); dTone.connect(output);

  // Reverb: send into a convolver with a generated stereo tail (normalized so it is not louder than the dry sound).
  const rSend = gain(0), verb = ctx.createConvolver(), rPre = ctx.createDelay(0.1);
  rPre.delayTime.value = 0.018;
  verb.normalize = true;
  verb.buffer = impulse(ctx, 2.4, 2.8);
  rSend.connect(rPre).connect(verb).connect(output);

  // Waveshapers clip above 1.0, so work at a quarter of the level and restore it after.
  const pre = gain(0.25), post = gain(4);
  input.connect(pre).connect(drive).connect(driveOut).connect(crush).connect(post).connect(filter).connect(filterOut).connect(phIn);
  phOut.connect(output);
  phOut.connect(dSend);
  phOut.connect(rSend);

  let lastDrive = -1, lastCrush = -1;

  /** Push effect settings from the state object into the nodes. */
  function apply(S) {
    const t = ctx.currentTime, ramp = (p, v) => p.setTargetAtTime(v, t, 0.03);
    if (S.fxDrive !== lastDrive) {
      drive.curve = driveCurve(S.fxDrive);
      lastDrive = S.fxDrive;
    }
    ramp(driveOut.gain, driveMakeup(S.fxDrive));
    if (S.fxCrush !== lastCrush) { crush.curve = crushCurve(S.fxCrush); lastCrush = S.fxCrush; }
    filter.type = S.fxFilterType === 'hp' ? 'highpass' : 'lowpass';
    ramp(filter.frequency, filterFreq(S.fxFilter, S.fxFilterType));
    ramp(filter.Q, filterQ(S.fxReso));
    ramp(filterOut.gain, resoMakeup(S.fxReso, S.fxFilter));
    ramp(phWet.gain, (S.fxPhaser / 10) * 0.9);
    ramp(phFb.gain, (S.fxPhaser / 10) * 0.5);
    ramp(dSend.gain, (S.fxDelay / 10) * 0.5);
    ramp(dFb.gain, 0.25 + (S.fxDelay / 10) * 0.35);
    ramp(delay.delayTime, delaySeconds(S.fxTime, S.tempo));
    ramp(rSend.gain, (S.fxReverb / 10) * 0.6);
  }
  return { apply };
}

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
