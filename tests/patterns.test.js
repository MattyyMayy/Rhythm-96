import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, FILLS, GROUPS, P, fit } from '../src/patterns.js';
import { VKEYS } from '../src/audio/voices.js';

const checkShape = (p, label) => {
  assert.ok([3, 4].includes(p.div), `${label}: div must be 3 or 4`);
  assert.equal(p.acc.length, p.len, `${label}: accent length`);
  for (const k of VKEYS) assert.equal(p.v[k].length, p.len, `${label}: ${k} length`);
};

test('there are 34 preset rhythms (17 styles x A/B)', () => {
  assert.equal(STYLES.length, 17);
  for (const s of STYLES) { assert.ok(s.A && s.B, s.name); }
});

test('every preset and fill has a consistent shape', () => {
  for (const s of STYLES) { checkShape(s.A, s.name + ' A'); checkShape(s.B, s.name + ' B'); }
  for (const [name, f] of Object.entries(FILLS)) checkShape(f, 'fill ' + name);
});

test('every style points at a fill that exists and matches its bar length', () => {
  for (const s of STYLES) {
    const f = FILLS[s.fill];
    assert.ok(f, `${s.name}: unknown fill ${s.fill}`);
    assert.equal(f.len, s.A.len, `${s.name}: fill length should match the bar`);
  }
});

test('every style belongs to a panel group', () => {
  const ids = new Set(GROUPS.map((g) => g[0]));
  for (const s of STYLES) assert.ok(ids.has(s.g), `${s.name}: group ${s.g}`);
});

test('every preset actually plays something', () => {
  for (const s of STYLES) for (const v of ['A', 'B']) {
    assert.ok(VKEYS.some((k) => s[v].v[k].some(Boolean)), `${s.name} ${v} is silent`);
  }
});

test('pattern strings only use x and .', () => {
  assert.equal(fit('x.', 5), 'x.x.x');
  assert.equal(fit('', 3), '...');
  const p = P(4, 4, { BD: 'x' }, '');
  assert.deepEqual(p.v.BD, [true, true, true, true]);
});
