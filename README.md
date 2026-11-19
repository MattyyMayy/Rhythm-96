# Parlor PR-34

A playable rhythm machine that runs in your browser. Pick a preset, flip between variations, add fills, or copy a preset into one of four memories and rework it step by step. Every sound is synthesized live with the Web Audio API.

## Run it

You need [Node.js](https://nodejs.org) (the LTS version) installed.

```
npm install
npm run dev
```

Your browser opens the machine. Press **Start** (browsers only allow sound after you click something).

To make a single file you can open anywhere without a server:

```
npm run build
```

Then open `dist/index.html`.

## Using it

- **Rhythm Select**: 17 styles, each with variation A and B. Choosing a new one while playing switches at the next bar.
- **Variation**: A, B, or A+B to alternate them every bar.
- **Fill / Intro**: plays a one-bar fill on the next bar. Press it before Start for an intro fill.
- **Auto Fill**: adds a fill every 2, 4, 8, 12 or 16 bars.
- **Accent**: how hard accented steps hit.
- **Balance**: left favors drums (bass, snare, rim), right favors percussion.
- **Instruments**: switch voice groups off and on. "Hats as Metal" swaps the hi-hats for a metallic tick.
- **Program Write**: edit the four memories. Choose a preset and press **Copy & edit** to start from it. Edits save in your browser.

Keyboard: `Space` starts and stops, `F` arms a fill. Knobs respond to dragging up or down, the mouse wheel and the arrow keys; double-click resets a knob.

## Working on it with Claude Code

Open this folder in Claude Code. `CLAUDE.md` explains the architecture, commands and conventions. Some ideas to try:

- "Add a swing knob that delays every second sixteenth."
- "Add MIDI export of the current pattern."
- "Add Web MIDI clock sync so the machine follows my DAW."
- "Add a song mode that chains memories."
