// Front panel: knobs, rhythm select keys, variation, instrument cancels,
// transport, the amber display, the beat lamp and the step-LED strip.
import { S, on, sameSel } from '../state.js';
import { STYLES, GROUPS } from '../patterns.js';
import { INST } from '../audio/voices.js';
import { applyMix, getContext } from '../audio/engine.js';
import { MEM } from '../memory.js';
import { visualQueue, select, setVariation, toggle, toggleFill, shownPattern, selectionName } from '../sequencer.js';
import { Knob } from './knob.js';
import { setPlayhead } from './writer.js';

const $ = (id) => document.getElementById(id);
const keyEls = [];
let lamp, strip, ledFill, ledStart, btnStart, btnFill, dName, dTempo, dSub, dBar;
let lastStep = null;

/* ---------- knobs ---------- */
function initKnobs() {
  Knob($('kVol'), { min: 0, max: 10, step: 0.5, value: S.vol, reset: 7, out: 'vVol', wheel: 0.5,
    fmt: (x) => x.toFixed(1), onChange: (x) => { S.vol = x; applyMix(); } });
  Knob($('kBal'), { min: 0, max: 10, step: 0.5, value: S.bal, reset: 5, out: 'vBal', wheel: 0.5,
    fmt: (x) => (x === 5 ? 'CTR' : x < 5 ? 'DRM ' + (5 - x).toFixed(1) : 'PRC ' + (x - 5).toFixed(1)),
    onChange: (x) => { S.bal = x; applyMix(); } });
  Knob($('kAcc'), { min: 0, max: 10, step: 0.5, value: S.accent, reset: 6, out: 'vAcc', wheel: 0.5,
    fmt: (x) => x.toFixed(1), onChange: (x) => { S.accent = x; } });
  Knob($('kFill'), { steps: [0, 2, 4, 8, 12, 16], value: 0, reset: 0, out: 'vFill',
    fmt: (x) => (x ? 'every ' + x : 'off'), onChange: (x) => { S.autoFill = x; } });
  Knob($('kTempo'), { min: 40, max: 240, value: S.tempo, reset: 112, out: 'vTempo', wheel: 1,
    fmt: (x) => x + ' bpm', onChange: (x) => { S.tempo = x; dTempo.textContent = x; } });
}

/* ---------- rhythm select ---------- */
function initRhythmKeys() {
  const groupsEl = $('groups');
  GROUPS.forEach(([gid, gname]) => {
    const items = gid === 'mem'
      ? MEM.map((_, i) => ({ kind: 'mem', i, name: 'Program ' + (i + 1) }))
      : STYLES.map((s, i) => ({ kind: 'preset', i, name: s.name, g: s.g })).filter((x) => x.g === gid);
    const wrap = document.createElement('div');
    wrap.className = 'grp';
    wrap.style.setProperty('--n', items.length);
    wrap.innerHTML = `<h4>${gname}</h4><div class="keys"></div>`;
    const keys = wrap.querySelector('.keys');
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'key rkey' + (it.kind === 'mem' ? ' rust' : '');
      const num = it.kind === 'mem' ? 'M' + (it.i + 1) : String(it.i + 1).padStart(2, '0');
      b.innerHTML = `<span class="led"></span><span class="t">${it.name}</span><span class="n">${num}</span>`;
      b.setAttribute('aria-label', it.name);
      b.addEventListener('click', () => select({ kind: it.kind, i: it.i }));
      keys.appendChild(b);
      keyEls.push({ el: b, led: b.querySelector('.led'), sel: it });
    });
    groupsEl.appendChild(wrap);
  });
}

function renderKeys() {
  for (const k of keyEls) {
    const isActive = sameSel(k.sel, S.active), isQueued = sameSel(k.sel, S.queued);
    // Active rhythm: steady LED. Queued rhythm: blinking LED until the bar line.
    k.led.className = 'led' + (isActive || isQueued ? ' on' : '') + (isQueued ? ' blink' : '');
    k.el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

/* ---------- variation ---------- */
function initVariation() {
  document.querySelectorAll('[data-var]').forEach((b) => b.addEventListener('click', () => setVariation(b.dataset.var)));
}
function renderVariation() {
  document.querySelectorAll('[data-led]').forEach((l) => l.classList.toggle('on', l.dataset.led === S.variation));
  document.querySelectorAll('[data-var]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.var === S.variation));
}

/* ---------- instrument cancels ---------- */
function addSwitch(parent, label, initialOn, ariaLabel, onToggle) {
  const d = document.createElement('div');
  d.className = 'mini';
  d.innerHTML = `<span class="ml">${label}</span><span class="led${initialOn ? ' on' : ''}"></span><button class="key dark" aria-pressed="${initialOn}" aria-label="${ariaLabel}"></button>`;
  const b = d.querySelector('button'), led = d.querySelector('.led');
  b.addEventListener('click', () => {
    const now = onToggle();
    led.classList.toggle('on', now);
    b.setAttribute('aria-pressed', String(now));
  });
  parent.appendChild(d);
}
function initInstruments() {
  const instEl = $('inst');
  INST.forEach(([, name, keys]) => {
    addSwitch(instEl, name, true, `${name} on or off`, () => {
      const turnOff = !S.cancel.has(keys[0]);
      keys.forEach((k) => (turnOff ? S.cancel.add(k) : S.cancel.delete(k)));
      return !turnOff;
    });
  });
  addSwitch(instEl, 'Hats as Metal', false, 'Play hi-hats as metal beat', () => (S.metal = !S.metal));
}

/* ---------- transport ---------- */
function initTransport() {
  btnStart.addEventListener('click', toggle);
  btnFill.addEventListener('click', toggleFill);
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea,[role="slider"]')) return;
    if (e.code === 'Space') { e.preventDefault(); btnStart.classList.add('down'); toggle(); }
    else if (e.key === 'f' || e.key === 'F') { btnFill.classList.add('down'); toggleFill(); }
  });
  document.addEventListener('keyup', () => { btnStart.classList.remove('down'); btnFill.classList.remove('down'); });
}
function renderTransport() {
  ledStart.classList.toggle('on', S.playing);
  btnStart.textContent = S.playing ? 'Stop' : 'Start';
  btnStart.setAttribute('aria-pressed', String(S.playing));
  if (!S.playing) { lamp.className = 'lamp'; lastStep = null; setPlayhead(null); renderStrip(); }
  renderDisplay();
}

/* ---------- display + strip ---------- */
function renderDisplay() {
  dName.textContent = selectionName(S.active);
  let vtxt;
  if (S.active.kind === 'mem') vtxt = 'Memory';
  else if (S.variation === 'AB') vtxt = 'Var A+B' + (S.playing && lastStep?.v ? ' (' + lastStep.v + ')' : '');
  else vtxt = 'Var ' + S.variation;
  const fillOn = S.fillQueued || (S.playing && lastStep?.fill);
  dSub.innerHTML = `${vtxt} <span class="tag${fillOn ? ' on' : ''}">Fill</span><span class="tag${S.queued ? ' on' : ''}">Next: ${S.queued ? selectionName(S.queued) : '—'}</span>`;
  dBar.textContent = S.playing
    ? (lastStep ? 'Bar ' + String(lastStep.bar + 1).padStart(3, '0') + ' · ' + (lastStep.step + 1) : 'Bar 001')
    : 'Stopped';
  dTempo.textContent = S.tempo;
}

let stripKey = '', stripEls = [];
function renderStrip(p = shownPattern()) {
  const key = p.len + '/' + p.div;
  if (key !== stripKey) {
    strip.innerHTML = '';
    stripEls = [];
    for (let i = 0; i < p.len; i++) {
      const e = document.createElement('i');
      if (i % p.div === 0) e.className = 'beat';
      strip.appendChild(e);
      stripEls.push(e);
    }
    stripKey = key;
  }
  stripEls.forEach((e, i) => { e.classList.remove('on'); e.classList.toggle('acc', !!p.acc[i]); });
}

/* ---------- animation loop: drain the visual queue in time with the audio clock ---------- */
let lampOffAt = 0;
function frame(now) {
  const ctx = getContext();
  if (S.playing && ctx) {
    let last = null;
    while (visualQueue.length && visualQueue[0].t <= ctx.currentTime) last = visualQueue.shift();
    if (last) {
      lastStep = last;
      renderStrip({ len: last.len, div: last.div, acc: last.pacc });
      stripEls.forEach((e, i) => e.classList.toggle('on', i === last.step));
      if (last.step % last.div === 0) {
        lamp.className = 'lamp on' + (last.step === 0 ? '' : ' soft');
        lampOffAt = now + 70;
      }
      setPlayhead(last.fill ? null : last.step, last.base);
      renderDisplay();
    }
  }
  if (lampOffAt && now > lampOffAt) { lamp.className = 'lamp'; lampOffAt = 0; }
  requestAnimationFrame(frame);
}

export function initPanel() {
  lamp = $('lamp'); strip = $('strip'); ledFill = $('ledFill'); ledStart = $('ledStart');
  btnStart = $('btnStart'); btnFill = $('btnFill');
  dName = $('dName'); dTempo = $('dTempo'); dSub = $('dSub'); dBar = $('dBar');

  initKnobs();
  initRhythmKeys();
  initVariation();
  initInstruments();
  initTransport();

  on('selection', () => { renderKeys(); renderDisplay(); if (!S.playing) renderStrip(); });
  on('variation', () => { renderVariation(); renderDisplay(); if (!S.playing) renderStrip(); });
  on('transport', renderTransport);
  on('fill', () => { ledFill.classList.toggle('on', S.fillQueued); renderDisplay(); });
  on('memory', () => { if (!S.playing) renderStrip(); });

  renderVariation(); renderKeys(); renderStrip(); renderTransport();
  requestAnimationFrame(frame);
}
