// Program Write drawer: the step grid for the four user memories.
// Presets are shown read-only and can be copied into a memory.
import { S, on, emit } from '../state.js';
import { STYLES } from '../patterns.js';
import { VOICES } from '../audio/voices.js';
import { audition } from '../audio/engine.js';
import { MEM, LENGTHS, isEmpty, copyIntoMem, resizeMem, clearMem, toggleStep } from '../memory.js';
import { select, stylePattern } from '../sequencer.js';

const $ = (id) => document.getElementById(id);
let memPill, lenPill, divPill, grid, wNote, copyTo, btnCopy, btnClear, copyLbl;
let cols = [];
let playheadCol = -1;

const editSel = () => S.queued || S.active;
const editMemIndex = () => { const s = editSel(); return s.kind === 'mem' ? s.i : -1; };
const voiceFor = (k) => (S.metal && (k === 'HH' || k === 'OH') ? 'MB' : k);

function memLabel(i) {
  return 'Program ' + (i + 1) + (isEmpty(MEM[i]) ? ' (empty)' : MEM[i].example ? ' (example)' : '');
}

export function renderWriter() {
  const sel = editSel();
  const mi = sel.kind === 'mem' ? sel.i : -1;
  const p = mi >= 0 ? MEM[mi] : stylePattern(sel.i, S.variation === 'B' ? 'B' : 'A');

  [...memPill.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === mi)));
  [...lenPill.children].forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.len === p.len)); b.disabled = mi < 0; });
  [...divPill.children].forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.div === p.div)); b.disabled = mi < 0; });
  [...copyTo.options].forEach((o, i) => { o.textContent = memLabel(i); });

  if (mi < 0) {
    const firstEmpty = MEM.findIndex(isEmpty);
    if (document.activeElement !== copyTo) copyTo.value = firstEmpty >= 0 ? firstEmpty : MEM.length - 1;
    copyLbl.textContent = 'Copy this rhythm into';
    copyTo.hidden = false; btnCopy.hidden = false; btnClear.hidden = true;
    const vname = S.variation === 'B' ? 'B' : 'A';
    wNote.innerHTML = `Showing <b>${STYLES[sel.i].name}, variation ${vname}</b>. Presets are fixed. Copy one into a memory to rework it step by step.`;
  } else {
    copyLbl.textContent = 'Memory';
    copyTo.hidden = true; btnCopy.hidden = true; btnClear.hidden = false;
    wNote.innerHTML = `Editing <b>Program ${mi + 1}</b>${p.example ? ' (example pattern)' : ''}. Tap steps to add or remove hits; changes play on the next pass and save in this browser.`;
  }

  grid.style.setProperty('--len', p.len);
  grid.classList.toggle('locked', mi < 0);
  const beat = (s) => (s % p.div === 0 ? ' b' : '');
  let h = '<div></div>';
  for (let s = 0; s < p.len; s++) h += `<div class="hd${beat(s)}">${s % p.div === 0 ? s / p.div + 1 : '·'}</div>`;
  h += '<button class="rl acc" data-aud="" tabindex="-1">Accent</button>';
  for (let s = 0; s < p.len; s++) {
    h += `<button class="cell a${beat(s)}${p.acc[s] ? ' on' : ''}" data-r="acc" data-s="${s}" aria-label="Accent step ${s + 1}" aria-pressed="${p.acc[s]}"></button>`;
  }
  VOICES.forEach(([k, name]) => {
    h += `<button class="rl" data-aud="${k}">${name}</button>`;
    for (let s = 0; s < p.len; s++) {
      h += `<button class="cell${beat(s)}${p.v[k][s] ? ' on' : ''}" data-r="${k}" data-s="${s}" aria-label="${name} step ${s + 1}" aria-pressed="${p.v[k][s]}"></button>`;
    }
  });
  grid.innerHTML = h;
  grid._pattern = p;
  playheadCol = -1;
  cols = [];
  grid.querySelectorAll('.cell').forEach((c) => { const s = +c.dataset.s; (cols[s] || (cols[s] = [])).push(c); });
}

/** Highlight the grid column for the step being heard, if the grid shows that pattern. */
export function setPlayhead(step, pattern) {
  if (playheadCol >= 0 && cols[playheadCol]) cols[playheadCol].forEach((c) => c.classList.remove('ph'));
  playheadCol = -1;
  if (step != null && grid._pattern === pattern && cols[step]) {
    playheadCol = step;
    cols[step].forEach((c) => c.classList.add('ph'));
  }
}

export function initWriter() {
  memPill = $('memPill'); lenPill = $('lenPill'); divPill = $('divPill'); grid = $('grid'); wNote = $('wNote');
  copyTo = $('copyTo'); btnCopy = $('btnCopy'); btnClear = $('btnClear'); copyLbl = $('copyLbl');

  MEM.forEach((_, i) => {
    const b = document.createElement('button');
    b.textContent = 'M' + (i + 1);
    b.addEventListener('click', () => select({ kind: 'mem', i }));
    memPill.appendChild(b);
    const o = document.createElement('option'); o.value = i; copyTo.appendChild(o);
  });
  LENGTHS.forEach((n) => {
    const b = document.createElement('button');
    b.textContent = n; b.dataset.len = n;
    b.addEventListener('click', () => { const mi = editMemIndex(); if (mi >= 0) { resizeMem(mi, n, null); emit('memory'); } });
    lenPill.appendChild(b);
  });
  [['Straight', 4], ['Triplet', 3]].forEach(([t, d]) => {
    const b = document.createElement('button');
    b.textContent = t; b.dataset.div = d;
    b.addEventListener('click', () => { const mi = editMemIndex(); if (mi >= 0) { resizeMem(mi, null, d); emit('memory'); } });
    divPill.appendChild(b);
  });

  grid.addEventListener('click', (e) => {
    const lab = e.target.closest('[data-aud]');
    if (lab) { if (lab.dataset.aud) audition(voiceFor(lab.dataset.aud)); return; }
    const c = e.target.closest('.cell');
    if (!c) return;
    const mi = editMemIndex();
    if (mi < 0) return;
    const r = c.dataset.r;
    const now = toggleStep(mi, r, +c.dataset.s);
    c.classList.toggle('on', now);
    c.setAttribute('aria-pressed', now);
    if (now && r !== 'acc' && !S.playing) audition(voiceFor(r));
    [...copyTo.options].forEach((o, i) => { o.textContent = memLabel(i); });
    emit('memory', { cellOnly: true });
  });

  btnCopy.addEventListener('click', () => {
    const sel = editSel();
    if (sel.kind !== 'preset') return;
    const ti = +copyTo.value;
    copyIntoMem(stylePattern(sel.i, S.variation === 'B' ? 'B' : 'A'), ti);
    select({ kind: 'mem', i: ti });
  });
  btnClear.addEventListener('click', () => {
    const mi = editMemIndex();
    if (mi < 0) return;
    clearMem(mi);
    emit('memory');
  });

  on('selection', renderWriter);
  on('variation', renderWriter);
  on('memory', (d) => { if (!d?.cellOnly) renderWriter(); });
  renderWriter();
}
