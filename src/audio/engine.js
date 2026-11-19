// AudioContext, mixer buses and the play() entry point.
// The context is created lazily on the first user gesture (browsers block audio before that).
import { makeVoices, VGROUP } from './voices.js';
import { S } from '../state.js';

let ctx = null;
let master, drumBus, percBus, voices;

export const getContext = () => ctx;

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3;
  comp.attack.value = 0.003; comp.release.value = 0.18;

  master = ctx.createGain(); drumBus = ctx.createGain(); percBus = ctx.createGain();
  drumBus.connect(master); percBus.connect(master);
  master.connect(comp); comp.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  voices = makeVoices(ctx, noiseBuf);
  applyMix();
  return ctx;
}

/** Push Volume and Balance from state into the gain nodes. */
export function applyMix() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(Math.pow(S.vol / 10, 2) * 1.1, t, 0.02);
  // Balance 0 = drums only, 5 = both full, 10 = percussion only.
  drumBus.gain.setTargetAtTime(Math.min(1, (10 - S.bal) / 5), t, 0.02);
  percBus.gain.setTargetAtTime(Math.min(1, S.bal / 5), t, 0.02);
}

export function play(key, time, vel) {
  if (!ctx) return;
  voices[key](time, vel, VGROUP[key] === 'drum' ? drumBus : percBus);
}

/** Play one voice right now (row labels, step entry). */
export function audition(key) {
  if (!initAudio()) return;
  ctx.resume();
  play(key, ctx.currentTime + 0.01, 0.8);
}
