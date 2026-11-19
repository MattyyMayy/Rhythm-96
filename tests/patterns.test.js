import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, FILLS, GROUPS, P, fit } from '../src/patterns.js';
import { VKEYS, VOICES, KITS, KIT_IDS, KIT_TONE, INST } from '../src/audio/voices.js';
import { swingOffset, humanizeNote, HUMANIZE_MAX } from '../src/sequencer.js';
import { filterFreq, filterQ, resoMakeup, driveMakeup, delaySeconds, driveCurve, crushCurve, DELAY_TIMES } from '../src/audio/fx.js';
import { MEM, MEM_COUNT } from '../src/memory.js';

const checkShape = (p, label) => {
  assert.ok([3, 4].includes(p.div), `${label}: div must be 3 or 4`);
  assert.equal(p.acc.length, p.len, `${label}: accent length`);
  for (const k of VKEYS) assert.equal(p.v[k].length, p.len, `${label}: ${k} length`);
};

test('there are 52 preset rhythms (26 styles x A/B)', () => {
  assert.equal(STYLES.length, 26);
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

test('there are jazz, house, techno and UK garage presets', () => {
  for (const g of ['jazz', 'club', 'ukg']) assert.ok(STYLES.some((s) => s.g === g), g);
  for (const n of ['House 1', 'Techno 1', '2-Step', 'Jazz Ride']) assert.ok(STYLES.some((s) => s.name === n), n);
});

test('sound kits: "96" is first and every kit has a tone', () => {
  assert.equal(KITS[0][1], '96');
  assert.equal(new Set(KIT_IDS).size, KIT_IDS.length);
  for (const id of KIT_IDS) assert.ok(KIT_TONE[id] > 0, id);
});

test('every instrument-cancel group names real voices', () => {
  const keys = new Set(VOICES.map((v) => v[0]));
  for (const [, , ks] of INST) for (const k of ks) assert.ok(keys.has(k), k);
});

test('swing delays only every second step of a straight grid', () => {
  assert.equal(swingOffset(1, 4, 50), 0);
  assert.equal(swingOffset(0, 4, 75), 0);
  assert.equal(swingOffset(1, 4, 75), 0.5);
  assert.ok(Math.abs(swingOffset(3, 4, 66) - 0.32) < 1e-9);
  assert.equal(swingOffset(1, 3, 75), 0, 'triplet feels are not swung');
  assert.equal(swingOffset(1, 4, 90), 0.5, 'swing is capped at 75');
});

test('every preset can be copied into a memory', async () => {
  const { ser, deser } = await import('../src/memory.js');
  for (const st of STYLES) for (const v of ['A', 'B']) assert.ok(deser(ser(st[v])), `${st.name} ${v}`);
});

test('there are eight program memories', () => {
  assert.equal(MEM_COUNT, 8);
  assert.equal(MEM.length, 8);
});

test('humanize: off is exact, on stays within bounds', () => {
  assert.deepEqual(humanizeNote(0), { dt: 0, dv: 1 });
  for (const r of [0, 0.5, 0.999]) {
    const h = humanizeNote(10, () => r);
    assert.ok(Math.abs(h.dt) <= HUMANIZE_MAX + 1e-12);
    assert.ok(h.dv >= 0.82 && h.dv <= 1.18);
  }
  assert.ok(Math.abs(humanizeNote(5, () => 1).dt - HUMANIZE_MAX / 2) < 1e-12);
});

test('effects: knob at 0 leaves the sound unchanged', () => {
  assert.equal(filterFreq(0, 'lp'), 20000);
  assert.equal(filterFreq(0, 'hp'), 20);
  assert.ok(filterFreq(10, 'lp') < 200 && filterFreq(10, 'hp') > 5000);
  assert.ok(Math.abs(filterQ(0) - 0.7) < 1e-9);
  for (const c of [driveCurve(0, 9), crushCurve(0, 9)]) {
    c.forEach((y, i) => assert.ok(Math.abs(y - ((i / 8) * 2 - 1)) < 1e-6));
  }
  assert.equal(resoMakeup(10, 0), 1, 'no level change while the filter is open');
  assert.ok(resoMakeup(10, 10) < 0.5);
  assert.ok(Math.abs(driveMakeup(0) - 1) < 1e-9);
  const d = driveCurve(10, 9);
  assert.ok(d[6] > 0.5 && d[8] <= 1.000001, 'drive pushes the level up but stays in range');
});

test('delay time follows the tempo', () => {
  const quarter = DELAY_TIMES.findIndex((t) => t[0] === '1/4');
  assert.equal(delaySeconds(quarter, 120), 0.5);
  assert.ok(DELAY_TIMES.every((_, i) => delaySeconds(i, 40) <= 4), 'fits in the 4 s delay line');
});
