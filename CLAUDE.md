# Parlor PR-34

A playable browser rhythm machine in the style of late-1970s preset drum boxes: 34 preset rhythms (17 styles × variations A/B), A+B alternation, manual and automatic fill-ins, accent, drum/percussion balance, instrument cancels, and four programmable memories with a step editor. All sound is synthesized live with the Web Audio API.

Plain JavaScript (ES modules) and CSS, no framework. Vite is used only as the dev server and bundler.

## Commands

- `npm install`: install dev dependencies (Vite)
- `npm run dev`: dev server with hot reload, opens the browser
- `npm test`: unit tests for pattern data (Node's built-in test runner, no browser)
- `npm run build`: writes a single self-contained `dist/index.html` with JS and CSS inlined
- `npm run preview`: serves the built file

Run `npm test` after any change to `src/patterns.js`, `src/memory.js` or `src/audio/voices.js`. Run `npm run build` before calling a change done.

## Layout

```
index.html            Panel markup (static parts). Dynamic keys/switches are built in JS.
src/main.js           Entry point: imports CSS, initializes writer then panel.
src/state.js          Shared state object `S` and a tiny event bus (on/emit).
src/patterns.js       Preset rhythms, fills and panel groups. Pure data, testable in Node.
src/memory.js         Four user memories (load/save to localStorage, edit helpers).
src/sequencer.js      Look-ahead scheduler, start/stop, select, fill, variation.
src/audio/voices.js   Voice list, instrument-cancel groups, synthesis recipes.
src/audio/engine.js   AudioContext, mixer buses (drum/perc/master), play/audition.
src/ui/knob.js        Rotary knob control (drag, wheel, keys, double-click reset).
src/ui/panel.js       Front panel wiring, display, LEDs, animation loop.
src/ui/writer.js      Program Write step grid.
src/styles.css        All styling. Color and font tokens live in :root at the top.
tests/                node:test unit tests.
```

## How it fits together

- **State and events.** Modules read and write `S` directly and call `emit()` after a change. Events: `selection`, `variation`, `transport`, `fill`, `memory`. UI modules subscribe with `on()` and re-render. Avoid direct imports between `panel.js` and `writer.js` beyond `setPlayhead`.
- **Pattern format.** `{ len, div, acc: bool[], v: { [voiceKey]: bool[] } }`. `len` is steps per bar, `div` is steps per beat (4 = sixteenths, 3 = triplet eighths). Write new presets with the `P(len, div, parts, accent)` helper using `x`/`.` strings; short strings repeat to fill the bar.
- **Timing.** `sequencer.js` uses the look-ahead pattern: a 25 ms `setInterval` schedules notes up to 120 ms ahead on `AudioContext.currentTime`. Never schedule audio from `requestAnimationFrame` or play notes "now" in the timer. The UI reads `visualQueue` in the animation loop so LEDs match what is heard.
- **Bar-line behavior.** Choosing a rhythm while playing queues it (`S.queued`) and it takes over at the next bar. Fills replace one whole bar. Auto Fill plays a fill on every Nth bar.
- **Voices.** Each voice in `makeVoices()` is `(time, velocity, outputNode)`. Adding a voice means: add it to `VOICES` (key, name, bus), add a recipe in `makeVoices`, and optionally to an `INST` cancel group. Patterns and the editor pick it up automatically.
- **Audio start.** Browsers block audio until a user gesture, so `initAudio()` runs on the first Start or audition click.

## Conventions

- Keep it dependency-free at runtime. Ask before adding a library.
- 2-space indent, semicolons, single quotes, ES modules.
- Every color and font comes from the tokens at the top of `styles.css`. The look is skeuomorphic hardware: walnut cheeks, brushed-metal faceplate, ivory and rust keys, amber display.
- Must work at phone width (about 400px) with no horizontal page scroll; only the step grid scrolls sideways.
- Keep controls keyboard reachable with visible focus, and keep `aria-label`/`aria-pressed` on buttons.
- Memories are stored under the localStorage key `pr34-memories-v1`. If you change the stored format, bump the key or migrate, and keep `deser()` tolerant of bad data.

## Originality rules

This is an original instrument inspired by the era, not a replica of any product.

- Do not use Roland (or other manufacturers') names, logos, model numbers or panel layouts in the UI or code.
- Do not transcribe factory patterns from real hardware; write new grooves in the style.
- Do not add samples recorded from real drum machines. Sounds stay synthesized.
