// Rotary knob: drag up/down, mouse wheel, arrow keys, Home/End, double-click to reset.
// Markup expected inside `el`: .ticks, .rot > .cap + .ptr (see index.html).
//
// Options:
//   min/max/step  continuous range       | steps: [...]  detented list of values
//   value         initial value (or index into steps)
//   reset         value (or index) restored on double-click
//   out           id of the element that shows the formatted value
//   wheel         increment per wheel notch (continuous only)
//   fmt(value)    display formatter
//   onChange(value)
export function Knob(el, o) {
  const rot = el.querySelector('.rot');
  const out = document.getElementById(o.out);
  const n = o.steps ? o.steps.length - 1 : o.max - o.min;
  let v = o.value, pointer = null, startY = 0, startV = 0;

  function set(nv, fire = true) {
    if (o.steps) nv = Math.max(0, Math.min(n, Math.round(nv)));
    else nv = Math.max(o.min, Math.min(o.max, Math.round(nv / (o.step || 1)) * (o.step || 1)));
    v = nv;
    const frac = o.steps ? nv / n : (nv - o.min) / n;
    rot.style.transform = `rotate(${(-135 + 270 * frac).toFixed(1)}deg)`;
    const val = o.steps ? o.steps[nv] : nv;
    const txt = o.fmt ? o.fmt(val) : String(val);
    out.textContent = txt;
    el.setAttribute('aria-valuetext', txt);
    el.setAttribute('aria-valuemin', o.steps ? 0 : o.min);
    el.setAttribute('aria-valuemax', o.steps ? n : o.max);
    el.setAttribute('aria-valuenow', nv);
    if (fire) o.onChange(val);
  }

  el.addEventListener('pointerdown', (e) => {
    pointer = e.pointerId; el.setPointerCapture(pointer);
    startY = e.clientY; startV = v;
    el.classList.add('grab'); el.focus({ preventScroll: true });
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    const dy = startY - e.clientY;
    set(o.steps ? startV + dy / 26 : startV + (dy / 170) * n);
  });
  const end = (e) => { if (e.pointerId !== pointer) return; pointer = null; el.classList.remove('grab'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    set(v + (e.deltaY < 0 ? 1 : -1) * (o.steps ? 1 : o.wheel || 1));
  }, { passive: false });
  el.addEventListener('dblclick', () => set(o.reset));
  el.addEventListener('keydown', (e) => {
    const big = o.steps ? 1 : Math.max(1, Math.round(n / 10));
    let d = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -1;
    else if (e.key === 'PageUp') d = big;
    else if (e.key === 'PageDown') d = -big;
    else if (e.key === 'Home') { set(o.steps ? 0 : o.min); e.preventDefault(); return; }
    else if (e.key === 'End') { set(o.steps ? n : o.max); e.preventDefault(); return; }
    if (d) { set(v + d); e.preventDefault(); }
  });

  set(v, false);
  return { set };
}
