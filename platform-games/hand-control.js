// Hand control: the webcam watches one or two hands and moves the map with them. It sends the map's canvas the same
// pointer and wheel events a mouse or a touch screen sends, so the map moves by its own rules and nothing here knows
// its camera. Any map drawn on <canvas id="map"> that takes drags, two-finger pinches and the wheel can use it.
//   Open hand           points: lights what it is over, like a mouse
//   Pinch, let go       clicks: goes to what it is over, and presses the hand-control buttons
//   Pinch, move         drags the map
//   Fist, push or pull  zooms in toward the screen, out away from it (the wheel, at the point the fist closed)
//   Two hands pinched   stretched apart or squeezed together, zooms (a two-finger pinch, stretched a little more)
//   Pinky to thumb      goes out one level (the map's own upOne), once each time they touch
// The hand tracker is MediaPipe's (tasks-vision 0.10.14 from jsdelivr, its model from Google's storage); it runs in
// this page and the camera picture never leaves it. The button (or H) turns it on and off; a viewer who left it on
// finds it on next time. The cross on the camera window closes the window while the hands keep working, and Show
// camera opens it again; a viewer who closed it finds it closed next time. ?handsrc=<video or image URL> watches that
// instead of the camera, and ?handsrc=none watches nothing, for tests that hand it results themselves through
// window.__hands.see().
(() => {
'use strict';
const cv = document.getElementById('map');
if (!cv) return;

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const PID = 7001;                       // pointer ids for hands, clear of the mouse's and real fingers'
const REACH = 0.62, REACH_CY = 0.42;    // the part of the picture that spans the window: this much of its width, centred this far down
const PINCH_ON = 0.32, PINCH_OFF = 0.5; // thumb tip to index tip, over wrist to middle knuckle, in 3D
const PINKY_ON = 0.32, PINKY_OFF = 0.5; // thumb tip to pinky tip, the same way: one level out
const CURL = 1.1;                       // a finger is curled when its tip is nearer the wrist than this times its knuckle
const HOLD = { open: 2, pinch: 2, fist: 3, out: 3 }; // frames a new hand shape must last before it counts
const DEAD = 0.2;                       // a pressed hand may wander this much of its palm's size on screen and still be still, so a pinch and let go clicks
const SETTLE_MS = 200;                  // a hand just found cannot press yet: the tracker's first guess jumps once it locks on
const LOST_AFTER = 220;                 // ms a hand may go unseen before it is let go
const FIST_GAIN = 3, FIST_BAND = 0.03;  // fist zoom = (hand size change)^GAIN, past a band that swallows the tracker's jitter
const STRETCH = 1.5;                    // two-hand zoom = (spread change)^STRETCH
const WHEEL_RATE = 0.0015;              // the map's wheel: zoom = exp(-deltaY * WHEEL_RATE)
const EASE_MS = 30, CATCH_MS = 120;     // the pointer glides between camera frames; a drag catches up with the hand

const params = new URLSearchParams(location.search);
const TEST_SRC = params.get('handsrc');

// ---------- Look ----------
const css = document.createElement('style');
css.textContent = `
#hands { position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 5;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font: 14px/1.3 var(--font-body, system-ui, sans-serif); color: var(--ink, #1B263F); }
#hands button { font: inherit; color: inherit; background: var(--card, #fff); border: 1px solid var(--rule, #ccc);
  border-radius: 6px; padding: 8px 12px; cursor: pointer; }
#hands button:hover, #hands button.hand-over { border-color: var(--ink-soft, #555); }
#hands .row { display: flex; gap: 8px; }
#hands .close { position: absolute; top: 6px; right: 6px; z-index: 1; width: 32px; height: 32px; padding: 0; border: 0;
  border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgba(0, 0, 0, .55); }
#hands .close:hover, #hands .close.hand-over { background: rgba(0, 0, 0, .85); }
#hands .panel { background: var(--card, #fff); border: 1px solid var(--rule, #ccc); border-radius: 6px; padding: 8px; }
#hands .panel[hidden] { display: none; }
#hands .view { position: relative; }
#hands canvas { display: block; width: 256px; border-radius: 4px; background: #000; }
#hands .status { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 8px; font-size: 13px; color: #fff;
  background: rgba(0, 0, 0, .6); border-radius: 0 0 4px 4px; }
#hands .status:empty { display: none; }
#hands table { border-collapse: collapse; width: 256px; margin-top: 6px; font-size: 13px; }
#hands td { padding: 3px 6px; color: var(--ink-soft, #555); }
#hands td + td { color: var(--ink, #1B263F); text-align: right; }
#hands tr.now td { background: color-mix(in srgb, var(--line, #3F6FA3) 20%, transparent); color: var(--ink, #1B263F); }
.hand-cursor { position: fixed; left: 0; top: 0; z-index: 6; pointer-events: none; will-change: transform; }
.hand-cursor i { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; box-sizing: border-box;
  border-radius: 50%; border: 2px solid var(--ink, #1B263F); background: color-mix(in srgb, var(--card, #fff) 45%, transparent);
  transition: transform .12s, background-color .12s, border-color .12s; }
.hand-cursor.pinch i { transform: scale(.64); background: var(--line, #3F6FA3); border-color: var(--line, #3F6FA3); }
.hand-cursor.over i { transform: scale(1.2); border-width: 3px; border-color: var(--line, #3F6FA3);
  background: color-mix(in srgb, var(--line, #3F6FA3) 22%, transparent); } /* over something to click, as the mouse's pointer changes */
.hand-cursor.fist i { border-width: 4px; border-color: var(--steam, #c4501f); }
.hand-cursor.second { opacity: .6; }
`;
document.head.appendChild(css);

const ui = {};
ui.root = document.createElement('div');
ui.root.id = 'hands';
ui.root.innerHTML = `<div class="panel" hidden><div class="view"><canvas width="512" height="384"></canvas><div class="status"></div>
<button type="button" class="close" aria-label="Close the camera window" title="Close the camera window (your hands keep working)">
<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>
<table>
<tr data-g="open"><td>Open hand</td><td>Point</td></tr>
<tr data-g="click"><td>Pinch, let go</td><td>Go there</td></tr>
<tr data-g="drag"><td>Pinch, move</td><td>Move the map</td></tr>
<tr data-g="fist"><td>Fist, push in or pull back</td><td>Zoom</td></tr>
<tr data-g="out"><td>Pinky to thumb</td><td>Out one level</td></tr>
<tr data-g="stretch"><td>Pinch both hands, pull apart</td><td>Zoom</td></tr>
</table></div><div class="row"><button type="button" class="show" hidden>Show camera</button><button type="button" class="onoff">Hand control</button></div>`;
document.body.appendChild(ui.root);
ui.panel = ui.root.querySelector('.panel');
ui.view = ui.root.querySelector('canvas');
ui.status = ui.root.querySelector('.status');
ui.rows = [...ui.root.querySelectorAll('tr')];
ui.button = ui.root.querySelector('.onoff');
ui.show = ui.root.querySelector('.show');
ui.button.addEventListener('click', () => (running ? stop() : start()));
ui.root.querySelector('.close').addEventListener('click', () => (running ? openWindow(false) : (ui.panel.hidden = true)));
ui.show.addEventListener('click', () => openWindow(true));
addEventListener('keydown', e => {
  if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) running ? stop() : start();
});
let said = null;
function say(text) { if (text !== said) ui.status.textContent = said = text; }
let lit = null;
function light(g) {
  if (g === lit) return;
  lit = g;
  for (const r of ui.rows) r.classList.toggle('now', r.dataset.g === g);
}

// ---------- The map's input ----------
// The map captures each pointer it is pressed with; a made-up pointer cannot be captured, so hands are let through.
const capture = cv.setPointerCapture;
cv.setPointerCapture = function (id) { if (id < PID) return capture.call(this, id); };
function send(type, h, p) {
  const pressed = type === 'pointerdown' || (type === 'pointermove' && h.down);
  cv.dispatchEvent(new PointerEvent(type, {
    pointerId: h.pid, pointerType: 'touch', isPrimary: h === hands[0], clientX: p[0], clientY: p[1],
    button: 0, buttons: pressed ? 1 : 0, bubbles: type !== 'pointerleave', cancelable: true,
  }));
}
function wheel(p, zoom) {
  cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -Math.log(zoom) / WHEEL_RATE, deltaMode: 0, clientX: p[0], clientY: p[1], bubbles: true, cancelable: true }));
}
// The hand-control buttons sit over the map, so a hand pointer over one is over it and not the map, as a mouse would be.
function uiAt(p) {
  const el = document.elementFromPoint(Math.min(p[0], W - 1), Math.min(p[1], H - 1));
  return el && ui.root.contains(el) ? el.closest('button') : null;
}
let overBtn = null; // the button the leading hand is over, lit like a mouse's hover
function overButton(b) {
  if (b === overBtn) return;
  if (overBtn) overBtn.classList.remove('hand-over');
  if (b) b.classList.add('hand-over');
  overBtn = b;
}

// ---------- Seeing ----------
class OneEuro { // steady while the hand is still, quick while it moves
  constructor(minCut, beta) { this.minCut = minCut; this.beta = beta; this.x = null; }
  at(v, t) {
    if (this.x === null) { this.x = v; this.dx = 0; this.t = t; return v; }
    const dt = Math.max(1e-3, (t - this.t) / 1000), a = cut => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
    this.t = t;
    this.dx += ((v - this.x) / dt - this.dx) * a(1);
    this.x += (v - this.x) * a(this.minCut + this.beta * Math.abs(this.dx));
    return this.x;
  }
}
let running = false, session = 0, video = null, still = null, stream = null, loading = null, landmarker = null;
let hands = [], nextPid = PID, pair = null, rafId = 0, lastT = 0, lastStamp = 0, since = 0, outAt = -1e9;
let W = innerWidth, H = innerHeight;
addEventListener('resize', () => { W = innerWidth; H = innerHeight; });

function srcSize() {
  if (video) return [video.videoWidth || 640, video.videoHeight || 480];
  if (still) return [still.naturalWidth, still.naturalHeight];
  return [640, 480];
}
// The reach: a window-shaped box in the picture, in picture fractions; the hand's place in it is the pointer's place.
function reach() {
  const [vw, vh] = srcSize();
  let bw = REACH * vw, bh = bw * H / W;
  if (bh > 0.86 * vh) { bh = 0.86 * vh; bw = bh * W / H; }
  const cy = Math.min(Math.max(REACH_CY * vh, bh / 2), vh - bh / 2);
  return { x0: 0.5 - bw / vw / 2, x1: 0.5 + bw / vw / 2, y0: (cy - bh / 2) / vh, y1: (cy + bh / 2) / vh };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function toScreen(c) { // mirrored, as in a mirror: move the hand right and the pointer goes right
  const r = reach();
  return [clamp((1 - c[0] - r.x0) / (r.x1 - r.x0), 0, 1) * W, clamp((c[1] - r.y0) / (r.y1 - r.y0), 0, 1) * H];
}
// The palm's middle and size come from the wrist and knuckles, which stay put while fingers pinch or close.
const PALM = [0, 5, 9, 13, 17];
const palmCentre = lm => [PALM.reduce((s, i) => s + lm[i].x, 0) / 5, PALM.reduce((s, i) => s + lm[i].y, 0) / 5];
function palmSize(lm) {
  const [vw, vh] = srcSize(), d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * vw, (lm[a].y - lm[b].y) * vh);
  return (d(0, 5) + d(5, 17) + d(17, 0)) / 3;
}
// Shapes are read in the picture's own 3D (the tracker's depth is on the width's scale): its "world" 3D misjudged
// depth enough to call a closed OK sign open.
function shapeOf(h, lm) {
  const [vw, vh] = srcSize(), d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * vw, (lm[a].y - lm[b].y) * vh, (lm[a].z - lm[b].z) * vw);
  const curled = [[8, 5], [12, 9], [16, 13], [20, 17]].filter(([tip, knuckle]) => d(tip, 0) < CURL * d(knuckle, 0)).length;
  if (curled === 4 || (h.state === 'fist' && curled === 3)) return 'fist'; // a zooming fist holds through one finger's flicker
  const out = d(4, 20) / d(0, 9), up = (tip, knuckle) => d(tip, 0) > CURL * d(knuckle, 0);
  if (h.state === 'out' ? out < PINKY_OFF : out < PINKY_ON && up(8, 5) && up(12, 9)) return 'out'; // index and middle stay up
  const pinch = d(4, 8) / d(0, 9);
  if (h.state === 'pinch' ? pinch < PINCH_OFF : pinch < PINCH_ON && d(8, 0) > 1.1 * d(5, 0)) return 'pinch';
  return 'open';
}

// One look at the camera: match what it saw to the hands already followed, nearest palm first.
function see(res, t = performance.now()) {
  if (!running) return; // a look already on its way when Stop was pressed
  const found = (res.landmarks || []).map(lm => ({ lm, c: palmCentre(lm) }));
  const unseen = new Set(hands);
  for (const f of found) {
    let best = null, bd = 0.2;
    for (const h of unseen) { const d = Math.hypot(h.c[0] - f.c[0], h.c[1] - f.c[1]); if (d < bd) { bd = d; best = h; } }
    if (best) { unseen.delete(best); look(best, f, t); }
    else if (hands.length < 2) hands.push(meet(f, t));
  }
  for (const h of unseen) if (t - h.seen > LOST_AFTER) lose(h);
  if (found.length) since = t;
  if (landmarker || TEST_SRC === 'none') say(found.length || t - since < 1500 ? '' : 'Hold a hand up to the camera');
  if (!ui.panel.hidden) drawView();
}
function meet(f, t) {
  const h = { pid: nextPid++, found: t, state: 'open', cand: 'open', candN: 0, down: false, press: null,
    fx: new OneEuro(1.5, 0.015), fy: new OneEuro(1.5, 0.015), fs: new OneEuro(1, 0.05) };
  look(h, f, t);
  h.pos = h.target.slice();
  h.el = document.createElement('div');
  h.el.className = 'hand-cursor';
  h.el.innerHTML = '<i></i>';
  document.body.appendChild(h.el);
  return h;
}
function look(h, f, t) {
  h.seen = t; h.c = f.c; h.lm = f.lm;
  const [x, y] = toScreen(f.c);
  h.target = [h.fx.at(x, t), h.fy.at(y, t)];
  const size = h.fs.at(palmSize(f.lm), t);
  if (h.zoom) { // past the band, a change in a fist's size is a zoom, applied over the next few frames
    const ref = size > h.zoom.ref * (1 + FIST_BAND) ? size / (1 + FIST_BAND) : size < h.zoom.ref / (1 + FIST_BAND) ? size * (1 + FIST_BAND) : h.zoom.ref;
    h.zoom.owed += FIST_GAIN * Math.log(ref / h.zoom.ref);
    h.zoom.ref = ref;
  }
  h.size = size;
  const want = shapeOf(h, f.lm);
  if (want === h.cand) h.candN++; else { h.cand = want; h.candN = 1; }
  if (h.cand !== h.state && h.candN >= HOLD[want] && t - h.found >= SETTLE_MS) become(h, want);
}
// A pinch from an open hand presses. A fist zooms where it closed, from its size then; a pinch that closes into a fist
// lets go without clicking, and a fist that opens through a pinch presses nothing, so neither is ever a click. Pinky to
// thumb lets go of anything held, without clicking, and goes out one level.
function become(h, shape) {
  const from = h.state;
  h.state = shape;
  if (shape === 'out') {
    h.press = null; h.zoom = null;
    if (h.down) { send('pointercancel', h, h.sent); h.down = false; }
    outAt = performance.now();
    if (window.__map && window.__map.upOne) window.__map.upOne();
    return;
  }
  if (shape === 'fist') {
    h.press = null;
    if (h.down) { send('pointercancel', h, h.sent); h.down = false; } // the map clicks on an up, never a cancel
    if (!hands.some(o => o.down) && !uiAt(h.pos)) h.zoom = { at: h.pos.slice(), ref: h.size, owed: 0, t: 0 };
    return;
  }
  h.zoom = null;
  if (shape === 'open') release(h);
  else if (from === 'open' && !hands.some(o => o.zoom)) press(h);
}
function press(h) {
  const r = reach(), dead = clamp(DEAD * h.size * W / ((r.x1 - r.x0) * srcSize()[0]), 20, 70), btn = uiAt(h.pos);
  if (btn) { h.press = { el: btn, at: h.pos.slice(), dead }; return; }
  h.down = true; h.free = false; h.downAt = h.pos.slice(); h.sent = h.pos.slice(); h.off = [0, 0]; h.dead = dead;
  send('pointerdown', h, h.sent);
}
function release(h) {
  if (h.down) { send('pointerup', h, h.sent); h.down = false; }
  if (h.press) { const el = h.press.el; h.press = null; setTimeout(() => el.click()); } // after this look at the camera is done: Stop ends it
}
function lose(h) {
  if (h.down) send('pointercancel', h, h.sent);
  else if (h === hands[0]) send('pointerleave', h, h.pos);
  h.press = null;
  h.el.remove();
  hands = hands.filter(o => o !== h);
}

// ---------- Every frame: glide, press, show ----------
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(64, now - (lastT || now)), k = 1 - Math.exp(-dt / EASE_MS), decay = Math.exp(-dt / CATCH_MS);
  lastT = now;
  for (const h of hands) { h.pos[0] += (h.target[0] - h.pos[0]) * k; h.pos[1] += (h.target[1] - h.pos[1]) * k; }
  for (const h of hands) { // a pinch that slides off a button lets it go unpressed, as a mouse does
    if (h.press && Math.hypot(h.pos[0] - h.press.at[0], h.pos[1] - h.press.at[1]) > h.press.dead) h.press = null;
  }
  const pressed = hands.filter(h => h.down), at = new Map();
  for (const h of pressed) {
    // a pinch stays where it closed until the hand moves off, so a pinch and let go is a click
    if (!h.free && (pressed.length > 1 || Math.hypot(h.pos[0] - h.downAt[0], h.pos[1] - h.downAt[1]) > h.dead)) {
      h.free = true; h.off = [h.sent[0] - h.pos[0], h.sent[1] - h.pos[1]];
    }
    if (h.free) { h.off[0] *= decay; h.off[1] *= decay; }
    h.show = h.free ? [h.pos[0] + h.off[0], h.pos[1] + h.off[1]] : h.downAt;
    at.set(h, h.show);
  }
  if (pressed.length === 2) { // spread the two pointers a little further than the hands, so one stretch zooms further
    const [a, b] = pressed, pa = at.get(a), pb = at.get(b);
    const d = Math.max(1, Math.hypot(pa[0] - pb[0], pa[1] - pb[1])), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    if (!pair || pair.a !== a || pair.b !== b) pair = { a, b, d0: d };
    const f = Math.pow(d / pair.d0, STRETCH - 1);
    for (const [h, p] of [[a, pa], [b, pb]]) at.set(h, [mx + (p[0] - mx) * f, my + (p[1] - my) * f]);
  } else pair = null;
  for (const h of pressed) {
    const p = at.get(h);
    if (Math.abs(p[0] - h.sent[0]) + Math.abs(p[1] - h.sent[1]) > 0.2) { h.sent = p; send('pointermove', h, p); }
  }
  const fister = hands.find(h => h.zoom);
  if (fister && !pressed.length && Math.abs(fister.zoom.owed) > 1e-4) {
    const step = fister.zoom.owed * (1 - Math.exp(-dt / 60));
    fister.zoom.owed -= step;
    wheel(fister.zoom.at, Math.exp(step));
  }
  const lead = hands[0], wasOver = overBtn;
  overButton(!lead || lead.down || lead.zoom ? null : lead.press ? lead.press.el : uiAt(lead.pos));
  if (overBtn && !wasOver) send('pointerleave', lead, lead.pos);
  if (lead && !pressed.length && !lead.zoom && !overBtn && (!lead.hov || Math.abs(lead.pos[0] - lead.hov[0]) + Math.abs(lead.pos[1] - lead.hov[1]) > 0.5)) {
    lead.hov = lead.pos.slice(); send('pointermove', lead, lead.pos);
  }
  for (const h of hands) {
    const p = h.down ? h.show : h.press ? h.press.at : h.zoom ? h.zoom.at : h.pos, look = h.down ? 'pinch' : h.state;
    h.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`;
    const over = h === lead && look === 'open' && (overBtn || cv.classList.contains('over')); // the map marks what it lit
    const cls = `hand-cursor ${look}${over ? ' over' : ''}${h === lead ? '' : ' second'}`;
    if (h.el.className !== cls) h.el.className = cls;
  }
  light(!lead ? null : now - outAt < 700 ? 'out' : pressed.length === 2 ? 'stretch' : pressed.length ? (pressed[0].free ? 'drag' : 'click')
    : hands.some(h => h.press) ? 'click' : fister ? 'fist' : 'open');
}

// ---------- The camera picture, with the hands drawn on it and the reach marked ----------
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
function sizeView() {
  const [vw, vh] = srcSize();
  ui.view.height = Math.round(ui.view.width * vh / vw);
}
function drawView() {
  const g = ui.view.getContext('2d'), w = ui.view.width, h = ui.view.height, src = video || still;
  if (src) { g.setTransform(-1, 0, 0, 1, w, 0); g.drawImage(src, 0, 0, w, h); g.setTransform(1, 0, 0, 1, 0, 0); }
  else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  const r = reach();
  g.strokeStyle = 'rgba(255, 255, 255, .55)'; g.lineWidth = 2; g.setLineDash([8, 6]);
  g.strokeRect(r.x0 * w, r.y0 * h, (r.x1 - r.x0) * w, (r.y1 - r.y0) * h);
  g.setLineDash([]);
  const now = performance.now();
  for (const hand of hands) {
    if (now - hand.seen > 120) continue;
    const pt = i => [(1 - hand.lm[i].x) * w, hand.lm[i].y * h];
    g.strokeStyle = hand.down ? '#86B2E3' : hand.zoom ? '#F08A5D' : '#fff'; g.lineWidth = 3;
    g.beginPath();
    for (const [a, b] of BONES) { g.moveTo(...pt(a)); g.lineTo(...pt(b)); }
    g.stroke();
  }
}

// ---------- On and off ----------
function loadTracker() {
  if (!loading) loading = (async () => {
    const { FilesetResolver, HandLandmarker } = await import(VISION + '/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks(VISION + '/wasm');
    const opts = delegate => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
    try { return await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch (e) { console.warn('hand control: no GPU, using the CPU', e); return HandLandmarker.createFromOptions(files, opts('CPU')); }
  })().catch(e => { loading = null; throw e; });
  return loading;
}
async function openSource() {
  if (TEST_SRC === 'none') return;
  if (TEST_SRC && /\.(jpe?g|png|webp)(\?|$)/i.test(TEST_SRC)) {
    still = new Image(); still.crossOrigin = 'anonymous'; still.src = TEST_SRC;
    await still.decode();
    return;
  }
  video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  if (TEST_SRC) { video.crossOrigin = 'anonymous'; video.loop = true; video.src = TEST_SRC; }
  else {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
  }
  await video.play();
}
function cameraTrouble(e) {
  if (!navigator.mediaDevices) return 'This page can only use the camera from localhost, https or a file on this computer.';
  if (e && e.name === 'NotAllowedError') return 'The camera is blocked for this page. Allow it by the address bar, then try again.';
  if (e && e.name === 'NotFoundError') return 'No camera found.';
  return 'The camera did not start' + (e && e.message ? ': ' + e.message : '.');
}
async function start() {
  if (running) return;
  running = true; remember(true);
  const me = ++session;
  ui.button.textContent = 'Stop hand control'; openWindow(!closed);
  say('Starting the camera…');
  const tracker = TEST_SRC === 'none' ? null : loadTracker(); // loads while the camera starts
  try { await openSource(); }
  catch (e) { if (me === session) { stop(); ui.panel.hidden = false; say(cameraTrouble(e)); } return; }
  if (me !== session) return;
  sizeView(); drawView();
  rafId = requestAnimationFrame(frame);
  if (!tracker) { say(''); return; }
  say(landmarker ? '' : 'Loading the hand tracker…');
  try { landmarker = await tracker; }
  catch (e) { console.warn('hand control: the tracker did not load', e); if (me === session) { ui.panel.hidden = false; say('The hand tracker did not load. It needs the internet.'); } return; }
  if (me !== session) return;
  since = performance.now(); say('');
  watch(me);
}
function watch(me) { // a look at every new camera frame
  if (me !== session) return;
  const src = video || still;
  if (video && video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => { detect(me); watch(me); });
  else setTimeout(() => { detect(me); watch(me); }, 33);
  function detect() {
    if (me !== session) return;
    let t = performance.now();
    if (t <= lastStamp) t = lastStamp + 1;
    lastStamp = t;
    try { see(landmarker.detectForVideo(src, t), t); } catch (e) { console.warn('hand control:', e); }
  }
}
function stop() {
  running = false; session++; remember(false);
  for (const h of [...hands]) lose(h);
  pair = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (video) { video.pause(); video.srcObject = null; video.removeAttribute('src'); }
  stream = video = still = null;
  cancelAnimationFrame(rafId); rafId = 0; lastT = 0;
  light(null); overButton(null);
  ui.panel.hidden = true; ui.show.hidden = true; ui.button.textContent = 'Hand control';
}
// The camera window opens and closes while the hands keep working; a closed one is remembered closed.
function openWindow(open) {
  closed = !open;
  try { localStorage.setItem('hand-control-window', open ? 'open' : 'closed'); } catch (e) { /* private window */ }
  ui.panel.hidden = !open; ui.show.hidden = open;
  if (open) drawView();
}
function remember(on) { try { localStorage.setItem('hand-control', on ? '1' : '0'); } catch (e) { /* private window */ } }
let wasOn = false, closed = false;
try { wasOn = localStorage.getItem('hand-control') === '1'; closed = localStorage.getItem('hand-control-window') === 'closed'; } catch (e) { /* private window */ }
if (wasOn || params.has('handsrc')) start();

window.__hands = { see, start, stop, get hands() { return hands; }, get running() { return running; }, reach, toScreen, srcSize };
})();
