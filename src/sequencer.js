// Look-ahead scheduler (the "two clocks" pattern): a 25 ms timer schedules notes
// on the AudioContext clock up to LOOKAHEAD seconds ahead, and pushes a record of each
// step into `visualQueue` so the UI can light LEDs in sync with what you hear.
import { S, emit, sameSel } from './state.js';
import { STYLES, FILLS, fillForShape } from './patterns.js';
import { MEM } from './memory.js';
import { VKEYS } from './audio/voices.js';
import { initAudio, getContext, play } from './audio/engine.js';

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const BASE_VEL = 0.62;

export const visualQueue = [];

/**
 * Swing: how late a step plays, as a fraction of one step.
 * Only every second step of a straight (even) grid moves; triplet feels are already swung.
 * 50 = straight, 66 = triplet feel, 75 = hard dotted feel.
 */
export function swingOffset(step, div, swing) {
  if (div % 2 !== 0 || step % 2 === 0) return 0;
  return Math.max(0, Math.min(75, swing) - 50) / 50;
}
let timer = null;

export const stylePattern = (i, v) => STYLES[i][v];

/** Pattern the panel and editor show for a selection when not playing. */
export function shownPattern(sel = S.active) {
  if (sel.kind === 'mem') return MEM[sel.i];
  return stylePattern(sel.i, S.variation === 'B' ? 'B' : 'A');
}

export function selectionName(sel) {
  return sel.kind === 'mem' ? 'Program ' + (sel.i + 1) : STYLES[sel.i].name;
}

function basePattern(bar) {
  const a = S.active;
  if (a.kind === 'mem') return { p: MEM[a.i], v: '' };
  const v = S.variation === 'AB' ? (bar % 2 ? 'B' : 'A') : S.variation;
  return { p: stylePattern(a.i, v), v };
}

function fillFor(p) {
  if (S.active.kind === 'preset') return FILLS[STYLES[S.active.i].fill];
  return fillForShape(p);
}

function beginBar() {
  if (S.queued) { S.active = S.queued; S.queued = null; emit('selection'); }
  const fill = S.fillQueued || (S.autoFill > 0 && (S.bar + 1) % S.autoFill === 0);
  if (S.fillQueued) { S.fillQueued = false; emit('fill'); }
  const b = basePattern(S.bar);
  S.barBase = b.p; S.barVar = b.v; S.barFill = fill;
  S.barPat = fill ? fillFor(b.p) : b.p;
}

function scheduleStep() {
  if (S.step === 0) beginBar();
  const p = S.barPat, i = S.step;
  const stepDur = 60 / S.tempo / p.div;
  const t = S.nextTime + swingOffset(i, p.div, S.swing) * stepDur;
  const vel = p.acc[i] ? BASE_VEL * (1 + (S.accent / 10) * 1.1) : BASE_VEL;
  for (const k of VKEYS) {
    if (!p.v[k][i] || S.cancel.has(k)) continue;
    play(S.metal && (k === 'HH' || k === 'OH') ? 'MB' : k, t, vel);
  }
  visualQueue.push({ t, step: i, len: p.len, div: p.div, pacc: p.acc, fill: S.barFill, bar: S.bar, v: S.barVar, base: S.barBase });
  S.nextTime += stepDur;
  S.step++;
  if (S.step >= p.len) { S.step = 0; S.bar++; }
}

function tick() {
  if (!S.playing) return;
  const ctx = getContext();
  while (S.nextTime < ctx.currentTime + LOOKAHEAD) scheduleStep();
}

export function start() {
  const ctx = initAudio();
  if (!ctx) return;
  ctx.resume();
  S.playing = true; S.step = 0; S.bar = 0;
  S.nextTime = ctx.currentTime + 0.06;
  visualQueue.length = 0;
  tick();
  timer = setInterval(tick, TICK_MS);
  emit('transport');
}

export function stop() {
  S.playing = false;
  clearInterval(timer); timer = null;
  visualQueue.length = 0;
  if (S.queued) { S.active = S.queued; S.queued = null; }
  S.fillQueued = false;
  emit('fill'); emit('transport'); emit('selection');
}

export const toggle = () => (S.playing ? stop() : start());

export function toggleFill() {
  S.fillQueued = !S.fillQueued;
  emit('fill');
}

/** Choose a rhythm. While playing it waits for the next bar, like the hardware. */
export function select(sel) {
  if (S.playing) S.queued = sameSel(sel, S.active) ? null : sel;
  else { S.active = sel; S.queued = null; }
  emit('selection');
}

export function setVariation(v) {
  S.variation = v;
  emit('variation');
}
