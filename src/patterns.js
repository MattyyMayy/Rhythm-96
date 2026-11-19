// Preset rhythms. Pure data plus helpers, no DOM or audio, so it can be unit tested in Node.
//
// Pattern shape: { len, div, acc: bool[len], v: { [voiceKey]: bool[len] } }
//   len = steps per bar, div = steps per beat (4 straight sixteenths, 3 triplet eighths).
// Pattern strings use "x" for a hit and "." for a rest; a short string repeats to fill the bar.
import { VKEYS } from './audio/voices.js';

export function fit(s, len) {
  if (!s) return '.'.repeat(len);
  let r = '';
  while (r.length < len) r += s;
  return r.slice(0, len);
}

export function P(len, div, parts, acc) {
  const o = { len, div, acc: [...fit(acc || '', len)].map((c) => c === 'x'), v: {} };
  for (const k of VKEYS) o.v[k] = [...fit(parts[k] || '', len)].map((c) => c === 'x');
  return o;
}

/** One-bar fills. Each style names the fill it uses. */
export const FILLS = {
  rock: P(16, 4, { BD: 'x.......x.......', SD: '....x.x.x.xxxxxx', HH: 'x.x.x.x.........', CGH: '........x...x...', CGL: '..........x...x.' }, 'x...x...x...x.xx'),
  trip: P(12, 3, { BD: 'x.....x.....', SD: '...x..xxxxxx', HH: 'x.xx.x......' }, 'x..x..x..x.x'),
  waltz: P(12, 4, { BD: 'x...........', SD: '....x.x.xxxx', HH: 'x...x.......' }, 'x...x...x..x'),
  latin: P(16, 4, { BD: 'x.......x.......', CGH: 'x.x...x.x...xx..', CGL: '....x.x...x...xx', CB: 'x...x...x...x...' }, 'x...x...x...xxxx'),
};

/** 17 styles x 2 variations = 34 preset rhythms. g = panel group id. */
export const STYLES = [
  { name: 'Rock 1', g: 'pop', fill: 'rock',
    A: P(16, 4, { BD: 'x.......x.x.....', SD: '....x.......x...', HH: 'x.x.' }, 'x...x...x...x...'),
    B: P(16, 4, { BD: 'x.....x.x.x.....', SD: '....x.......x..x', HH: 'x.x.x.x.x.x.x...', OH: '..............x.', CY: 'x...............' }, 'x...x...x...x...') },
  { name: 'Rock 2', g: 'pop', fill: 'rock',
    A: P(16, 4, { BD: 'x.x.....x.x.....', SD: '....x.......x...', HH: 'x' }, 'x.x.'),
    B: P(16, 4, { BD: 'x.x...x.x.x...x.', SD: '....x.......x.x.', HH: 'x', MA: '..x.' }, 'x.x.') },
  { name: 'Rock 3', g: 'pop', fill: 'rock',
    A: P(16, 4, { BD: 'x.....x...x.....', SD: '........x.......', HH: 'x.x.' }, 'x.......x.......'),
    B: P(16, 4, { BD: 'x.....x...x..x..', SD: '........x.......', RS: '....x.......x...', HH: 'x.x.', CY: 'x...............' }, 'x.......x.......') },
  { name: 'Disco 1', g: 'pop', fill: 'rock',
    A: P(16, 4, { BD: 'x...', SD: '....x.......x...', HH: 'x...', OH: '..x.' }, '..x.'),
    B: P(16, 4, { BD: 'x...', SD: '....x.......x...', HH: 'x...', OH: '..x.', MA: 'x', TB: '....x.......x...' }, '..x.') },
  { name: 'Disco 2', g: 'pop', fill: 'latin',
    A: P(16, 4, { BD: 'x...', SD: '....x.......x...', HH: 'x', CGH: '..x..x....x..x..' }, 'x.x.'),
    B: P(16, 4, { BD: 'x...', SD: '....x.......x...', HH: 'x', CGH: '..x..x....x..x..', CGL: '......x.......x.', CB: 'x...x...x...x..x' }, 'x.x.') },
  { name: 'Shuffle', g: 'pop', fill: 'trip',
    A: P(12, 3, { BD: 'x.....x.....', SD: '...x.....x..', HH: 'x.x' }, 'x.....x.....'),
    B: P(12, 3, { BD: 'x.....x..x.x', SD: '...x.....x.x', HH: 'x.x', CY: 'x...........' }, 'x.....x.....') },
  { name: 'Slow Rock', g: 'pop', fill: 'trip',
    A: P(12, 3, { BD: 'x.....x..x..', SD: '...x.....x..', HH: 'x' }, 'x..x..x..x..'),
    B: P(12, 3, { BD: 'x..x..x..x.x', SD: '...x.....x..', HH: 'x', CY: 'x...........' }, 'x..x..x..x..') },
  { name: 'Boogie', g: 'pop', fill: 'trip',
    A: P(12, 3, { BD: 'x..x..x..x..', SD: '...x.....x..', HH: 'x.x' }, 'x..x..x..x..'),
    B: P(12, 3, { BD: 'x.xx.xx.xx.x', SD: '...x.....x..', HH: 'x.x', CB: 'x.....x.....' }, 'x..x..x..x..') },
  { name: 'Waltz', g: 'ball', fill: 'waltz',
    A: P(12, 4, { BD: 'x...........', SD: '....x...x...', HH: 'x...x...x...' }, 'x...........'),
    B: P(12, 4, { BD: 'x.......x...', SD: '....x...x..x', HH: 'x.x.x.x.x.x.', CY: 'x...........' }, 'x...........') },
  { name: 'Swing', g: 'ball', fill: 'trip',
    A: P(12, 3, { CY: 'x..x.xx..x.x', HH: '...x.....x..', BD: 'x.....x.....' }, 'x.....x.....'),
    B: P(12, 3, { CY: 'x..x.xx..x.x', HH: '...x.....x..', BD: 'x.....x.....', RS: '.....x.....x', SD: '..........x.' }, 'x.....x.....') },
  { name: 'Foxtrot', g: 'ball', fill: 'rock',
    A: P(16, 4, { BD: 'x...', SD: '....x.......x...', HH: 'x.x.' }, 'x.......x.......'),
    B: P(16, 4, { BD: 'x...', SD: '....x..x....x...', HH: 'x.xx', RS: '..........x.....' }, 'x.......x.......') },
  { name: 'Tango', g: 'ball', fill: 'latin',
    A: P(16, 4, { BD: 'x...', SD: '............x.x.', CV: 'x..xx.x.' }, 'x...x...x...x.x.'),
    B: P(16, 4, { BD: 'x..xx...', SD: '....x.......x.xx', CV: 'x..xx.x.', CY: 'x...............' }, 'x...x...x...x.xx') },
  { name: 'Bossa Nova', g: 'latin', fill: 'latin',
    A: P(16, 4, { BD: 'x..xx..x', RS: 'x..x..x...x..x..', MA: 'x.x.' }, 'x..x..x...x..x..'),
    B: P(16, 4, { BD: 'x..xx..x', RS: '..x..x...x..x...', MA: 'x', CGL: '......x.......x.' }, '..x..x...x..x...') },
  { name: 'Samba', g: 'latin', fill: 'latin',
    A: P(16, 4, { BD: 'x..xx..x', TB: 'x', CB: 'x.x..x.x..x.x.x.', SD: '..x...x...x..x..' }, '...x'),
    B: P(16, 4, { BD: 'x..xx..x', TB: 'x', CB: 'x.x..x.x..x.x.x.', CGH: 'x.x.x.xx', CGL: '.x...x...x...x..' }, '...x') },
  { name: 'Mambo', g: 'latin', fill: 'latin',
    A: P(16, 4, { BD: '...x.......x....', CB: 'x.x.xx.x', CV: 'x..x..x...x.x...', CGH: '..x.......x.....', CGL: '......xx' }, 'x...'),
    B: P(16, 4, { BD: '...x.......x....', CB: 'x.x.xx.x', CV: 'x..x..x...x.x...', BOH: 'x.x.', BOL: '.x.x', CGL: '......xx' }, 'x...') },
  { name: 'Cha-Cha', g: 'latin', fill: 'latin',
    A: P(16, 4, { BD: 'x.......', CB: 'x...', GU: 'x...x.x.', CGH: '..........x.xx..', CGL: '......x.......' }, 'x...x...x...x.x.'),
    B: P(16, 4, { BD: 'x.....x.', CB: 'x.x.', GU: 'x...x.x.', CGH: '..x.......x.xx..', CGL: '......x.', MA: 'x.x.' }, 'x...x...x...x.x.') },
  { name: 'Rhumba', g: 'latin', fill: 'latin',
    A: P(16, 4, { BD: 'x...', CV: 'x..x...x..x.x...', MA: 'x.x.', BOH: '..x.' }, 'x..x...x..x.x...'),
    B: P(16, 4, { BD: 'x..xx..x', CV: 'x..x...x..x.x...', MA: 'x', BOH: '..x.', BOL: 'x.......', GU: 'x...' }, 'x..x...x..x.x...') },
];

export const GROUPS = [['pop', 'Rock & Pop'], ['ball', 'Ballroom'], ['latin', 'Latin'], ['mem', 'Memory']];

/** Pick the fill for a pattern that isn't a preset (user memories). */
export function fillForShape(p) {
  if (p.div === 3) return FILLS.trip;
  if (p.len % 3 === 0) return FILLS.waltz;
  return FILLS.rock;
}
