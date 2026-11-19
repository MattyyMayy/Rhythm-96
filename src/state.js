// Shared machine state plus a tiny event bus so modules can react without importing each other.
//
// Events:
//   'selection' — active or queued rhythm changed
//   'variation' — A / B / A+B changed
//   'transport' — started or stopped
//   'fill'      — manual fill armed or consumed
//   'memory'    — a memory pattern was edited
//   'kit'       — the sound kit changed

export const S = {
  tempo: 112, vol: 7, bal: 5, accent: 6, autoFill: 0,
  swing: 50,                          // 50 = straight; up to 75 delays every second sixteenth
  humanize: 0,                        // 0..10: random timing and level drift per note
  kit: '96',                          // sound kit id, see KITS in audio/voices.js
  // effects, each 0..10 with 0 = off
  fxDrive: 0, fxCrush: 0, fxFilter: 0, fxReso: 0, fxFilterType: 'lp',
  fxPhaser: 0, fxDelay: 0, fxTime: 2, fxReverb: 0,
  variation: 'A',                     // 'A' | 'B' | 'AB'
  active: { kind: 'preset', i: 0 },   // { kind: 'preset' | 'mem', i }
  queued: null,                       // selection waiting for the next bar while playing
  fillQueued: false,
  playing: false,
  cancel: new Set(),                  // voice keys silenced by instrument-cancel switches
  metal: false,                       // play hi-hats as Metal Beat
  // sequencer cursor
  step: 0, bar: 0, nextTime: 0,
  barPat: null, barBase: null, barFill: false, barVar: 'A',
};

const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
}
export function emit(evt, data) {
  listeners.get(evt)?.forEach((fn) => fn(data));
}

export const sameSel = (a, b) => !!(a && b && a.kind === b.kind && a.i === b.i);
