/* The town as a quiet map: flat, or in 2.5D (seen in perspective, with the houses standing).
   Grey ground, river, streets and houses under a survey grid; the only colour is on
   the three places that hold stories. The spirit of stories follows the pointer.

   Moving over a place opens a small preview that plays its stories.
   Clicking a place opens a panel with its stories; the map stays on screen.

   Places and stories live in stories.js (window.SHOPS, window.SPONSORS). */
(() => {
'use strict';

const SHOPS = window.SHOPS, SPONSORS = window.SPONSORS || [];
const MEDIA = { cinema: 'video', vinyl: 'audio', books: 'text' };
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const forcedLayout = params.get('layout');                     // ?layout=tall or ?layout=wide
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHEET = matchMedia('(max-width: 720px), (max-width: 900px) and (orientation: portrait)');   // stories open as a sheet from below
const HOVER = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = n => Math.round(n * 10) / 10;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* tiny element builder: h('p', { class: 'meta', text: 'hi' }, child, child) */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return el;
}

/* ───────────── Two layouts of the same town ─────────────
   wide: screens that are wider than tall.   tall: phones and tablets held upright.
   cols / rows are the street lines; the houses fill the blocks between them. */
const LAYOUTS = {
  wide: {
    w: 1600, h: 1000, u: 1, text: 13,
    cols: [110, 300, 520, 800, 1080, 1300, 1490], rows: [290, 380, 500, 640],
    main: 500,
    lanes: [[300, 380, 1300, 380], [110, 640, 1490, 640], [300, 380, 300, 640], [520, 290, 520, 640], [1080, 290, 1080, 640], [1300, 380, 1300, 640]],
    bridge: 800, bridgeFrom: 380, river: [700, 860],
    hill: [800, 165, 70, 28], castle: [800, 150, 1],
    square: [3, 2],
    places: { books: [345, 398, 130, 84], cinema: [585, 524, 150, 96], vinyl: [1128, 398, 124, 84] },
    boat: [200, 62], boats: [[45, 742], [290, 768], [535, 742], [865, 768], [1110, 742], [1355, 768]],
    start: [800, 580],
  },
  tall: {
    w: 900, h: 1500, u: 1.3, text: 24,
    cols: [50, 220, 450, 680, 850], rows: [420, 500, 640, 800, 980],
    main: 640,
    lanes: [[220, 500, 680, 500], [50, 800, 850, 800], [50, 980, 850, 980], [220, 500, 220, 980], [680, 500, 680, 980]],
    bridge: 450, bridgeFrom: 500, river: [1040, 1330],
    hill: [450, 250, 62, 32], castle: [450, 235, 1.3],
    square: [2, 3],
    places: { books: [262, 524, 150, 92], cinema: [512, 676, 150, 96], vinyl: [250, 846, 150, 92] },
    boat: [320, 76], boats: [[50, 1062], [510, 1062], [70, 1146], [490, 1146], [50, 1230], [510, 1230]],
    start: [450, 730],
  },
};
const wantTall = () => forcedLayout ? forcedLayout === 'tall' : innerWidth / innerHeight < .8;
let tall = wantTall(), L = LAYOUTS[tall ? 'tall' : 'wide'];

/* ───────────── Drawing the map (one SVG) ─────────────
   Everything is kept as points in map units and drawn through P(). P() is either the flat map,
   or a camera that looks at the town from the south and leans back, so one drawing gives both views. */
const svg = $('map'), NS = 'http://www.w3.org/2000/svg';
const panel = $('stories'), tagsEl = $('tags');
let world, trailEl, layers = {}, items = [], shown = null;
let cam = { s: 1, x: 0, y: 0 }, camFrom = null, camTo = null, camT = 0;
let openId = null;       // the place whose stories are showing in the panel
/* 2.5D view: 0 is the flat map, 1 is the town standing up, seen in perspective (see "2.5D" further down) */
let depth = 0, depthFrom = 0, depthTo = 0, depthT = 1;
let view = null;                                 // the leaning camera, set by setView()
const TILT = 52 * Math.PI / 180;                 // how far the camera leans back
const placeH = () => 34 * L.u;                   // how tall the places with stories stand

function S(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/* A point of the map (h = its height above the ground) → where it is drawn.
   Also the length of one map unit there, across (w) and into the distance (v), and how much it leans (sk). */
function P(x, y, h = 0) {
  if (!depth) return { x, y, w: 1, v: 1, sk: 0 };            // flat: map units; the camera is one transform on #world
  const c = view, ks = c.k * cam.s;
  y = Math.min(y, L.h + 700);                                 // nothing may end up behind the camera
  const X = (cam.x + x * cam.s - c.ox) * c.k, Y = (cam.y + y * cam.s - c.oy) * c.k, Z = h * ks * depth;
  const w = c.d / (c.d - Math.min(Y * c.sin + Z * c.cos, c.d * .85)), yy = Y * c.cos - Z * c.sin;
  return { x: c.ox + X * w, y: c.oy + c.ty + yy * w, w: w * ks, v: w * ks * (c.cos + yy * w * c.sin / c.d), sk: X * w * w * ks * c.sin / c.d };
}
/* the leaning camera: it turns the map about a line across the town and looks from a distance d */
function setView() {
  const a = TILT * depth, c = view = { sin: Math.sin(a), cos: Math.cos(a), d: 1.15 * Math.max(innerWidth, innerHeight), k: 1, ty: 0,
    ox: cam.x + L.w / 2 * cam.s, oy: cam.y + L.h * .55 * cam.s };
  /* keep the leaning town as wide as the flat one (wider where the screen has room) and in the same spot */
  const flat = L.w * cam.s / 2, room = (innerWidth - panelSpace()) / 2 - 10, half = flat + Math.max(0, room - flat) * depth;
  for (let i = 0; i < 5; i++) c.k *= half / (P(L.w, L.river[1]).x - c.ox);      // the river bank spans the screen
  const high = P(L.w / 2, L.h).y - P(L.w / 2, 0).y;
  if (high > L.h * cam.s) c.k *= L.h * cam.s / high;
  c.ty = cam.y + L.h * cam.s * .5 - (P(L.w / 2, 0).y + P(L.w / 2, L.h).y) / 2;
}
const toScreen = (x, y, h = 0) => depth ? P(x, y, h) : { x: cam.x + x * cam.s, y: cam.y + y * cam.s, w: cam.s };
const toMap = (sx, sy) => {
  if (!depth) return { x: (sx - cam.x) / cam.s, y: (sy - cam.y) / cam.s };
  const c = view, a = sy - c.oy - c.ty, Y = a * c.d / Math.max(c.d * c.cos + a * c.sin, 1), X = (sx - c.ox) * (c.d - Y * c.sin) / c.d;
  return { x: (c.ox + X / c.k - cam.x) / cam.s, y: (c.oy + Y / c.k - cam.y) / cam.s };
};
/* outline through points [x, y, height] */
const trace = (pts, closed = true) => {
  let d = '';
  for (const q of pts) { const p = P(q[0], q[1], q[2] || 0); d += (d ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }
  return closed ? d + 'Z' : d;
};
/* something small that was drawn in map units (a name, a boat, an icon): lay it on the ground at (x, y) */
function lay(el, x, y, h = 0) {
  if (!depth) { el.removeAttribute('transform'); return; }
  const p = P(x, y, h), n = v => v.toFixed(5);
  el.setAttribute('transform', `matrix(${n(p.w)} 0 ${n(p.sk)} ${n(p.v)} ${f(p.x - p.w * x - p.sk * y)} ${f(p.y - p.v * y)})`);
}
const quad = (x, y, w, d, h = 0) => [[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]];
const rounded = (x, y, w, d, rx) => {
  const out = [];
  for (const [ax, ay, a0] of [[x + w - rx, y + rx, -90], [x + w - rx, y + d - rx, 0], [x + rx, y + d - rx, 90], [x + rx, y + rx, 180]])
    for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * Math.PI / 180; out.push([ax + Math.cos(a) * rx, ay + Math.sin(a) * rx]); }
  return out;
};
const curve = (a, b, c, e) => {
  const out = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, m = 1 - t; out.push([0, 1].map(j => m * m * m * a[j] + 3 * m * m * t * b[j] + 3 * m * t * t * c[j] + t * t * t * e[j])); }
  return out;
};
/* the outline around a set of drawn points */
function hull(p) {
  p = p.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && turn(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function project() { for (const draw of items) draw(); }

function drawMap() {
  const r = rng(11), rh = rng(29), u = L.u, mid = L.w / 2;
  const X0 = -3500, X1 = L.w + 3500, Y0 = -4500, Y1 = L.h + 2500;
  const [ry0, ry1] = L.river, [hx, hy, hrx, hry] = L.hill, [cx, cy, cs] = L.castle;
  items = []; shown = null;
  world = S('g', { id: 'world' });
  const layer = cls => { const g = S('g', cls ? { class: cls } : {}); world.append(g); return g; };
  /* from the ground up. The survey grid lies over the houses on the flat map and under them in 2.5D (applyCam moves it). */
  const ground = layer(), grid = layer(), standing = layer(), names = layer('name'), boats = layer();
  trailEl = S('polyline', { id: 'trail', class: 'trail', points: '' });     // where the spirit has just been
  world.append(trailEl);
  const places = layer();
  layers = { grid, standing, names };
  names.setAttribute('font-size', L.text);

  const shape = (parent, cls, pts, closed = true) => {
    const el = S('path', { class: cls });
    parent.append(el);
    items.push(() => el.setAttribute('d', trace(pts, closed)));
    return el;
  };
  const disc = (parent, cls, x, y, rad, h = 0, ball = false) => {
    const el = S('ellipse', { class: cls });
    if (parent) parent.append(el);
    items.push(() => { const p = P(x, y, h); el.setAttribute('cx', f(p.x)); el.setAttribute('cy', f(p.y)); el.setAttribute('rx', f(rad * p.w)); el.setAttribute('ry', f(rad * (ball ? p.w : p.v))); });
    return el;
  };
  const label = (parent, text, x, y, anchor) => {
    const el = S('text', { x: f(x), y: f(y) });
    if (anchor) el.setAttribute('text-anchor', anchor);
    el.textContent = text;
    parent.append(el);
    items.push(() => lay(el, x, y));
  };

  /* Things that stand up in 2.5D. They are drawn from the back of the town to the front, and in each
     row from the edges towards the middle, so that nearer ones cover the ones behind them. */
  const ups = [];
  const stand = (key, x, el) => { ups.push([key, -Math.abs(x - mid), el]); return el; };
  const box = (cls, x, y, w, d, H, key = y + d) => {
    const g = stand(key, x + w / 2, S('g', { class: 'bx ' + cls })), e = x + w / 2 < mid ? x + w : x;      // e: the side that faces the middle
    shape(g, 'side', [[e, y, 0], [e, y + d, 0], [e, y + d, H], [e, y, H]]);
    shape(g, 'wall', [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, H], [x, y + d, H]]);
    shape(g, 'roof', quad(x, y, w, d, H));
  };
  const drum = (x, y, rad, h0, h1, key = y + rad) => {
    const g = stand(key, x, S('g', { class: 'bx landmark' }));
    disc(g, 'base', x, y, rad, h0);
    shape(g, 'wall', [[x - rad, y, h0], [x + rad, y, h0], [x + rad, y, h1], [x - rad, y, h1]]);
    disc(g, 'roof', x, y, rad, h1);
  };
  const tree = (x, y, rad) => {
    disc(ground, 'shade', x, y, rad);
    stand(y + rad, x, disc(null, 'wood', x, y, rad, rad + 5 * u, true));
  };

  /* the castle hill: height lines and woods */
  for (let k = 5; k >= 1; k--) {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, m = 1 + .06 * Math.sin(3 * a + k) + .04 * Math.sin(5 * a + 2 * k);
      pts.push([hx + Math.cos(a) * (40 + k * hrx) * m, hy + Math.sin(a) * (24 + k * hry) * m]);
    }
    shape(ground, 'contour', pts);
  }
  for (let i = 0; i < 170; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()), x = hx + Math.cos(a) * d * (40 + 5.3 * hrx), y = hy + Math.sin(a) * d * (24 + 5.3 * hry), rad = (6 + r() * 5) * u;
    if (y > L.rows[0] - 16 || (Math.abs(x - cx) < 112 * cs && y > cy - 54 * cs && y < cy + 68 * cs) || (Math.abs(x - cx) < 36 * u && y > cy)) continue;
    tree(x, y, rad);
  }

  /* river */
  const top = x => ry0 + 14 * Math.sin(x / 260), bot = x => ry1 + 10 * Math.sin(x / 300 + 1);
  const bank = [];
  for (let x = X0; x <= X1; x += 50) bank.push([x, top(x)]);
  for (let x = X1; x >= X0; x -= 50) bank.push([x, bot(x)]);
  shape(ground, 'river', bank);
  for (const t of [.25, .5, .75]) {
    const pts = [];
    for (let x = X0; x <= X1; x += 50) pts.push([x, top(x) + (bot(x) - top(x)) * t]);
    shape(ground, 'flow', pts, false);
  }

  /* streets */
  const road = (x1, y1, x2, y2, w) => shape(ground, 'road', x1 === x2 ? quad(x1 - w / 2, y1, w, y2 - y1) : quad(x1, y1 - w / 2, x2 - x1, w));
  const south = ry1 + 45;
  road(X0, L.main, X1, L.main, 20); road(X0, south, X1, south, 16); road(L.bridge, L.bridgeFrom, L.bridge, ry0 - 10, 16); road(L.bridge, ry1 + 10, L.bridge, Y1, 16);
  for (const [x1, y1, x2, y2] of L.lanes) road(x1, y1, x2, y2, 15);
  const up = L.bridgeFrom - cy, bend = [cx + 6, cy + up * .78];
  shape(ground, 'trailway', curve([cx, cy + 46 * cs], [cx - 60, cy + up * .4], [cx + 70, cy + up * .55], bend)
    .concat(curve(bend, [2 * bend[0] - cx - 70, 2 * bend[1] - cy - up * .55], [L.bridge, L.bridgeFrom - 30], [L.bridge, L.bridgeFrom])), false);

  /* houses: a row along the top and the bottom of every block, a courtyard in between */
  const avoid = Object.values(L.places);
  const block = (x, y, w, hh, density) => {
    const deep = Math.min(hh / 2 - 3, 46);
    for (const upper of [true, false]) {
      let bx = x;
      while (bx < x + w - 14) {
        let bw = 24 + r() * 34;
        if (x + w - bx - bw < 16) bw = x + w - bx;
        const bd = deep * (.68 + r() * .32), by = upper ? y : y + hh - bd, shade = 1 + (r() * 3 | 0);
        if (r() < density && !avoid.some(a => bx < a[0] + a[2] + 12 && bx + bw > a[0] - 12 && by < a[1] + a[3] + 12 && by + bd > a[1] - 12))
          box('h' + shade, bx, by, bw - 3, bd, (16 + rh() * 24) * u, upper ? y + deep : y + hh);
        bx += bw;
      }
    }
  };
  const nc = L.cols.length - 1, nr = L.rows.length - 1;
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    if (i === L.square[0] && j === L.square[1]) continue;
    block(L.cols[i] + 12, L.rows[j] + 12, L.cols[i + 1] - L.cols[i] - 24, L.rows[j + 1] - L.rows[j] - 24, (j ? 1 : .6) * (i === 0 || i === nc - 1 ? .8 : 1));
  }
  for (let i = 0; i < nc; i++) block(L.cols[i] + 12, south + 20, L.cols[i + 1] - L.cols[i] - 24, 62, .55);

  /* market square with the church (nave, two arms, tower) and the fountain */
  const sx = L.cols[L.square[0]] + 12, sy = L.rows[L.square[1]] + 12, sw = L.cols[L.square[0] + 1] - L.cols[L.square[0]] - 24, sh = L.rows[L.square[1] + 1] - L.rows[L.square[1]] - 24;
  const chx = sx + sw * .34, chy = sy + sh * .42, fx = sx + sw * .76, fy = sy + sh * .52;
  shape(ground, 'plaza', rounded(sx, sy, sw, sh, 5));
  box('landmark', chx + 8, chy - 31, 26, 16, 34 * u);
  box('landmark', chx - 36, chy - 15, 80, 30, 34 * u);
  box('landmark', chx - 62, chy - 13, 26, 26, 58 * u, chy + 15.5);
  box('landmark', chx + 8, chy + 15, 26, 16, 34 * u);
  disc(ground, 'fountain', fx, fy, 12 * u); disc(ground, 'landmark', fx, fy, 3.5 * u);
  for (const [tx, ty] of [[.62, .2], [.9, .2], [.62, .84], [.9, .84]]) tree(sx + sw * tx, sy + sh * ty, 7 * u);
  const nameW = L.text * 9;
  for (let x = L.cols[0] + 10; x < L.cols[nc]; x += 30 * u) if (x < L.bridge - 34 || x > L.bridge + 34 + nameW) tree(x, L.rows[nr] + 26 * u, 6 * u);

  /* the old bridge */
  for (let i = 1; i <= 4; i++) shape(ground, 'landmark', quad(L.bridge - 19, ry0 + (ry1 - ry0) * i / 5 - 5, 38, 10));
  disc(ground, 'landmark', L.bridge - 15, ry0 - 16, 9); disc(ground, 'landmark', L.bridge + 15, ry0 - 16, 9);
  shape(ground, 'deck', quad(L.bridge - 10, ry0 - 24, 20, ry1 - ry0 + 48));

  /* the castle: four wings and three towers. A tower rises through the roof of its wing:
     its lower part is drawn before the wings and its upper part after them. */
  const wing = (x, y, w, hh) => box('landmark', cx + x * cs, cy + y * cs, w * cs, hh * cs, 32 * cs);
  const tower = (x, y, rad, low, high) => {
    drum(cx + x * cs, cy + y * cs, rad * cs, 0, 32 * cs, low);
    drum(cx + x * cs, cy + y * cs, rad * cs, 32 * cs, 54 * cs, high);
  };
  wing(-80, -28, 160, 22); wing(-80, -6, 24, 46); wing(56, -6, 24, 46); wing(-56, 22, 38, 18);
  tower(-80, -28, 14, cy - 14 * cs, cy + 41 * cs); tower(80, -28, 14, cy - 14 * cs, cy + 41 * cs); tower(80, 42, 17, cy + 59 * cs, cy + 59.5 * cs);

  /* survey grid, with a letter for every column and a number for every row */
  const lines = (cls, segs) => {
    const el = S('path', { class: cls });
    grid.append(el);
    items.push(() => {
      let d = '';
      for (const [x1, y1, x2, y2] of segs) { const a = P(x1, y1), b = P(x2, y2); d += 'M' + f(a.x) + ' ' + f(a.y) + 'L' + f(b.x) + ' ' + f(b.y); }
      el.setAttribute('d', d);
    });
  };
  const mesh = [], ticks = [];
  for (let x = Math.ceil(X0 / 100) * 100; x <= X1; x += 100) mesh.push([x, Y0, x, Y1]);
  for (let y = Math.ceil(Y0 / 100) * 100; y <= Y1; y += 100) mesh.push([X0, y, X1, y]);
  for (let x = 0; x <= L.w; x += 100) for (let y = 0; y <= L.h; y += 100) ticks.push([x - 5, y, x + 5, y], [x, y - 5, x, y + 5]);
  lines('grid', mesh); lines('grid tick', ticks);
  const refs = S('g', { class: 'ref', 'font-size': f(L.text * .85) });
  grid.append(refs);
  for (let i = 0; i < L.w / 100; i++) label(refs, String.fromCharCode(65 + i), i * 100 + 50, L.h - 9 * u, 'middle');
  for (let j = 0; j < L.h / 100; j++) label(refs, j + 1, 9 * u, j * 100 + 50 + L.text * .3);

  /* names on the map */
  label(names, 'SCHLOSS', cx + 108 * cs, cy + 6 * cs);
  label(names, 'MARKTPLATZ', sx + sw * .76, sy + sh - 9 * u, 'middle');
  label(names, 'ALTE BRÜCKE', L.bridge + 34, ry0 - 12 * u);

  /* partner boats: the hull is the sign, the logo links to the partner */
  SPONSORS.slice(0, L.boats.length).forEach((sp, i) => {
    const [x, y] = L.boats[i], [bw, bh] = L.boat, n = bh * .56;
    const a = S('a', { class: 'boat', href: sp.url, target: '_blank', rel: 'noopener', 'data-role': sp.role, 'data-name': sp.name, 'aria-label': sp.role + ': ' + sp.name });
    a.innerHTML = `<g style="animation-delay:${-i * .8}s"><path class="wake" d="M${x - 10} ${f(y + bh * .32)}h${-f(bh * .5)}M${x - 10} ${f(y + bh * .68)}h${-f(bh * .85)}"/>
      <path class="hull" d="M${x + 12} ${y}H${f(x + bw - n)}L${x + bw} ${f(y + bh / 2)}L${f(x + bw - n)} ${y + bh}H${x + 12}Q${x} ${y + bh} ${x} ${y + bh - 12}V${y + 12}Q${x} ${y} ${x + 12} ${y}Z"/>
      <image href="${esc(sp.logo)}" x="${x + 14}" y="${y + 9}" width="${f(bw - n - 20)}" height="${bh - 18}" preserveAspectRatio="xMidYMid meet"/></g>`;
    boats.append(a);
    items.push(() => lay(a, x + bw / 2, y + bh / 2));
  });

  /* the three places with stories: the only colour on the map */
  SHOPS.forEach((s, i) => {
    const [x, y, w, hh] = L.places[s.id], gl = Math.min(w, hh) * .6, H = placeH();
    const foot = rounded(x, y, w, hh, 6), roof = foot.map(q => [q[0], q[1], H]);
    const g = S('g', { class: 'place', 'data-place': s.id, style: `--c:${s.accent}` });
    const wall = S('path', { class: 'pwall' }), ping = S('path', { class: 'ping', style: `animation-delay:${i * .9}s` }), body = S('path', { class: 'body' }), icon = S('g');
    icon.innerHTML = `<svg class="glyph" x="${f(x + (w - gl) / 2)}" y="${f(y + (hh - gl) / 2)}" width="${f(gl)}" height="${f(gl)}" viewBox="0 0 24 24">${window.shopIconInner(s.id)}</svg>`;
    g.append(wall, ping, body, icon);
    places.append(g);
    items.push(() => {
      const d = trace(roof);
      body.setAttribute('d', d); ping.setAttribute('d', d);
      lay(icon, x + w / 2, y + hh / 2, H);
      if (depth) wall.setAttribute('d', 'M' + hull(foot.concat(roof).map(q => P(q[0], q[1], q[2] || 0))).map(p => f(p.x) + ' ' + f(p.y)).join('L') + 'Z');
    });
  });

  ups.sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(q => standing.append(q[2]));
  svg.replaceChildren(world);
}

/* ───────────── Camera: fit the town into the free part of the screen ───────────── */
const panelSpace = () => openId && !SHEET.matches ? panel.offsetWidth + 24 : 0;

function camGoal() {
  const vw = innerWidth, vh = innerHeight;
  /* upright screens: keep the town clear of the menu at the top and of the legend (top, or along the bottom on phones) */
  const site = $('site').getBoundingClientRect(), legend = $('legend').getBoundingClientRect(), low = legend.top > vh / 2;
  const top = tall ? Math.max(site.bottom, low ? 0 : legend.bottom) + 8 : 0, bottom = tall && low ? vh - legend.top + 8 : 0;
  const fw = vw - panelSpace(), fh = vh - top - bottom;
  const s = Math.min(fw / L.w, fh / L.h);
  let x = (fw - L.w * s) / 2, y = top + (fh - L.h * s) / 2;
  if (openId && SHEET.matches) {                             // sheet from below: slide the place into what is left of the screen
    const [px, py, pw, ph] = L.places[openId], free = vh - panel.offsetHeight - 8;
    y = (top + free) / 2 + 24 - (py + ph / 2) * s;
    if (L.w * s > vw) x = clamp(vw / 2 - (px + pw / 2) * s, vw - L.w * s, 0);
  }
  return { s, x, y };
}
function applyCam() {
  const deep = depth > 0;
  if (deep) setView();
  if (deep !== shown) {                                      // between the flat map and 2.5D
    if (deep) world.removeAttribute('transform');
    world.insertBefore(layers.grid, deep ? layers.standing : layers.names);
  }
  if (deep) project();                                       // 2.5D: every point goes through the camera
  else {                                                     // flat: the drawing stays as it is, the camera is one transform
    world.setAttribute('transform', `translate(${f(cam.x)} ${f(cam.y)}) scale(${cam.s})`);
    if (shown !== false) project();
  }
  shown = deep;
  tagsEl.classList.toggle('short', cam.s < .72);
  tagsEl.classList.toggle('tiny', cam.s < .3);
  for (const s of SHOPS) {
    const [x, y, w] = L.places[s.id], p = toScreen(x + w / 2, y, placeH());
    tagEls[s.id].style.transform = `translate(${f(p.x)}px, ${f(p.y - 14)}px) translate(-50%, -100%)`;
  }
  placePeek();
}
function moveCam(instant) {
  const goal = camGoal();
  if (instant || REDUCED) { cam = goal; camTo = null; applyCam(); return; }
  camFrom = { ...cam }; camTo = goal; camT = 0;
}
/* where the spirit waits at a place: just beside it, so it does not stand on the icon */
const front = id => { const [x, y, w, hh] = L.places[id]; return { x: x + w + 28 / cam.s, y: y + hh }; };

/* ───────────── Words about a story ───────────── */
function fmtDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
const kindOf = (s, e) => MEDIA[s.id] === 'video' ? 'Video' : MEDIA[s.id] === 'audio' ? 'Audio' : e.type === 'photo' ? 'Photo essay' : 'Story';
const lengthOf = e => e.duration || e.readTime || (e.photos && e.photos.length ? `${e.photos.length} photos` : '');
const metaLine = (s, e) => [kindOf(s, e), lengthOf(e), fmtDate(e.date)].filter(Boolean).join(' · ');
const storyUrl = (s, e) => `store.html?shop=${s.id}&story=${encodeURIComponent(e.slug)}`;
const bg = src => `background-image:url("${encodeURI(src)}")`;
const isEmbed = src => /youtube\.com|youtu\.be|vimeo\.com/.test(src || '');
/* a clip that can play silently as a preview: the story's "preview" file, or its own video file.
   (YouTube and Vimeo links are not loaded until someone opens the story.) */
const clipOf = e => e.preview || (e.video && !isEmbed(e.video) ? e.video : '');
const count = s => `${s.entries.length} ${s.entries.length === 1 ? 'story' : 'stories'}`;
const shopOf = id => SHOPS.find(s => s.id === id);

function playClip(v) {
  if (REDUCED) return;
  if (!v.getAttribute('src')) v.src = v.dataset.src;
  v.muted = true;
  const p = v.play();
  if (p) p.then(() => v.classList.add('on')).catch(() => {});
}
function stopClip(v) { v.pause(); v.classList.remove('on'); }
function clipEl(src) {
  const v = h('video', { 'data-src': src, loop: true, playsinline: true, preload: 'none', tabindex: -1, 'aria-hidden': 'true' });
  v.muted = true; v.defaultMuted = true;
  /* a long film: start the preview a little way in, past the titles */
  v.addEventListener('loadedmetadata', () => { if (v.duration > 40) v.currentTime = Math.min(v.duration * .2, 30); }, { once: true });
  return v;
}

/* ───────────── Name tags on the map and the list of places ───────────── */
const tagEls = {}, stopEls = {};
function chip(s) { return h('span', { class: 'chip', html: window.shopIcon(s.id) }); }
for (const s of SHOPS) {
  const tag = h('button', { class: 'tag', type: 'button', 'data-place': s.id, style: `--c:${s.accent}`, 'aria-label': `${s.name}, ${s.kind}. ${s.action}` },
    chip(s), h('span', { class: 'txt' }, h('b', { class: 'nm', text: s.name }), h('b', { class: 'kd', text: s.kind }), h('small', { text: `${s.kind} · ${s.action}` })));
  tag.addEventListener('click', e => { openPlace(s.id, e.detail === 0); if (e.pointerType === 'touch') aim(front(s.id), SLOW); });
  tag.addEventListener('focus', () => { if (tag.matches(':focus-visible')) { setHot(s.id, 'focus'); aim(front(s.id), SLOW); } });
  tag.addEventListener('blur', () => { if (hotBy === 'focus') setHot(null); });
  tagsEl.append(tagEls[s.id] = tag);

  const stop = h('button', { class: 'stop', type: 'button', style: `--c:${s.accent}` },
    chip(s), h('span', { class: 'txt' }, h('b', { class: 'nm', text: s.name }), h('b', { class: 'kd', text: s.kind }), h('small', { text: `${s.kind} · ${s.action}` })));
  stop.addEventListener('click', e => { openPlace(s.id, e.detail === 0); aim(front(s.id), SLOW); });
  stop.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { setHot(s.id, 'list'); aim(front(s.id), SLOW); } });
  stop.addEventListener('pointerleave', () => { if (hotBy === 'list') setHot(null); });
  stop.addEventListener('focus', () => { if (stop.matches(':focus-visible')) { setHot(s.id, 'focus'); aim(front(s.id), SLOW); } });
  stop.addEventListener('blur', () => { if (hotBy === 'focus') setHot(null); });
  $('places').append(h('li', {}, stopEls[s.id] = stop));
}

/* ───────────── Looking at a place: the preview ───────────── */
const peek = $('peek');
let hot = null, hotBy = '', slides = [], slideAt = 0, slideTimer = 0;

function slidesFor(s) {
  const out = [];
  for (const e of s.entries) {
    const base = { title: e.title, meta: metaLine(s, e) };
    const photos = (e.photos || []).filter(p => p.src);
    if (clipOf(e)) out.push({ ...base, clip: clipOf(e), poster: e.poster });
    else if (e.poster) out.push({ ...base, img: e.poster, badge: true });
    else if (photos.length) photos.slice(0, 3).forEach(p => out.push({ ...base, img: p.src }));
    else if (MEDIA[s.id] === 'audio') out.push({ ...base, record: true });
    else if (MEDIA[s.id] === 'text') out.push({ ...base, words: (e.body && e.body[0]) || e.summary });
    else out.push({ ...base, card: true });
  }
  return out;
}
function showSlide(i) {
  clearTimeout(slideTimer);
  const s = shopOf(hot), sl = slides[slideAt = i % slides.length], media = peek.querySelector('.peek-media');
  let node, secs = 5;
  if (sl.clip) {
    node = clipEl(sl.clip);
    if (sl.poster) node.poster = sl.poster;
    node.classList.add('on'); playClip(node); secs = 6;
  } else if (sl.img) { node = h('div', { class: 'peek-img' + (sl.badge ? ' badge' : ''), style: bg(sl.img) }); secs = sl.badge ? 5 : 3.2; }
  else if (sl.record) node = h('div', { class: 'peek-record' }, h('span', { class: 'disc' }), h('span', { class: 'bars' }, h('i'), h('i'), h('i'), h('i'), h('i')));
  else if (sl.words) node = h('div', { class: 'peek-words' }, h('b', { text: sl.title }), h('p', { text: sl.words }));
  else node = h('div', { class: 'peek-card', html: window.shopIcon(s.id) });
  media.replaceChildren(node);
  peek.querySelector('.peek-kicker').textContent = `${s.name} · ${slideAt + 1} of ${slides.length}`;
  peek.querySelector('.peek-title').textContent = sl.title;
  peek.querySelector('.peek-meta').textContent = sl.meta;
  const bar = peek.querySelector('.peek-prog i');
  bar.style.animation = 'none';
  if (slides.length > 1 && !REDUCED) {
    void bar.offsetWidth;
    bar.style.animation = `prog ${secs}s linear forwards`;
    slideTimer = setTimeout(() => showSlide(slideAt + 1), secs * 1000);
  }
}
function setHot(id, by = '') {
  if (id === openId) id = null;                 // its stories are already open in the panel
  hotBy = id ? by : '';
  if (id === hot) return;
  hot = id;
  for (const s of SHOPS) {
    const on = s.id === id;
    tagEls[s.id].classList.toggle('hot', on); stopEls[s.id].classList.toggle('hot', on);
    world.querySelector(`[data-place="${s.id}"]`).classList.toggle('hot', on);
  }
  spirit.classList.toggle('curious', !!id);
  clearTimeout(slideTimer);
  if (!id) { peek.hidden = true; peek.querySelector('.peek-media').replaceChildren(); return; }
  const s = shopOf(id);
  slides = slidesFor(s);
  if (!slides.length) { peek.hidden = true; return; }
  peek.style.setProperty('--c', s.accent);
  peek.querySelector('.peek-go').textContent = `${HOVER.matches ? 'Click' : 'Tap'} to open · ${count(s)}`;
  peek.hidden = false;
  showSlide(0);
  placePeek();
}
function placePeek() {
  if (peek.hidden || !hot) return;
  /* beside, below or above the place: wherever it hides the least of the places and their name tags */
  const box = el => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const own = [box(world.querySelector(`[data-place="${hot}"] .body`)), box(tagEls[hot])];
  const rest = SHOPS.filter(s => s.id !== hot).flatMap(s => [box(world.querySelector(`[data-place="${s.id}"] .body`)), box(tagEls[s.id])]).concat([box($('legend')), box($('site'))]);
  const [l, t, r, b] = [Math.min(own[0][0], own[1][0]), own[1][1], Math.max(own[0][2], own[1][2]), own[0][3]];
  const W = peek.offsetWidth, H = peek.offsetHeight, vw = innerWidth - panelSpace(), vh = innerHeight;
  const cx = (own[0][0] + own[0][2]) / 2 - W / 2, cy = (own[0][1] + own[0][3]) / 2 - H / 2;
  const covered = (x, y, list) => list.reduce((sum, q) => sum + Math.max(0, Math.min(x + W, q[2]) - Math.max(x, q[0])) * Math.max(0, Math.min(y + H, q[3]) - Math.max(y, q[1])), 0);
  let best = null;
  for (const [x0, y0] of [[r + 16, cy], [l - 16 - W, cy], [cx, b + 14], [cx, t - 14 - H]]) {
    const x = clamp(x0, 12, Math.max(12, vw - W - 12)), y = clamp(y0, 12, Math.max(12, vh - H - 12));
    const cost = covered(x, y, own) * 20 + covered(x, y, rest);
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  peek.style.transform = `translate(${Math.round(best.x)}px, ${Math.round(best.y)}px)`;
}

/* ───────────── Going into a place: the panel with its stories ───────────── */
let carousel = 0, opener = null;      // opener: what had the keyboard focus when the panel was opened
function entryEl(s, e, i) {
  const media = MEDIA[s.id];
  const info = h('div', { class: 'info' }, h('p', { class: 'meta', text: metaLine(s, e) }), h('h3', { text: e.title }), h('p', { class: 'sum', text: e.summary }));
  let kids;
  if (media === 'video') {
    kids = [h('div', { class: 'thumb' + (e.poster ? '' : ' blank'), style: e.poster ? bg(e.poster) : null },
      clipOf(e) && clipEl(clipOf(e)), h('span', { class: 'badge', text: '▶' }), e.duration && h('span', { class: 'dur', text: e.duration })), info];
  } else if (media === 'audio') {
    const half = Math.ceil(s.entries.length / 2);
    kids = [h('span', { class: 'disc' }, h('i', { text: i < half ? `A${i + 1}` : `B${i - half + 1}` })), info];
  } else {
    const first = e.type === 'photo' && e.photos && e.photos.find(p => p.src);
    kids = [info, first && h('div', { class: 'thumb photo', style: bg(first.src) })];
  }
  const a = h('a', { class: 'entry ' + media, href: storyUrl(s, e) }, kids);
  const v = a.querySelector('video');
  if (v) {
    a.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'touch') playClip(v); });
    a.addEventListener('pointerleave', () => stopClip(v));
    a.addEventListener('focus', () => playClip(v));
    a.addEventListener('blur', () => stopClip(v));
  }
  return h('li', {}, a);
}
function openPlace(id, byKeyboard, instant) {
  const s = shopOf(id);
  if (!s) return;
  const was = openId;
  if (!was) opener = document.activeElement;
  openId = id;
  setHot(null);
  document.body.classList.add('used');
  panel.style.setProperty('--c', s.accent);
  const close = h('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×' });
  close.addEventListener('click', e => closePanel(e.detail === 0));
  panel.replaceChildren(
    h('header', { class: 'st-head' }, chip(s),
      h('div', {}, h('p', { class: 'kicker', text: `${s.kind} · ${s.stories}` }), h('h2', { id: 'st-name', text: s.name }), h('p', { class: 'tagline', text: s.tag })),
      close),
    h('div', { class: 'st-body' },
      h('p', { class: 'intro', text: s.intro }),
      h('p', { class: 'count', text: count(s) }),
      s.entries.length ? h('ol', { class: 'entries' }, s.entries.map((e, i) => entryEl(s, e, i))) : h('p', { class: 'none', text: 'Nothing here yet.' })));
  panel.inert = false;
  panel.classList.add('open');
  document.body.dataset.open = id;
  panel.querySelector('.st-body').scrollTop = 0;
  for (const p of SHOPS) {
    const on = p.id === id;
    tagEls[p.id].classList.toggle('open', on); stopEls[p.id].classList.toggle('open', on);
    stopEls[p.id].setAttribute('aria-expanded', String(on));
    world.querySelector(`[data-place="${p.id}"]`).classList.toggle('open', on);
  }
  try { history.replaceState(null, '', `?from=${id}${forcedLayout ? '&layout=' + forcedLayout : ''}`); } catch (e) {}
  if (byKeyboard) close.focus({ preventScroll: true });
  moveCam(instant || (was && !SHEET.matches));

  /* no mouse to hover with: let the video thumbnails take turns playing */
  clearInterval(carousel);
  const clips = [...panel.querySelectorAll('.entry video')];
  if (clips.length && !HOVER.matches && !REDUCED) {
    let n = 0;
    const turn = () => { clips.forEach(stopClip); playClip(clips[n++ % clips.length]); };
    turn(); carousel = setInterval(turn, 5000);
  }
}
function closePanel(byKeyboard) {
  if (!openId) return;
  const id = openId;
  openId = null;
  clearInterval(carousel);
  panel.querySelectorAll('video').forEach(stopClip);
  panel.classList.remove('open');
  panel.inert = true;
  delete document.body.dataset.open;
  for (const p of SHOPS) {
    tagEls[p.id].classList.remove('open'); stopEls[p.id].classList.remove('open');
    stopEls[p.id].setAttribute('aria-expanded', 'false');
    world.querySelector(`[data-place="${p.id}"]`).classList.remove('open');
  }
  try { history.replaceState(null, '', location.pathname + (forcedLayout ? '?layout=' + forcedLayout : '')); } catch (e) {}
  if (byKeyboard) (opener && opener.offsetParent ? opener : tagEls[id]).focus({ preventScroll: true });
  moveCam();
}

/* ───────────── The spirit of stories: it is the pointer ───────────── */
const spirit = $('spirit'), ghost = spirit.querySelector('svg'), eyes = spirit.querySelector('.eyes');
const FAST = .11, SLOW = .22;                  // how quickly it catches up (seconds)
const me = { x: L.start[0], y: L.start[1] }, to = { ...me };   // where it is and where it is heading, in map units
let tau = FAST, trail = [], lastTrail = 0, lookX = 0, tilt = 0;
function aim(pt, speed) { to.x = pt.x; to.y = pt.y; tau = speed; }
function placeAt(pt) {
  const s = SHOPS.find(p => { const [x, y, w, hh] = L.places[p.id]; return pt.x > x - 12 && pt.x < x + w + 12 && pt.y > y - 12 && pt.y < y + hh + 22 * L.u; });
  return s ? s.id : null;
}

/* ───────────── Input ───────────── */
const tip = $('tip');
function showTip(boat) {
  tip.replaceChildren(h('span', { text: boat.dataset.role }), h('b', { text: boat.dataset.name }));
  tip.hidden = false;
  const b = boat.getBoundingClientRect(), W = tip.offsetWidth;
  tip.style.transform = `translate(${Math.round(clamp(b.left + b.width / 2 - W / 2, 8, innerWidth - W - 8))}px, ${Math.round(b.top - tip.offsetHeight - 10)}px)`;
}
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const t = e.target instanceof Element ? e.target : null;
  if (!t || !t.closest('#map, .tag')) { if (hotBy === 'mouse' || hotBy === 'keys') setHot(null); tip.hidden = true; return; }
  aim(toMap(e.clientX, e.clientY), FAST);
  const pl = t.closest('[data-place]'), boat = t.closest('.boat');
  setHot(pl ? pl.dataset.place : null, 'mouse');
  if (boat) showTip(boat); else tip.hidden = true;
});
document.documentElement.addEventListener('pointerleave', () => { if (hotBy === 'mouse') setHot(null); tip.hidden = true; });
svg.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') aim(toMap(e.clientX, e.clientY), SLOW); });
svg.addEventListener('click', e => {
  const pl = e.target.closest('[data-place]');
  if (pl) { openPlace(pl.dataset.place, false); if (e.pointerType === 'touch') aim(front(pl.dataset.place), SLOW); }
  else if (!e.target.closest('.boat')) closePanel();
});

const held = new Set();
const MOVE = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target instanceof Element ? e.target : document.body, key = e.key.toLowerCase();
  if (key === 'escape') { if (openId) closePanel(true); return; }
  if (MOVE[key] && !t.closest('#stories, #site, a, input, textarea, select')) { held.add(key); e.preventDefault(); return; }
  if ((key === 'enter' || key === ' ') && t === document.body && hot) { e.preventDefault(); openPlace(hot, true); }
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());

/* ───────────── 2.5D: the camera leans back and the town stands up ─────────────
   depth runs from 0 to 1: it tilts the camera (setView) and gives everything its height (P). */
const depthBtn = $('depth');
function applyDepth() {
  svg.style.setProperty('--z', depth.toFixed(3));
  svg.classList.toggle('deep', depth > 0);
  applyCam();
}
function setDepth(on, instant) {
  depthFrom = depth; depthTo = on ? 1 : 0; depthT = instant || REDUCED ? 1 : 0;
  if (depthT === 1) { depth = depthTo; applyDepth(); }
  if (depthBtn) depthBtn.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('heartblicke-depth', on ? '1' : '0'); } catch (e) {}
}
if (depthBtn) depthBtn.addEventListener('click', () => setDepth(depthTo === 0));

/* ───────────── Every frame ───────────── */
const coords = $('coords');
let last = 0, clock = 0, coordText = '';
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0);
  last = ts; clock += dt;

  if (camTo) {
    camT = Math.min(1, camT + dt / .32);
    const k = 1 - Math.pow(1 - camT, 3);
    cam = { s: camFrom.s + (camTo.s - camFrom.s) * k, x: camFrom.x + (camTo.x - camFrom.x) * k, y: camFrom.y + (camTo.y - camFrom.y) * k };
    if (camT === 1) camTo = null;
    applyCam();
  }

  if (depthT < 1) {                                  // the town standing up, or lying down again
    depthT = Math.min(1, depthT + dt / .7);
    const k = depthT < .5 ? 4 * depthT ** 3 : 1 - (2 - 2 * depthT) ** 3 / 2;
    depth = depthFrom + (depthTo - depthFrom) * k;
    applyDepth();
  }

  if (held.size) {                                   // arrow keys or W A S D
    let dx = 0, dy = 0;
    for (const k of held) { dx += MOVE[k][0]; dy += MOVE[k][1]; }
    const n = Math.hypot(dx, dy) || 1, step = 420 * dt / cam.s, q = toScreen(to.x + dx / n * step, to.y + dy / n * step);
    aim(toMap(clamp(q.x, 14, innerWidth - 14), clamp(q.y, 14, innerHeight - 14)), .08);
    setHot(placeAt(to), 'keys');
  }

  const ease = REDUCED ? 1 : 1 - Math.exp(-dt / tau), px = me.x;
  me.x += (to.x - me.x) * ease; me.y += (to.y - me.y) * ease;
  const vx = dt ? (me.x - px) * cam.s / dt : 0, p = toScreen(me.x, me.y);
  const sway = 1 - Math.exp(-dt / .14);              // lean and glance settle gently, at any frame rate
  lookX += (clamp(vx / 260, -1, 1) - lookX) * sway;
  tilt += (clamp(vx / 140, -7, 7) - tilt) * sway;
  spirit.style.transform = `translate3d(${f(p.x)}px, ${f(p.y)}px, 0) scale(${(p.w / cam.s).toFixed(3)})`;       // smaller in the distance
  if (!REDUCED) {
    ghost.style.transform = `translateY(${f(Math.sin(clock * 2.4) * 3)}px) rotate(${f(tilt)}deg)`;
    eyes.setAttribute('transform', `translate(${f(lookX * 2.2)} 0)`);
    /* a dotted line where it has just been */
    const tail = trail[trail.length - 1];
    if (!tail || Math.hypot(tail.x - me.x, tail.y - me.y) * cam.s > 5) trail.push({ x: me.x, y: me.y, t: clock });
    while (trail.length && clock - trail[0].t > .3) trail.shift();
    if (trail.length || lastTrail) trailEl.setAttribute('points', trail.map(q => { const t = P(q.x, q.y); return f(t.x) + ',' + f(t.y); }).join(' '));
    lastTrail = trail.length;
  }

  /* grid reference of the spirit, like the corner of a survey map */
  const col = Math.floor(me.x / 100), row = Math.floor(me.y / 100);
  const text = (col >= 0 && col < 26 && row >= 0 ? String.fromCharCode(65 + col) + (row + 1) : '··') +
    `  ${(49.4195 - me.y / L.h * .011).toFixed(4)}° N  ${(8.6975 + me.x / L.w * .018).toFixed(4)}° E`;
  if (text !== coordText) coords.textContent = coordText = text;

  requestAnimationFrame(frame);
}

/* ───────────── Start ───────────── */
function build() {
  L = LAYOUTS[tall ? 'tall' : 'wide'];
  document.body.dataset.layout = tall ? 'tall' : 'wide';
  drawMap();
  for (const s of SHOPS) world.querySelector(`[data-place="${s.id}"]`).classList.toggle('open', s.id === openId);
}
addEventListener('resize', () => {
  if (wantTall() !== tall) {                         // the screen was turned: draw the other layout
    tall = wantTall(); hot = null; peek.hidden = true; build();
    const p = openId ? front(openId) : { x: L.start[0], y: L.start[1] };
    me.x = to.x = p.x; me.y = to.y = p.y; trail = [];
  }
  moveCam(true);
});
SHEET.addEventListener('change', () => moveCam(true));

build();
panel.inert = true;
moveCam(true);
let standing = false;
try { standing = localStorage.getItem('heartblicke-depth') === '1'; } catch (e) {}
if (standing) setDepth(true, true);
const from = shopOf(params.get('from'));
if (from) {                                          // coming back from a story: its place is open again
  openPlace(from.id, false, true);
  const p = front(from.id);
  me.x = to.x = p.x; me.y = to.y = p.y;
}
document.body.classList.add('ready');
requestAnimationFrame(frame);
})();
