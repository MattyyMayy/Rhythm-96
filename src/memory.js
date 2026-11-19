// The eight user-programmable rhythm memories, saved to localStorage.
// Older saves with four memories still load; the extra slots start empty.
import { P } from './patterns.js';
import { VKEYS } from './audio/voices.js';

const KEY = 'rhythm96-memories-v1';
export const LENGTHS = [9, 12, 16, 24, 32];
export const MEM_COUNT = 8;

export const blank = (len = 16, div = 4) => P(len, div, {}, '');

function exampleMem() {
  const p = P(16, 4, {
    BD: 'x.x...x..x....x.', SD: '....x..x.x..x...', HH: 'xxxxxxxxxxxxxx.x', OH: '..............x.', CGH: '......x.......x.',
  }, 'x...x...x...x...');
  p.example = true;
  return p;
}

export function ser(p) {
  const o = { len: p.len, div: p.div, acc: p.acc.map((b) => (b ? 'x' : '.')).join(''), v: {} };
  for (const k of VKEYS) o.v[k] = p.v[k].map((b) => (b ? 'x' : '.')).join('');
  if (p.example) o.example = true;
  return o;
}

export function deser(o) {
  if (!o || !LENGTHS.includes(o.len) || ![3, 4].includes(o.div)) return null;
  const p = P(o.len, o.div, o.v || {}, o.acc || '');
  if (o.example) p.example = true;
  return p;
}

export const isEmpty = (p) => !p.acc.some(Boolean) && VKEYS.every((k) => !p.v[k].some(Boolean));

/** Live memory slots. Mutated in place so other modules can hold references. */
export const MEM = [exampleMem(), ...Array.from({ length: MEM_COUNT - 1 }, () => blank())];

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length >= 1 && arr.length <= MEM_COUNT) {
      const d = arr.map(deser);
      if (d.every(Boolean)) d.forEach((p, i) => { MEM[i] = p; });
    }
  }
} catch { /* storage blocked or corrupt: keep defaults */ }

export function saveMem() {
  try { localStorage.setItem(KEY, JSON.stringify(MEM.map(ser))); } catch { /* ignore */ }
}

export function copyIntoMem(src, i) {
  MEM[i] = deser(ser(src));
  delete MEM[i].example;
  saveMem();
}

export function resizeMem(i, len, div) {
  const p = MEM[i];
  if (len) {
    const grow = (a) => { const r = a.slice(0, len); while (r.length < len) r.push(false); return r; };
    p.acc = grow(p.acc);
    VKEYS.forEach((k) => { p.v[k] = grow(p.v[k]); });
    p.len = len;
  }
  if (div) p.div = div;
  delete p.example;
  saveMem();
}

export function clearMem(i) {
  const p = MEM[i];
  p.acc.fill(false);
  VKEYS.forEach((k) => p.v[k].fill(false));
  delete p.example;
  saveMem();
}

export function toggleStep(i, row, step) {
  const p = MEM[i];
  const arr = row === 'acc' ? p.acc : p.v[row];
  arr[step] = !arr[step];
  delete p.example;
  saveMem();
  return arr[step];
}
