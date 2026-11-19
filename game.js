/* Heidelbrück — a tiny walkable pixel town (inspired by, but not, Heidelberg).
   Everything is drawn in code: no image files. */
(() => {
'use strict';

/* Shop names and their stories live in stories.js (window.SHOPS). */
const SHOPS = window.SHOPS;

/* ───────────── Two layouts of the same town ─────────────
   WIDE for computers and tablets. TALL for a phone held upright: the same buildings
   stacked top to bottom, so the whole town fits the screen. Everything that has a
   position on the map is listed here; coordinates are in map pixels. */
const forcedLayout = new URLSearchParams(location.search).get('layout');       // ?layout=tall or ?layout=wide
const PORTRAIT_PHONE = '(orientation: portrait) and (max-width: 720px)';
const TALL = forcedLayout ? forcedLayout === 'tall' : matchMedia(PORTRAIT_PHONE).matches;
const LAYOUT = TALL ? {
  WT: 34, HT: 70,                                   // map size in 16-pixel tiles
  peak: 240, fall: 220,                             // mountain: x of the summit, how fast the sides drop
  clouds: [[90, 62, .8], [330, 30, .6], [480, 92, .7]],
  trails: [                                         // walkable way up to the castle: [x, y, w, h, kind]
    [64, 168, 352, 16, 'terrace'], [64, 184, 32, 24, 'stairs'], [64, 208, 368, 16, 'path'], [400, 224, 32, 24, 'stairs'],
    [256, 248, 176, 16, 'path'], [256, 264, 32, 32, 'stairs'], [256, 296, 32, 24, 'path'],
  ],
  castle: [-544, 40], uni: [-240, 16], church: [-96, 496],          // how far each landmark is moved from where it was drawn
  plaza: [96, 464, 352, 168, 34], fountain: [272, 552],
  meadows: [],
  river: [816, 208], bridge: 248, piers: [28, 72, 116, 160],        // river [y, height], x of the bridge deck
  shops: {
    books: { x: 48, y: 352, w: 96, h: 112, door: { x: 96, y: 464 } },       // left of the university
    cinema: { x: 400, y: 368, w: 112, h: 96, door: { x: 456, y: 464 } },    // right of the university
    vinyl: { x: 64, y: 680, w: 96, h: 104, door: { x: 135, y: 784 } },      // down by the river
  },
  houses: [[608, [[1, 4], [29, 4]], 44, [72, 80]]],                 // [street line, [[tile x, tiles wide], …], seed, heights]
  lamps: [[216, 528], [328, 528], [216, 592], [328, 592], [40, 814], [200, 814], [344, 814], [504, 814]],
  benches: [[120, 576], [408, 576], [176, 808], [352, 808], [184, 1048], [344, 1048], [128, 184], [336, 184]],
  trees: [[116, 512], [428, 512], [116, 616], [428, 616], [188, 776], [36, 776], [508, 776], [60, 1048], [140, 1048], [412, 1048], [484, 1048]],
  boats: [[66, 892], [172, 952], [66, 1012], [478, 892], [372, 952], [478, 1012]],     // [centre x, waterline y]
  swans: [[130, 872, 0], [420, 1002, 2]],
  start: [272, 1068],
} : {
  WT: 64, HT: 51,
  peak: 416, fall: 362,
  clouds: [[120, 60, 1], [300, 34, .7], [820, 52, 1], [950, 112, .6], [690, 24, .5]],
  trails: [
    [240, 168, 352, 16, 'terrace'], [240, 184, 32, 24, 'stairs'], [240, 208, 368, 16, 'path'], [576, 224, 32, 24, 'stairs'],
    [496, 248, 112, 16, 'path'], [496, 264, 32, 32, 'stairs'], [496, 296, 32, 24, 'path'],
  ],
  castle: [-368, 40], uni: [0, 0], church: [304, 160],
  plaza: [320, 448, 384, 152, 34], fountain: [512, 536],
  meadows: [[[262, 410, 36], [246, 428, 26], [278, 400, 22]], [[256, 552, 40], [228, 566, 24], [282, 538, 26]]],
  river: [624, 96], bridge: 480, piers: [28, 66],
  shops: {
    books: { x: 304, y: 336, w: 96, h: 112, door: { x: 352, y: 448 } },    // on the university square
    cinema: { x: 96, y: 352, w: 112, h: 96, door: { x: 152, y: 448 } },    // west end of the main street
    vinyl: { x: 848, y: 488, w: 96, h: 104, door: { x: 919, y: 592 } },    // east end of the riverside
  },
  houses: [[448, [[2, 3], [57, 4]], 42, [72, 80, 88]], [592, [[2, 4], [8, 4], [46, 4]], 43, [72, 80, 88, 96]]],
  lamps: [[456, 512], [568, 512], [456, 576], [568, 576], [176, 622], [400, 622], [624, 622], [848, 622]],
  benches: [[352, 544], [656, 544], [224, 616], [768, 616], [432, 744], [560, 744], [304, 184], [512, 184]],
  trees: [
    [340, 520], [340, 576], [684, 520], [684, 576],              // university square
    [644, 432], [700, 440],                                      // beside the university
    [244, 408], [276, 432], [228, 544], [276, 536], [252, 576],  // the two greens
    [820, 584], [972, 576],                                      // beside the record store
    [60, 744], [236, 744], [380, 744], [700, 744], [892, 744],   // far bank
  ],
  boats: [[78, 698], [232, 712], [386, 698], [620, 712], [774, 698], [928, 712]],
  swans: [[150, 664, 0], [438, 700, 2], [716, 664, 4]],
  start: [504, 762],
};

/* ───────────── Basics ───────────── */
const T = 16, { WT, HT } = LAYOUT, W = WT * T, H = HT * T;
const CELL = 8, CW = W / CELL, CH = H / CELL;
const SPEED = 125;   // walking speed in map pixels per second

const P = {
  out: '#2a1f2b',
  grass: '#6aa84f', hill: '#4f8a45', wood: '#3a6b35',
  leaf: '#3e7d3a', trunk: '#6b4630', trunkD: '#4e3222',
  cob: '#c4b295', street: '#d0c0a3', plaza: '#d9ccb2', path: '#c4a574',
  water: '#3f86c0', waterD: '#3371a8', waterL: '#7cb8e6',
  sand: '#c0664e', sandD: '#9a4a3a', sandL: '#d98568', sandXD: '#743528',
  slate: '#5d6878', slateD: '#465061', slateL: '#7c889a',
  stone: '#9a968f', stoneD: '#77736d', stoneL: '#b9b5ad',
  timber: '#5a3a28', glass: '#34455e', glassL: '#8fb6d9', lit: '#ffd978', frame: '#fbf5e6',
  gold: '#f4d04e',
  roofs: [['#c9583c', '#a3412d', '#e0775a'], ['#b5492f', '#8f3623', '#d0664a'], ['#8f4a3a', '#6e3629', '#a9604d'],
          ['#5d6878', '#465061', '#7c889a'], ['#d0703f', '#aa5530', '#e58d5c']],
  walls: [['#f2e6c9', '#d9caa6'], ['#efd28a', '#d3b56b'], ['#e9b9a6', '#cf9a86'], ['#c4d7dd', '#a3bcc5'],
          ['#f6f1e7', '#dcd5c6'], ['#d9e2b4', '#bcc893'], ['#e8c9a0', '#cdab80']],
  shutters: ['#3f6b4f', '#8c3b32', '#3d5a80', '#6b4a32'],
  doors: ['#6b4630', '#2f5d50', '#7d2f2f', '#30507a'],
  flowers: ['#e0465b', '#f08fb0', '#f4d04e', '#f6f1e7'],
  awnings: ['#c0392b', '#2f7f86', '#3f6b4f', '#e8703a'],
};

const $ = id => document.getElementById(id);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const pick = (arr, r) => arr[r() * arr.length | 0];
const px = (g, c, x, y, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c(n >> 8 & 255)},${c(n & 255)})`;
}
function disc(g, c, cx, cy, r) {
  g.fillStyle = c;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy;
      if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
    }
}
/* ───────────── Colour scheme ─────────────
   The town is drawn in full colour, then every colour is toned down by the
   same amount. Hues and brightness stay as they are. */
const SATURATION = .55;   // 1 = original colours … 0 = grey

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function mute(r, g, b) {
  const [h, s, l] = toHsl(r, g, b);
  return fromHsl(h, Math.min(1, s) * SATURATION, l);
}
/* recolour every pixel of a canvas (each distinct colour is converted once) */
const muteCache = new Map();
function muteCanvas(c) {
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), a = img.data;
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const key = a[i] << 16 | a[i + 1] << 8 | a[i + 2];
    let v = muteCache.get(key);
    if (v === undefined) { const [r, gg, b] = mute(a[i], a[i + 1], a[i + 2]); muteCache.set(key, v = r << 16 | gg << 8 | b); }
    a[i] = v >> 16; a[i + 1] = v >> 8 & 255; a[i + 2] = v & 255;
  }
  g.putImageData(img, 0, 0);
}
const tint = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${mute(n >> 16, n >> 8 & 255, n & 255).join(',')})`; };

/* round-topped arch (doors) */
function roundArch(g, c, x, y, w, h) {
  px(g, c, x + 2, y, w - 4, 1); px(g, c, x + 1, y + 1, w - 2, 1); px(g, c, x, y + 2, w, h - 2);
}
/* pointed (gothic) arch shape */
function arch(g, c, x, y, w, h) {
  const n = w >> 1;
  for (let i = 0; i < n; i++) px(g, c, x + n - 1 - i, y + i, 2 * (i + 1), 1);
  px(g, c, x, y + n, w, h - n);
}

/* 3×5 pixel font for shop signs */
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '111101101101111',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '&': '010101010101011',
};
function text(g, s, x, y, col, sc = 1) {
  for (const ch of s) {
    const f = FONT[ch];
    if (f) for (let i = 0; i < 15; i++) if (f[i] === '1') px(g, col, x + (i % 3) * sc, y + (i / 3 | 0) * sc, sc, sc);
    x += 4 * sc;
  }
}
const textW = (s, sc = 1) => s.length * 4 * sc - sc;

/* ───────────── World state ───────────── */
const solid = new Uint8Array(CW * CH);
function block(x, y, w, h, v = 1) {
  const x0 = Math.max(0, Math.floor(x / CELL)), y0 = Math.max(0, Math.floor(y / CELL));
  const x1 = Math.min(CW, Math.ceil((x + w) / CELL)), y1 = Math.min(CH, Math.ceil((y + h) / CELL));
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) solid[j * CW + i] = v;
}
const isSolid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || solid[(y / CELL | 0) * CW + (x / CELL | 0)] === 1;

const base = mk(W, H), b = base.getContext('2d');
const objs = [];      // tall things the player can walk behind: {x,y,w,h,baseY,img}
const shadows = [];
const bulbs = [];     // cinema marquee lights (animated)
const shimmer = [];   // river sparkles (animated)
const R = rng(7);

function addObj(x, y, w, h, baseY, draw) {
  const c = mk(w, h), g = c.getContext('2d');
  g.translate(-x, -y);
  draw(g);
  objs.push({ x, y, w, h, baseY, img: c });
}
/* same, for something drawn at its original coordinates and then moved by (dx, dy) */
function addObjAt(dx, dy, x, y, w, h, baseY, draw) {
  addObj(x + dx, y + dy, w, h, baseY + dy, g => { g.save(); g.translate(dx, dy); draw(g); g.restore(); });
}
const addSprite = (img, x, y, baseY) => objs.push({ x, y, w: img.width, h: img.height, baseY, img });

/* ───────────── Terrain ───────────── */
function speckle(g, x, y, w, h, cols, density, pw = 1, ph = 1) {
  const n = w * h * density | 0;
  for (let i = 0; i < n; i++)
    px(g, cols[R() * cols.length | 0], x + (R() * (w - pw + 1) | 0), y + (R() * (h - ph + 1) | 0), pw, ph);
}
function grass(x, y, w, h, c = P.grass) {
  px(b, c, x, y, w, h);
  speckle(b, x, y, w, h, [shade(c, .88), shade(c, .88), shade(c, 1.12)], .035, 1, 2);
  speckle(b, x, y, w, h, ['#f6f1e7', '#f4d04e', '#f08fb0'], .0012);
}
function cobble(x, y, w, h, c = P.cob) {
  px(b, c, x, y, w, h);
  const j = shade(c, .9);
  for (let yy = y, row = 0; yy < y + h; yy += 4, row++) {
    if (yy + 3 < y + h) px(b, j, x, yy + 3, w, 1);
    for (let xx = x + (row % 2 ? 3 : 0); xx < x + w; xx += 6) px(b, j, xx, yy, 1, Math.min(3, y + h - yy));
  }
  speckle(b, x, y, w, h, [shade(c, .94), shade(c, 1.06)], .012, 3, 2);
}
/* paving inside any shape (used for the rounded square) */
function cobbleShape(x0, y0, x1, y1, inside, c) {
  const j = shade(c, .9);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!inside(x, y)) continue;
    const row = (y - y0) >> 2;
    px(b, (y - y0) % 4 === 3 || (x - x0 + (row % 2 ? 3 : 0)) % 6 === 0 ? j : c, x, y);
  }
  for (let i = 0; i < (x1 - x0) * (y1 - y0) * .012; i++) {
    const x = x0 + (R() * (x1 - x0 - 3) | 0), y = y0 + (R() * (y1 - y0 - 2) | 0);
    if (inside(x, y) && inside(x + 2, y + 1)) px(b, shade(c, R() < .5 ? .94 : 1.06), x, y, 3, 2);
  }
}
const inRounded = (x, y, rx, ry, rw, rh, rad) => {
  const dx = Math.max(rx + rad - x, 0, x - (rx + rw - 1 - rad)), dy = Math.max(ry + rad - y, 0, y - (ry + rh - 1 - rad));
  return x >= rx && x < rx + rw && y >= ry && y < ry + rh && dx * dx + dy * dy <= rad * rad;
};
/* a soft-edged lawn made of overlapping circles: [[cx, cy, r], …] */
function meadow(circles) {
  const inside = (x, y) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + ((y - cy) * 1.25) ** 2 <= r * r);
  const x0 = Math.min(...circles.map(c => c[0] - c[2])), x1 = Math.max(...circles.map(c => c[0] + c[2]));
  const y0 = Math.min(...circles.map(c => c[1] - c[2])), y1 = Math.max(...circles.map(c => c[1] + c[2]));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    px(b, !inside(x, y + 1) ? shade(P.grass, .72) : !inside(x, y - 1) ? shade(P.grass, 1.15) : P.grass, x, y);
  }
  for (let i = 0; i < (x1 - x0) * (y1 - y0) * .04; i++) {
    const x = x0 + (R() * (x1 - x0) | 0), y = y0 + (R() * (y1 - y0) | 0);
    if (inside(x, y) && inside(x, y + 3)) px(b, R() < .08 ? pick(['#f6f1e7', '#f4d04e', '#f08fb0'], R) : shade(P.grass, R() < .6 ? .88 : 1.12), x, y, 1, R() < .08 ? 1 : 2);
  }
}
function boat(x, y, c) {
  px(b, 'rgba(20,40,80,.3)', x + 1, y + 6, 18, 2);
  px(b, shade(c, .65), x + 2, y, 16, 7); px(b, shade(c, .65), x, y + 1, 20, 4);
  px(b, c, x + 2, y + 1, 16, 4); px(b, shade(c, 1.3), x + 3, y + 2, 14, 1);
  px(b, '#3a2a2e', x + 7, y + 1, 1, 4); px(b, '#3a2a2e', x + 12, y + 1, 1, 4);
}

/* the castle mountain */
const PEAK = LAYOUT.peak;
/* height of the ridge line at a given x */
const ridge = x => Math.round(120 + (1 - Math.cos(Math.min(1, Math.max(0, Math.abs(x - PEAK) - 150) / LAYOUT.fall) * Math.PI)) / 2 * 140);
/* rock ledges that step the slope (flat in the middle, curving up towards the sides) */
const ledge = (yc, rise) => x => Math.round(yc - rise * Math.pow(Math.max(0, (Math.abs(x - PEAK) - 240) / 272), 2));
const LEDGES = [ledge(232, 40), ledge(280, 30)];
/* the walkable trail from the town up to the castle */
const TRAILS = LAYOUT.trails;

function paintTerrain() {
  const [RY, RH] = LAYOUT.river, BX = LAYOUT.bridge, BKY = RY + RH;     // river top and height, bridge x, far bank y
  // sky and clouds behind the mountain
  ['#a9d3ee', '#b7dbf0', '#c6e3f2', '#d5ebf4', '#e3f1f4', '#e9f4f3'].forEach((c, i) => px(b, c, 0, i * 54, W, 54));
  for (const [cx, cy, k] of LAYOUT.clouds) {
    px(b, '#fafdff', cx - 22 * k, cy, 44 * k, 6); px(b, '#fafdff', cx - 12 * k, cy - 5, 26 * k, 5);
    px(b, '#fafdff', cx - 30 * k, cy + 4, 60 * k, 4); px(b, '#e2eef4', cx - 30 * k, cy + 8, 60 * k, 2);
  }
  // far hills, then the castle mountain itself
  for (let x = 0; x < W; x++) {
    const far = Math.round(214 + 26 * Math.cos(x / 150 + 1)), top = ridge(x);
    px(b, '#a8c6b6', x, far, 1, 320 - far);
    px(b, P.hill, x, top, 1, 320 - top); px(b, shade(P.hill, 1.18), x, top, 1, 2);
  }
  for (let i = 0; i < Math.round(W * 2600 / 1024); i++) {
    const x = R() * W | 0, y = ridge(x) + 3 + (R() * (314 - ridge(x)) | 0);
    px(b, shade(P.hill, R() < .6 ? .88 : 1.12), x, y, 1, 2);
  }
  for (const f of LEDGES) for (let x = 0; x < W; x++) {
    const y = f(x);
    if (y < ridge(x) + 10) continue;
    px(b, '#c98e73', x, y, 1, 2); px(b, '#a8705a', x, y + 2, 1, 7); px(b, '#7a4c3d', x, y + 9, 1, 3);
    px(b, 'rgba(20,30,20,.18)', x, y + 12, 1, 3);
    if (R() < .22) px(b, '#7a4c3d', x, y + 2 + (R() * 3 | 0), 1, 4 + (R() * 3 | 0));
    if (R() < .1) px(b, '#c98e73', x, y + 3, 1, 3);
  }
  for (const [x, y, w, h, kind] of TRAILS) {
    if (kind === 'terrace') cobble(x, y, w, h, P.plaza);
    else if (kind === 'stairs') for (let yy = y; yy < y + h; yy += 4) { px(b, P.stoneL, x + 4, yy, w - 8, 3); px(b, P.stoneD, x + 4, yy + 3, w - 8, 1); }
    else {
      px(b, P.path, x, y, w, h);
      speckle(b, x, y, w, h, [shade(P.path, .88), shade(P.path, 1.1)], .04, 2, 1);
      px(b, shade(P.path, .8), x, y + h - 1, w, 1);
    }
  }

  // old town
  cobble(0, 320, W, RY - 320);
  // university square: rounded paving with a ring around the fountain
  const [qx, qy, qw, qh, qr] = LAYOUT.plaza, [fx, fy] = LAYOUT.fountain;
  cobbleShape(qx, qy, qx + qw, qy + qh, (x, y) => inRounded(x, y, qx, qy, qw, qh, qr), P.plaza);
  for (let y = fy - 34; y <= fy + 34; y++) for (let x = fx - 56; x <= fx + 56; x++) {
    const d = ((x - fx) / 56) ** 2 + ((y - fy) / 34) ** 2;
    if (d <= 1 && d > .9) px(b, shade(P.plaza, .82), x, y);
  }
  // small greens with soft edges
  for (const circles of LAYOUT.meadows) meadow(circles);

  // river
  px(b, P.water, 0, RY, W, RH);
  px(b, P.waterD, 0, RY + 12, W, 6);
  speckle(b, 0, RY + 20, W, RH - 24, [P.waterD], .004, 8, 1);
  speckle(b, 0, RY + 20, W, RH - 24, [P.waterL], .002, 5, 1);
  // quay wall
  px(b, P.stoneL, 0, RY - 2, W, 2);
  px(b, P.stone, 0, RY, W, 10);
  for (let xx = 0; xx < W; xx += 10) { px(b, P.stoneD, xx, RY, 1, 5); px(b, P.stoneD, xx + 5, RY + 5, 1, 5); }
  px(b, P.stoneD, 0, RY + 4, W, 1); px(b, '#2c5f8a', 0, RY + 10, W, 2);

  // far bank
  grass(0, BKY, W, 96);
  const pathY = x => Math.round(BKY + 35 + 5 * Math.sin(x / 80) + 2 * Math.sin(x / 23));
  px(b, P.path, BX, BKY + 8, 48, 40);
  for (let x = 0; x < W; x++) {
    const e = Math.round(3 + 2.5 * Math.sin(x / 37) + 1.5 * Math.sin(x / 11 + 2));     // wavy shoreline
    px(b, P.water, x, BKY, 1, e); px(b, '#2c5f8a', x, BKY + e - 1, 1, 1); px(b, '#8a7a55', x, BKY + e, 1, 2);
    if (R() < .3) px(b, R() < .5 ? '#4f8a45' : '#6aa84f', x, BKY - 2 + e, 1, 3);
    if (x >= 16 && x < W - 16) {                                                         // meandering footpath
      const y = pathY(x);
      px(b, P.path, x, y, 1, 13); px(b, shade(P.path, .8), x, y + 13, 1, 1);
      if (R() < .5) px(b, shade(P.path, R() < .5 ? .88 : 1.1), x, y + 1 + (R() * 11 | 0), 2, 1);
    }
  }

  // old bridge
  for (const o of LAYOUT.piers) {             // pier cutwaters
    const ws = [2, 4, 6, 8, 9, 10, 9, 8, 6, 4, 2];
    ws.forEach((w, i) => {
      const c = i < 6 ? P.sandL : P.sandD;
      px(b, c, BX - 4 - w, RY + o + i, w, 1); px(b, c, BX + 52, RY + o + i, w, 1);
    });
  }
  px(b, 'rgba(20,30,70,.28)', BX + 52, RY + 14, 7, RH - 14);
  cobble(BX, RY, 48, RH + 8, '#cbb49a');
  px(b, P.sandL, BX - 4, RY + 6, 4, RH - 2); px(b, P.sandD, BX - 1, RY + 6, 1, RH - 2);
  px(b, P.sandL, BX + 48, RY + 6, 4, RH - 2); px(b, P.sandXD, BX + 48, RY + 6, 1, RH - 2);
  for (let yy = RY + 6; yy < RY + RH + 4; yy += 14) { px(b, P.sandD, BX - 4, yy, 4, 1); px(b, P.sandD, BX + 48, yy, 4, 1); }

  // cinema red carpet
  const cin = shopGeo.cinema, cy = cin.y + cin.h;
  px(b, '#a82f3d', cin.x + 42, cy, 28, 12); px(b, P.gold, cin.x + 42, cy, 1, 12); px(b, P.gold, cin.x + 69, cy, 1, 12);

  // river sparkles
  const r = rng(21);
  for (let i = 0; i < Math.round(W * RH / 756); i++) {
    const x = 20 + r() * (W - 40) | 0, y = RY + 22 + r() * (RH - 28) | 0;
    if (x > BX - 18 && x < BX + 66) continue;
    shimmer.push({ x, y, ph: r() * 6.28, w: 3 + (r() * 4 | 0) });
  }
}

/* ───────────── Trees ───────────── */
function makeTree(seed, fir) {
  const c = mk(20, 28), g = c.getContext('2d'), r = rng(seed), cx = 10, by = 28;
  if (fir) {
    px(g, P.trunkD, cx - 1, by - 4, 3, 4);
    const col = ['#2f6b45', '#2a6350', '#356f3c'][seed % 3];
    let yy = by - 22;
    for (const tier of [[2, 4, 6, 8], [4, 6, 8, 10, 12], [6, 8, 10, 12, 14, 16], [10, 14, 18]])
      for (const w of tier) {
        px(g, col, cx - w / 2, yy, w, 1); px(g, shade(col, .76), cx, yy, w / 2, 1);
        px(g, shade(col, 1.3), cx - w / 2, yy, 1, 1); yy++;
      }
  } else {
    px(g, P.trunkD, cx - 2, by - 7, 4, 7); px(g, P.trunk, cx - 1, by - 7, 2, 6);
    const col = [P.leaf, '#4a8a3c', '#3a7a4a', '#5a8f3a'][seed % 4];
    const rows = [6, 10, 14, 16, 18, 18, 18, 18, 18, 16, 16, 14, 12, 8];
    rows.forEach((w, i) => px(g, shade(col, .7), cx - w / 2, by - 20 + i, w, 1));
    rows.forEach((w, i) => { if (i < rows.length - 2) px(g, col, cx - w / 2 + 1, by - 20 + i, w - 3, 1); });
    for (let i = 0; i < 10; i++) {
      const a = r() * 6.28, d = r() * 5;
      px(g, shade(col, 1.22), cx - 3 + Math.cos(a) * d, by - 15 + Math.sin(a) * d * .7, 2, 1);
    }
    for (let i = 0; i < 4; i++) px(g, shade(col, 1.42), cx - 5 + r() * 5, by - 18 + r() * 4, 1, 1);
  }
  return c;
}
const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8].map(s => makeTree(s, false));
const FIRS = [11, 12, 13, 14, 15].map(s => makeTree(s, true));

function tree(cx, by, fir) {
  block(cx - 4, by - 8, 8, 8);
  shadows.push([cx - 6, by - 2, 12, 3]);
  addSprite((fir ? FIRS : ROUNDS)[(cx * 7 + by * 3) % (fir ? 5 : 8)], cx - 10, by - 28, by);
}
function forest(x, y, w, h, seed, firs = .3) {
  const r = rng(seed);
  block(x, y, w, h);
  px(b, P.wood, x, y, w, h);
  for (let yy = y + 8, row = 0; yy <= y + h; yy += 9, row++)
    for (let xx = x + 5 + (row % 2 ? 6 : 0); xx < x + w - 2; xx += 13)
      addSprite(pick(r() < firs ? FIRS : ROUNDS, r), Math.round(xx + r() * 4 - 2) - 10, Math.round(yy + r() * 4 - 2) - 28, yy);
}

/* ───────────── Houses ───────────── */
function house(g, x, y, w, h, o) {
  const r = rng(o.seed), [wall, wallD] = o.wall, [roof, roofD, roofL] = o.roof;
  const groundH = o.groundH || 16, cx = x + w / 2;
  const gh = o.gable ? Math.round(w * .42) : 0;
  const roofH = o.gable ? gh + 8 : Math.round(h * .32);
  const fy = y + roofH, fh = h - roofH, upH = fh - groundH, gy = y + h - groundH;
  const trim = o.trim || (o.timber ? P.timber : shade(roofD, .8));

  px(g, wall, x, fy, w, fh);
  px(g, wallD, x + w - 3, fy, 3, fh);

  if (o.gable) {
    px(g, roof, x, y, w / 2, roofH); px(g, roofD, cx, y, w / 2, roofH);
    for (let xx = x + 3; xx < cx - 1; xx += 4) px(g, shade(roof, .88), xx, y, 1, roofH);
    for (let xx = cx + 3; xx < x + w - 1; xx += 4) px(g, shade(roofD, .86), xx, y, 1, roofH);
    px(g, roofL, cx - 1, y, 2, roofH - gh + 1);
    px(g, shade(roofD, .7), x, y, w, 1);
    for (let i = 0; i < gh; i++) {
      const half = Math.ceil((i + 1) * (w / 2) / gh), yy = fy - gh + i;
      px(g, wall, cx - half, yy, half * 2, 1);
      px(g, trim, cx - half, yy, 2, 1); px(g, trim, cx + half - 2, yy, 2, 1);
    }
    const ay = fy - Math.round(gh * .5);
    if (o.timber) {
      px(g, P.timber, x, fy - 1, w, 2);
      px(g, P.timber, cx - 6, ay - 2, 1, fy - ay + 1); px(g, P.timber, cx + 5, ay - 2, 1, fy - ay + 1);
      px(g, P.timber, cx - 6, ay - 3, 12, 1);
    }
    px(g, P.frame, cx - 3, ay, 6, 7); px(g, P.glass, cx - 2, ay + 1, 4, 5); px(g, P.glassL, cx - 2, ay + 1, 1, 2);
    px(g, '#8d5a4a', x + 6, y - 4, 5, 9); px(g, '#5a3a33', x + 5, y - 5, 7, 2);
  } else {
    px(g, roof, x, y, w, roofH);
    for (let yy = y + 2, k = 0; yy < fy - 2; yy += 3, k++) {
      px(g, roofD, x, yy + 2, w, 1);
      for (let xx = x + (k % 2 ? 2 : 0); xx < x + w; xx += 4) px(g, shade(roof, .9), xx, yy, 1, 2);
    }
    px(g, roofL, x, y, w, 2);
    px(g, shade(roofD, .7), x, y, 1, roofH); px(g, shade(roofD, .7), x + w - 1, y, 1, roofH);
    const chx = x + 5 + (r() * (w - 16) | 0);
    px(g, '#8d5a4a', chx, y - 4, 5, 9); px(g, '#6e4337', chx + 3, y - 4, 2, 9); px(g, '#5a3a33', chx - 1, y - 5, 7, 2);
    if (w >= 64 && !o.noDormer) {
      const n = w >= 80 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const dx = Math.round(x + w * (i + 1) / (n + 1) - 4);
        px(g, roofD, dx - 1, y + 7, 10, 2); px(g, wall, dx, y + 9, 8, 7);
        px(g, P.glass, dx + 2, y + 10, 4, 5); px(g, P.glassL, dx + 2, y + 10, 1, 2);
      }
    }
    px(g, shade(roofD, .72), x - 1, fy - 2, w + 2, 2);
    px(g, shade(wall, .8), x, fy, w, 2);
  }

  // upper floors
  const sh = o.shutters, slot = sh ? 12 : 10, unit = sh ? 9 : 5;
  const nW = Math.max(1, Math.floor((w - 6 + slot - unit) / slot));
  const total = nW * unit + (nW - 1) * (slot - unit);
  const x0 = x + Math.round((w - total) / 2) + (sh ? 2 : 0);
  const nF = Math.max(1, Math.floor(upH / 12)), fy0 = fy + upH - nF * 12;
  const win = (wx, wy, hh) => {
    if (sh) { px(g, sh, wx - 2, wy, 2, hh); px(g, sh, wx + 5, wy, 2, hh); }
    px(g, P.frame, wx, wy, 5, hh);
    const lit = r() < o.lit;
    px(g, lit ? P.lit : P.glass, wx + 1, wy + 1, 3, hh - 2);
    if (!lit) px(g, P.glassL, wx + 1, wy + 1, 1, 2);
    px(g, P.frame, wx + 1, wy + (hh >> 1), 3, 1);
    if (r() < o.flowers) {
      px(g, '#6b4630', wx - 1, wy + hh, 7, 1);
      for (let k = 0; k < 3; k++) px(g, pick(P.flowers, r), wx + k * 2, wy + hh - 1, 2, 1);
    }
  };
  if (o.timber) {
    for (let f = 0; f <= nF; f++) px(g, P.timber, x, fy0 + f * 12, w, 1);
    px(g, P.timber, x, fy, 2, upH); px(g, P.timber, x + w - 2, fy, 2, upH);
    for (let i = 1; i < nW; i++) {
      const L = x0 + (i - 1) * slot + 5 + (sh ? 2 : 0), Rr = x0 + i * slot - (sh ? 2 : 0);
      px(g, P.timber, (L + Rr) >> 1, fy0, 1, nF * 12);
    }
  }
  for (let f = 0; f < nF; f++) for (let i = 0; i < nW; i++) win(x0 + i * slot, fy0 + f * 12 + 3, 7);

  // ground floor
  px(g, shade(wall, .7), x, y + h - 2, w, 2);
  if (!o.shop) {
    const dc = o.door, dx = o.doorPos === 0 ? x + 5 : o.doorPos === 2 ? x + w - 12 : Math.round(cx - 4);
    for (let i = 0; i < nW; i++) {
      const wx = x0 + i * slot;
      if (wx + 8 < dx || wx - 3 > dx + 8) win(wx, gy + 3, 8);
    }
    if (o.awning) {
      for (let i = 0; x + 2 + i * 4 < x + w - 2; i++) {
        const ww = Math.min(4, x + w - 2 - (x + 2 + i * 4));
        px(g, i % 2 ? '#f6ecd4' : o.awning, x + 2 + i * 4, gy, ww, 3);
        px(g, i % 2 ? '#d9cdb0' : shade(o.awning, .75), x + 2 + i * 4, gy + 3, ww, 1);
      }
    }
    px(g, shade(dc, .6), dx - 1, gy + 2, 9, groundH - 2); px(g, dc, dx, gy + 3, 7, groundH - 3);
    px(g, shade(dc, 1.3), dx + 1, gy + 4, 2, 4); px(g, shade(dc, 1.3), dx + 4, gy + 4, 2, 4);
    px(g, P.gold, dx + 5, gy + 10, 1, 1);
    px(g, P.stoneL, dx - 1, y + h - 1, 9, 1);
  }
  px(g, shade(wall, .5), x, fy, 1, fh); px(g, shade(wall, .5), x + w - 1, fy, 1, fh);
}

function addHouse(x, y, w, h, o, extra) {
  block(x, y + 16, w, h - 16);
  shadows.push([x, y + h, w, 3]);
  addObj(x - 2, y - 10, w + 4, h + 10, y + h, g => { house(g, x, y, w, h, o); if (extra) extra(g); });
}
function rowHouses(bottom, segs, seed, heights) {
  const r = rng(seed);
  for (const [tx, tw] of segs) {
    const h = pick(heights, r), timber = r() < .3, back = r() < .5 ? 8 : 0;   // some houses sit back from the street
    addHouse(tx * T, bottom - back - h, tw * T, h, {
      seed: seed * 131 + tx * 17, wall: pick(timber ? P.walls.slice(0, 5) : P.walls, r), roof: pick(P.roofs, r),
      gable: tw <= 4 && r() < .45, timber, shutters: tw >= 3 && r() < .55 ? pick(P.shutters, r) : null,
      door: pick(P.doors, r), doorPos: r() * 3 | 0, flowers: r() < .5 ? .6 : 0, lit: .12,
      awning: r() < .28 ? pick(P.awnings, r) : null,
    });
  }
}

/* ───────────── The three story places ─────────────
   Bigger than the houses, each in one strong colour, with a huge sign on top. */
const shopGeo = LAYOUT.shops;
const shopObjs = {};

function bookstore() {
  const { x, y, w, h } = shopGeo.books, sy = y + h - 32, cx = x + w / 2;
  const green = '#2f9469', greenD = '#237553', dk = '#17402f', cream = '#fbf1d6', warm = '#ffe6a3';
  addHouse(x, y, w, h, {
    seed: 501, wall: [green, greenD], roof: ['#1f6f50', '#17573e', '#2f8a63'], gable: true, timber: false, trim: cream,
    shutters: cream, flowers: .6, lit: .45, groundH: 32, shop: true,
  }, g => {
    const r = rng(77), fy = y + Math.round(w * .42) + 8;
    // a big open book in the gable
    px(g, dk, cx - 13, fy - 27, 26, 15);
    px(g, cream, cx - 12, fy - 26, 11, 11); px(g, cream, cx + 1, fy - 26, 11, 11);
    for (let k = 0; k < 4; k++) { px(g, '#9bb5a6', cx - 10, fy - 24 + k * 2, 7, 1); px(g, '#9bb5a6', cx + 3, fy - 24 + k * 2, 7, 1); }
    px(g, '#d8394e', cx - 13, fy - 14, 26, 2);
    // sign and shopfront
    px(g, cream, x + 1, sy, w - 2, 13); px(g, dk, x + 1, sy + 12, w - 2, 1);
    text(g, 'BOOKS', cx - 19, sy + 1, dk, 2);
    px(g, dk, x + 1, sy + 13, w - 2, 19);
    for (const wx of [x + 6, x + 60]) {
      px(g, cream, wx, sy + 15, 30, 13); px(g, warm, wx + 1, sy + 16, 28, 11);
      const cols = ['#c0392b', '#3d5a80', '#e8a33a', '#7d4f8f', '#f6f1e7', '#8c3b32', '#2f9469'];
      for (let bx = wx + 2; bx < wx + 27; bx += 2) {
        const hh = 5 + (r() * 4 | 0);
        px(g, pick(cols, r), bx, sy + 27 - hh, 2, hh);
        if (r() < .25) bx += 1;
      }
    }
    px(g, cream, x + 40, sy + 14, 16, 18); px(g, greenD, x + 42, sy + 16, 12, 16);
    px(g, warm, x + 44, sy + 18, 8, 7); px(g, P.gold, x + 51, sy + 27, 1, 2);
    px(g, P.stoneL, x + 39, y + h - 1, 18, 1);
  });
  // book cart out front
  const bx = x + 8, by = y + h;
  block(bx, by, 16, 8);
  addObj(bx, by - 6, 16, 14, by + 8, g => {
    px(g, '#6b4630', bx, by, 16, 5); px(g, '#4e3222', bx + 1, by + 5, 2, 3); px(g, '#4e3222', bx + 13, by + 5, 2, 3);
    ['#c0392b', '#3d5a80', '#e8a33a', '#3f6b4f', '#7d4f8f', '#f6f1e7', '#8c3b32'].forEach((c, i) => px(g, c, bx + 1 + i * 2, by - 5 + (i % 3 === 1 ? 1 : 0), 2, 5));
  });
}

function vinylShop() {
  const { x, y, w, h } = shopGeo.vinyl, sy = y + h - 32, cx = x + w / 2;
  const orange = '#f59a23', orangeD = '#d67d12', dk = '#2a1a3a', purple = '#4b2f6b', cream = '#fbf1d6', warm = '#ffe9b0';
  addHouse(x, y, w, h, {
    seed: 502, wall: [orange, orangeD], roof: [purple, '#38224f', '#6a4a8f'], gable: false, timber: false, shutters: cream,
    flowers: 0, lit: .3, groundH: 32, shop: true, noDormer: true,
  }, g => {
    // sign and shopfront
    px(g, dk, x + 1, sy, w - 2, 13); text(g, 'VINYL', cx - 19, sy + 2, '#ffd166', 2);
    px(g, purple, x + 1, sy + 13, w - 2, 19); px(g, dk, x + 1, y + h - 2, w - 2, 2);
    px(g, dk, x + 6, sy + 16, 50, 12); px(g, warm, x + 7, sy + 17, 48, 10);
    ['#e0465b', '#3d8fd1', '#ffd166', '#59b07a', '#f6ecd4'].forEach((c, i) => {
      const sx = x + 9 + i * 9;
      px(g, '#1a1620', sx + 4, sy + 18, 5, 8); px(g, c, sx, sy + 18, 7, 8); px(g, shade(c, .7), sx + 2, sy + 21, 3, 2);
    });
    for (let i = 0; i < 14; i++) {
      px(g, i % 2 ? cream : purple, x + 4 + i * 4, sy + 13, 4, 3); px(g, i % 2 ? '#d9cdb0' : '#38224f', x + 4 + i * 4, sy + 16, 4, 1);
    }
    px(g, dk, x + 63, sy + 14, 16, 18); px(g, '#e0465b', x + 65, sy + 16, 12, 16);
    px(g, warm, x + 67, sy + 18, 8, 7); px(g, P.gold, x + 74, sy + 27, 1, 2);
    px(g, P.stoneL, x + 62, y + h - 1, 18, 1);
    // a giant record on the roof
    const cy = y + 12;
    px(g, dk, cx - 9, cy + 12, 3, 8); px(g, dk, cx + 6, cy + 12, 3, 8);
    disc(g, cream, cx, cy, 16.5); disc(g, '#1a1620', cx, cy, 15.5);
    disc(g, '#3a3344', cx, cy, 12.5); disc(g, '#1a1620', cx, cy, 11.5);
    disc(g, '#3a3344', cx, cy, 9.5); disc(g, '#1a1620', cx, cy, 8.5);
    disc(g, '#ffd166', cx, cy, 5.5); disc(g, '#e0465b', cx, cy, 2.6); disc(g, '#1a1620', cx, cy, .9);
    px(g, '#8d85a0', cx - 10, cy - 9, 3, 1); px(g, '#8d85a0', cx - 12, cy - 7, 1, 3);
  });
  // crate of records
  const bx = x + 8, by = y + h;
  block(bx, by, 16, 8);
  addObj(bx, by - 5, 16, 13, by + 8, g => {
    px(g, '#8f6243', bx, by, 16, 8); px(g, '#6b4630', bx, by + 3, 16, 1); px(g, '#6b4630', bx, by + 7, 16, 1);
    ['#e0465b', '#f6ecd4', '#3d8fd1', '#f4b942', '#59b07a', '#7d4f8f', '#1a1620'].forEach((c, i) => px(g, c, bx + 1 + i * 2, by - 4 + (i % 2), 2, 5));
  });
}

function cinema() {
  const { x, y, w, h } = shopGeo.cinema;
  const cream = '#f3e3c3', red = '#d8394e', redD = '#b52a40', teal = '#2f7f86', navy = '#1b2440', wine = '#7a1f2b', goldS = '#ffd166';
  block(x, y + 16, w, h - 16);
  shadows.push([x, y + h, w, 3]);
  addObj(x - 2, y - 10, w + 4, h + 10, y + h, g => {
    // flat roof
    px(g, '#77727f', x, y, w, 22); px(g, '#9a95a3', x, y, w, 2); px(g, '#5a5562', x, y + 20, w, 2);
    px(g, '#5a5562', x + 12, y + 6, 9, 7); px(g, '#9a95a3', x + 12, y + 6, 9, 1);
    px(g, '#5a5562', x + 85, y + 6, 14, 10); px(g, P.glassL, x + 86, y + 7, 12, 8); px(g, '#c5e4f7', x + 87, y + 8, 4, 2);
    // facade
    px(g, red, x, y + 22, w, 74); px(g, redD, x, y + 70, w, 26);
    px(g, cream, x + 40, y + 6, 32, 54); px(g, cream, x + 44, y + 1, 24, 5);
    px(g, teal, x + 40, y + 6, 32, 2); px(g, red, x + 44, y + 1, 24, 1);
    px(g, cream, x, y + 22, 40, 3); px(g, cream, x + 72, y + 22, 40, 3);
    px(g, wine, x, y + 25, 40, 1); px(g, wine, x + 72, y + 25, 40, 1);
    for (const fx of [8, 24, 84, 100]) { px(g, cream, x + fx, y + 26, 4, 32); px(g, '#d9c69d', x + fx + 3, y + 26, 1, 32); }
    for (const wx of [14, 31, 73, 90]) {
      px(g, navy, x + wx, y + 30, 8, 24); px(g, wx === 31 ? P.lit : '#4a6fa5', x + wx + 1, y + 31, 6, 22);
      for (let k = 0; k < 3; k++) px(g, navy, x + wx + 1, y + 36 + k * 6, 6, 1);
    }
    // vertical neon sign
    px(g, red, x + 48, y + 7, 16, 52); px(g, navy, x + 49, y + 8, 14, 50);
    'KINO'.split('').forEach((ch, i) => text(g, ch, x + 53, y + 11 + i * 12, '#ffd978', 2));
    // marquee
    px(g, 'rgba(0,0,0,.22)', x + 12, y + 70, 88, 3);
    px(g, goldS, x + 12, y + 58, 88, 12); px(g, '#fdf6e3', x + 13, y + 60, 86, 8);
    text(g, 'MONDSCHEIN', x + 12 + Math.round((88 - textW('MONDSCHEIN')) / 2), y + 61, navy);
    // doors + posters
    px(g, wine, x, y + 93, w, 3);
    px(g, wine, x + 43, y + 74, 26, 22);
    for (const dx of [45, 57]) {
      px(g, P.glass, x + dx, y + 76, 10, 19); px(g, P.glassL, x + dx + 1, y + 77, 2, 6);
    }
    px(g, P.gold, x + 54, y + 83, 1, 5); px(g, P.gold, x + 57, y + 83, 1, 5);
    const posters = [
      (X, Y) => { px(g, navy, X, Y, 8, 12); disc(g, P.gold, X + 5.5, Y + 3.5, 2); px(g, '#fff', X + 1, Y + 2, 1, 1); px(g, '#0f1630', X, Y + 8, 8, 4); px(g, '#0f1630', X + 2, Y + 7, 3, 1); },
      (X, Y) => { px(g, '#c0392b', X, Y, 8, 12); px(g, '#1a1620', X + 3, Y + 3, 2, 6); px(g, '#1a1620', X + 2, Y + 5, 4, 2); px(g, P.gold, X + 1, Y + 10, 6, 1); },
      (X, Y) => { px(g, teal, X, Y, 8, 12); disc(g, '#f6ecd4', X + 4, Y + 5, 2.6); px(g, '#f6ecd4', X + 1, Y + 10, 6, 1); },
      (X, Y) => { px(g, '#e8703a', X, Y, 8, 12); px(g, '#5a2f6b', X, Y + 7, 8, 5); px(g, '#5a2f6b', X + 1, Y + 5, 2, 2); px(g, '#5a2f6b', X + 5, Y + 4, 2, 3); px(g, '#ffe7a8', X + 3, Y + 2, 2, 2); },
    ];
    [16, 29, 73, 86].forEach((pxo, i) => { px(g, '#d9a441', x + pxo, y + 76, 10, 14); posters[i](x + pxo + 1, y + 77); });
    px(g, shade(red, .5), x, y + 22, 1, 74); px(g, shade(red, .5), x + w - 1, y + 22, 1, 74);
  });
  for (let k = 0; k < 22; k++) { bulbs.push({ x: x + 13 + k * 4, y: y + 58, k }); bulbs.push({ x: x + 13 + k * 4, y: y + 69, k: k + 1 }); }
}

/* ───────────── Landmarks ───────────── */
function lancet(g, x, y, w, h, r) {
  arch(g, P.sandL, x - 1, y - 1, w + 2, h + 1);
  arch(g, '#2a3554', x, y, w, h);
  const cols = ['#e0465b', '#f4d04e', '#3fa6a0', '#6f8fe0', '#2a3554'];
  for (let yy = y + 5; yy < y + h - 2; yy += 3) {
    px(g, pick(cols, r), x, yy, 3, 2); px(g, pick(cols, r), x + w - 3, yy, 3, 2);
  }
}

function church(dx, dy) {
  const X = 432, S = P.sand, SD = P.sandD, SL = P.sandL, SX = P.sandXD;
  block(X + dx, 208 + dy, 144, 80);
  shadows.push([X + dx, 288 + dy, 144, 3]);
  addObjAt(dx, dy, 428, 70, 152, 220, 288, g => {
    const r = rng(303), nx = X + 40, nw = 104;
    // nave roof
    px(g, P.slate, nx, 184, nw, 48);
    for (let yy = 185, k = 0; yy < 230; yy += 3, k++) {
      px(g, P.slateD, nx, yy + 2, nw, 1);
      for (let xx = nx + (k % 2 ? 2 : 0); xx < nx + nw; xx += 4) px(g, shade(P.slate, .92), xx, yy, 1, 2);
    }
    px(g, P.slateL, nx, 184, nw, 2); px(g, shade(P.slateD, .75), nx, 230, nw + 1, 2);
    for (const dx of [nx + 18, nx + 50, nx + 82]) {
      px(g, P.slateD, dx - 1, 203, 8, 2); px(g, P.slateD, dx + 1, 201, 4, 2);
      px(g, SL, dx, 205, 6, 6); px(g, P.glass, dx + 1, 206, 4, 4);
    }
    px(g, P.slateD, nx + 66, 176, 6, 8); px(g, P.slateD, nx + 67, 170, 4, 6);
    px(g, P.slateD, nx + 68, 162, 2, 8); px(g, P.gold, nx + 68, 159, 2, 3);
    // nave wall
    px(g, S, nx, 232, nw, 56); px(g, SD, nx, 232, nw, 2);
    for (let i = 0; i < 50; i++) px(g, r() < .5 ? SD : SL, nx + (r() * (nw - 4) | 0), 236 + (r() * 48 | 0), 4, 1);
    px(g, SX, nx, 285, nw, 3);
    for (let k = 0; k < 5; k++) {
      const bx = nx + k * 21;
      px(g, SL, bx, 236, 4, 52); px(g, SD, bx + 3, 236, 1, 52); px(g, SL, bx, 234, 3, 2);
      lancet(g, bx + 9, 241, 8, 33, r);
    }
    px(g, SL, nx + nw - 4, 236, 4, 52); px(g, SD, nx + nw - 1, 236, 1, 52);
    for (const k of [1, 3]) {                  // little stalls tucked between the buttresses
      const bx = nx + k * 21 + 5;
      px(g, '#6b4630', bx + 1, 277, 14, 11); px(g, '#f8e3a8', bx + 3, 279, 10, 5);
      for (let i = 0; i < 4; i++) px(g, i % 2 ? '#f6ecd4' : (k === 1 ? '#c0392b' : '#2f7f86'), bx + i * 4, 274, 4, 3);
      px(g, '#e0465b', bx + 4, 281, 2, 2); px(g, '#f4a836', bx + 7, 281, 2, 2); px(g, '#7dbb5a', bx + 10, 281, 2, 2);
    }
    // tower
    const tx = X + 4, tw = 36;
    px(g, S, tx, 132, tw, 156); px(g, SL, tx, 132, 4, 156); px(g, SD, tx + tw - 7, 132, 7, 156); px(g, SX, tx + tw - 1, 132, 1, 156);
    for (let yy = 136, k = 0; yy < 284; yy += 7, k++) px(g, SL, tx + 4, yy, 3 + (k % 2) * 2, 2);
    for (const yy of [182, 236]) { px(g, SL, tx - 1, yy, tw + 2, 2); px(g, SX, tx - 1, yy + 2, tw + 2, 1); }
    for (const bx of [tx + 7, tx + 21]) {
      arch(g, SL, bx - 1, 139, 10, 21); arch(g, '#2a1f2b', bx, 140, 8, 20);
      for (let yy = 146; yy < 160; yy += 3) px(g, SD, bx, yy, 8, 1);
    }
    disc(g, P.gold, tx + 18, 171, 7); disc(g, '#f6ecd4', tx + 18, 171, 5.8);
    px(g, '#2a1f2b', tx + 17, 167, 1, 5); px(g, '#2a1f2b', tx + 17, 171, 4, 1);
    lancet(g, tx + 14, 196, 8, 30, r);
    arch(g, SL, tx + 8, 251, 20, 37); arch(g, '#4e3222', tx + 10, 254, 16, 34);
    px(g, '#3a2418', tx + 17, 256, 2, 32); px(g, P.gold, tx + 15, 272, 1, 2); px(g, P.gold, tx + 20, 272, 1, 2);
    px(g, P.stoneL, tx + 6, 286, 24, 2);
    // baroque cap
    let yy = 129;
    px(g, P.slateD, tx - 2, yy, tw + 4, 3);
    const tier = ws => { for (const w of ws) {
      yy -= 2; const lx = tx + (tw - w) / 2;
      px(g, P.slate, lx, yy, w, 2); px(g, P.slateL, lx, yy, Math.max(1, w >> 2), 2);
      px(g, P.slateD, lx + Math.round(w * .7), yy, w - Math.round(w * .7), 2);
    } };
    tier([36, 36, 34, 32, 30, 26, 20, 16, 14]);
    yy -= 10; px(g, SL, tx + 11, yy, 14, 10); px(g, SD, tx + 22, yy, 3, 10);
    px(g, '#2a1f2b', tx + 13, yy + 2, 3, 7); px(g, '#2a1f2b', tx + 19, yy + 2, 3, 7);
    tier([18, 16, 12, 8, 4]);
    px(g, P.slateD, tx + 17, yy - 8, 2, 8); px(g, P.gold, tx + 16, yy - 11, 4, 3);
    px(g, P.gold, tx + 17, yy - 16, 2, 5); px(g, P.gold, tx + 15, yy - 14, 6, 1);
  });
}

function castle(dx, dy) {
  const X = 640, B = 128, S = P.sand, SD = P.sandD, SL = P.sandL, SX = P.sandXD, VOID = '#2a3d33';
  block(X + dx, 32 + dy, 288, 96);
  addObjAt(dx, dy, 636, 0, 296, 130, B, g => {
    const r = rng(99);
    const bricks = (x, y, w, h, n) => { for (let i = 0; i < n; i++) px(g, r() < .55 ? SD : SL, x + (r() * (w - 4) | 0), y + (r() * (h - 2) | 0), 4, 1); };
    const ivy = (cx, cy, n, spread) => { for (let i = 0; i < n; i++) px(g, pick(['#3e7d3a', '#5c9f48', '#2c5f31'], r), cx + (r() + r() - 1) * spread, cy + (r() + r() - 1) * spread * 1.3, 2, 2); };
    const opening = (x, y, w, h, c) => { px(g, SL, x - 1, y - 1, w + 2, h + 1); if (c === VOID) g.clearRect(x, y, w, h); else px(g, c, x, y, w, h); px(g, SL, x, y, 1, 1); px(g, SL, x + w - 1, y, 1, 1); };

    // ruined wing
    { const x = X + 128, w = 92, top = 58;
      for (let hx = x; hx < x + w;) {
        const ww = Math.min(4 + (r() * 8 | 0), x + w - hx), ty = top + (r() * 16 | 0) - 8;
        px(g, S, hx, ty, ww, B - ty); px(g, SL, hx, ty, ww, 1); hx += ww;
      }
      bricks(x, top + 10, w, B - top - 12, 40);
      for (let k = 0; k < 6; k++) {
        const wx = x + 6 + k * 15;
        opening(wx, 66 - (r() < .5 ? 12 : 0), 6, 12 + (r() < .5 ? 6 : 0), VOID);
        opening(wx, 86, 6, 12, VOID);
        opening(wx, 106, 6, 16, k % 2 ? '#3a2a35' : VOID);
      }
      px(g, SL, x, 82, w, 1); px(g, SD, x, 83, w, 1); px(g, SL, x, 102, w, 1); px(g, SD, x, 103, w, 1);
      ivy(x + 20, 112, 40, 12); ivy(x + 70, 96, 30, 9);
    }
    // intact palace with two ornate gables
    { const x = X + 40, w = 88;
      px(g, P.slate, x, 46, w, 18);
      for (let yy = 49; yy < 64; yy += 3) px(g, P.slateD, x, yy, w, 1);
      px(g, P.slateL, x, 46, w, 2);
      px(g, S, x, 64, w, B - 64); px(g, SD, x + w - 3, 64, 3, B - 64);
      for (const gx of [x + 22, x + 66]) {
        let yy = 64;
        for (const ww of [32, 32, 28, 28, 22, 22, 16, 16, 10, 10, 6, 6]) {
          yy -= 2; px(g, SL, gx - ww / 2, yy, ww, 2); px(g, SD, gx + ww / 2 - 1, yy, 1, 2);
        }
        px(g, P.glass, gx - 2, 50, 4, 7); px(g, P.gold, gx - 1, 37, 2, 3);
      }
      for (let k = 0; k < 8; k++) for (const wy of [70, 88, 106]) {
        const wx = x + 5 + k * 11;
        px(g, SL, wx - 1, wy - 1, 8, 12); px(g, P.glass, wx, wy, 6, 10); px(g, P.glassL, wx, wy, 2, 3);
        px(g, SL, wx, wy + 5, 6, 1);
      }
      for (const yy of [84, 102]) { px(g, SL, x, yy, w, 1); px(g, SD, x, yy + 1, w, 1); }
      arch(g, SL, x + 35, 100, 18, 28); arch(g, '#2a1f2b', x + 37, 103, 14, 25);
      px(g, SX, x, B - 3, 35, 3); px(g, SX, x + 53, B - 3, 35, 3);
    }
    // bell tower
    { const x = X + 4;
      px(g, S, x, 40, 36, 88); px(g, SL, x, 40, 8, 88); px(g, SD, x + 26, 40, 10, 88); px(g, SX, x + 34, 40, 2, 88);
      for (const yy of [62, 86, 108]) { px(g, SL, x - 1, yy, 38, 2); px(g, SX, x - 1, yy + 2, 38, 1); }
      for (const wy of [47, 70, 93, 113]) for (const wx of [x + 9, x + 21]) { px(g, SL, wx - 1, wy - 1, 7, 10); px(g, '#3a2a35', wx, wy, 5, 9); }
      px(g, P.slateD, x - 2, 36, 40, 4);
      let yy = 36;
      for (const w of [36, 34, 32, 28, 24, 18, 12]) {
        yy -= 2; const lx = x + (36 - w) / 2;
        px(g, P.slate, lx, yy, w, 2); px(g, P.slateL, lx, yy, Math.max(1, w >> 2), 2); px(g, P.slateD, lx + Math.round(w * .7), yy, w - Math.round(w * .7), 2);
      }
      px(g, SL, x + 14, 14, 8, 8); px(g, '#2a1f2b', x + 16, 16, 4, 6);
      px(g, P.slateD, x + 13, 11, 10, 3); px(g, P.slateD, x + 15, 9, 6, 2); px(g, P.gold, x + 17, 3, 2, 6);
    }
    // thick tower, half blown away
    { const x = X + 220, w = 64;
      for (let i = 0; i < w; i += 4) {
        const c = i < 10 ? SL : i < 38 ? S : i < 54 ? SD : SX;
        const ty = Math.round(34 + (i / w) * 30 + r() * 6 - 3);
        px(g, c, x + i, ty, 4, B - ty); px(g, i < 38 ? SL : S, x + i, ty, 4, 1);
      }
      bricks(x + 2, 60, 40, 64, 30);
      for (let k = 0; k < 14; k++) px(g, SX, x + 26 + (k % 3 === 0 ? 1 : 0), 42 + k * 3, 1, 3);
      for (const [sx, sy] of [[12, 60], [40, 78], [16, 96], [46, 104]]) px(g, '#2a1f2b', x + sx, sy, 2, 7);
      ivy(x + 12, 110, 60, 11); ivy(x + 48, 118, 24, 7);
    }
  });
  // retaining wall below the castle terrace (the stairs are at its left end)
  const wx = 640 + dx;                                    // wall starts under the castle's left edge
  block(wx, 184, 320, 24);
  addObj(wx, 174, 320, 34, 208, g => {
    px(g, P.sand, wx, 186, 320, 22);
    for (let xx = wx; xx < wx + 320; xx += 12) { px(g, P.sandD, xx, 186, 1, 7); px(g, P.sandD, xx + 6, 193, 1, 7); px(g, P.sandD, xx, 200, 1, 6); }
    px(g, P.sandD, wx, 192, 320, 1); px(g, P.sandD, wx, 199, 320, 1); px(g, P.sandXD, wx, 206, 320, 2);
    px(g, P.sandL, wx, 184, 320, 2); px(g, P.sandL, wx, 175, 320, 2);
    for (let xx = wx + 2; xx < wx + 320; xx += 6) px(g, P.sandL, xx, 177, 2, 7);
  });
}

function bridgeGate(dx, dy) {
  const tower = tx => {
    block(tx + dx, 448 + dy, 16, 32);
    addObjAt(dx, dy, tx - 3, 380, 22, 98, 476, g => {
      px(g, '#efe6d2', tx, 424, 16, 44); px(g, '#fbf6ea', tx, 424, 3, 44); px(g, '#d3c7ae', tx + 11, 424, 5, 44);
      px(g, P.sand, tx - 1, 466, 18, 10); px(g, P.sandD, tx + 11, 466, 6, 10); px(g, P.sandL, tx - 1, 466, 18, 1);
      px(g, P.sand, tx, 440, 16, 2); px(g, P.glass, tx + 6, 430, 3, 6); px(g, P.glass, tx + 6, 447, 3, 7);
      px(g, '#333c4f', tx - 2, 420, 20, 4);
      let yy = 420;
      for (const w of [16, 16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2, 2, 2]) {
        yy -= 2; px(g, '#3d4658', tx + 8 - w / 2, yy, w, 2); px(g, '#56617a', tx + 8 - w / 2, yy, Math.max(1, w >> 2), 2);
      }
      px(g, P.gold, tx + 7, yy - 3, 2, 3);
    });
  };
  tower(464); tower(528);
  addObjAt(dx, dy, 478, 418, 52, 30, 476, g => {
    px(g, '#333c4f', 478, 420, 52, 3);
    px(g, P.sand, 480, 423, 48, 12); px(g, P.sandL, 480, 423, 48, 1); px(g, P.sandD, 480, 433, 48, 2);
    px(g, P.sand, 480, 435, 10, 3); px(g, P.sand, 518, 435, 10, 3);
    px(g, P.sand, 480, 438, 5, 3); px(g, P.sand, 523, 438, 5, 3);
    px(g, P.sand, 480, 441, 2, 4); px(g, P.sand, 526, 441, 2, 4);
    px(g, P.sandXD, 499, 425, 10, 6); px(g, P.gold, 501, 426, 6, 4);
  });
}

function fountain(cx, cy) {
  const x = cx - 16, y = cy - 8;
  block(x, y, 32, 16);
  shadows.push([x + 2, y + 16, 28, 2]);
  addObj(x, y - 20, 32, 38, y + 16, g => {
    px(g, P.stoneD, x + 4, y, 24, 16); px(g, P.stoneD, x, y + 4, 32, 8); px(g, P.stoneD, x + 2, y + 2, 28, 12);
    px(g, P.stoneL, x + 4, y, 24, 13); px(g, P.stoneL, x, y + 4, 32, 6); px(g, P.stoneL, x + 2, y + 2, 28, 10);
    px(g, P.water, x + 5, y + 2, 22, 9); px(g, P.water, x + 3, y + 4, 26, 5); px(g, P.waterL, x + 7, y + 4, 6, 1);
    px(g, P.stone, cx - 2, y - 8, 4, 16); px(g, P.stoneL, cx - 2, y - 8, 1, 16);
    px(g, P.stoneD, cx - 4, y - 2, 8, 2); px(g, P.stoneD, cx - 3, y - 10, 6, 2);
    // the lion on top
    px(g, P.gold, cx - 3, y - 14, 6, 3); px(g, P.gold, cx + 1, y - 17, 3, 4); px(g, P.gold, cx - 4, y - 16, 1, 3);
    px(g, P.gold, cx - 3, y - 11, 1, 1); px(g, P.gold, cx + 2, y - 11, 1, 1);
  });
}
/* the Old University on the north side of the square */
function oldUniversity(dx, dy) {
  const x = 416, B = 448, w = 192, cx = x + w / 2, wall = '#efe2c8', S = P.sand, SD = P.sandD, SL = P.sandL;
  block(x + dx, 368 + dy, w, 80);
  shadows.push([x + dx, B + dy, w, 3]);
  addObjAt(dx, dy, x - 4, 300, w + 8, 150, B, g => {
    // hipped slate roof with dormers
    for (let i = 0; i < 42; i++) {
      const inset = Math.round((41 - i) * 22 / 41), yy = 338 + i;
      px(g, i % 3 === 2 ? P.slateD : P.slate, x - 2 + inset, yy, w + 4 - inset * 2, 1);
      px(g, P.slateD, x + w - 8 - inset, yy, 10, 1); px(g, P.slateL, x - 2 + inset, yy, 2, 1);
    }
    px(g, P.slateL, x + 20, 338, w - 40, 2);
    for (let k = 0; k < 6; k++) {
      const dx = x + 22 + k * 28 + (k > 2 ? 4 : 0);
      px(g, P.slateD, dx - 1, 360, 10, 2); px(g, P.slateD, dx + 2, 358, 4, 2);
      px(g, wall, dx, 362, 8, 8); px(g, P.glass, dx + 2, 363, 4, 6);
    }
    // bell turret on the ridge
    px(g, wall, cx - 5, 322, 10, 16); px(g, shade(wall, .82), cx + 2, 322, 3, 16); px(g, '#2a1f2b', cx - 2, 326, 4, 8);
    px(g, P.slateD, cx - 7, 319, 14, 3); px(g, P.slate, cx - 5, 316, 10, 3); px(g, P.slate, cx - 3, 313, 6, 3);
    px(g, P.slateD, cx - 1, 307, 2, 6); px(g, P.gold, cx - 1, 304, 2, 3);
    // plastered facade with sandstone trim
    px(g, shade(P.slateD, .75), x - 3, 379, w + 6, 2);
    px(g, wall, x, 381, w, 67); px(g, shade(wall, .9), x, 381, w, 2);
    for (const yy of [401, 423]) { px(g, SL, x, yy, w, 1); px(g, S, x, yy + 1, w, 1); }
    px(g, SD, x, B - 6, w, 6); px(g, S, x, B - 6, w, 1);
    for (const o of [0, 82, 104, w - 6]) { px(g, S, x + o, 381, 6, 61); px(g, SL, x + o, 381, 2, 61); px(g, SD, x + o + 5, 381, 1, 61); }
    const win = (wx, wy, hh) => {
      px(g, SL, wx - 1, wy - 1, 8, hh + 2); px(g, P.glass, wx, wy, 6, hh);
      px(g, P.glassL, wx, wy, 2, 3); px(g, P.frame, wx, wy + (hh >> 1), 6, 1);
    };
    for (const wy of [385, 407, 427]) for (let k = 0; k < 5; k++) { win(x + 11 + k * 15, wy, 12); win(x + 115 + k * 15, wy, 12); }
    // centre bay: tall windows, balcony, portal, pediment
    win(cx - 3, 385, 12); win(cx - 3, 405, 10);
    px(g, SD, cx - 10, 416, 20, 2); px(g, SL, cx - 10, 415, 20, 1); px(g, SD, cx - 10, 410, 20, 1);
    for (let k = 0; k < 6; k++) px(g, SD, cx - 10 + k * 4 - (k === 5 ? 1 : 0), 410, 1, 5);
    roundArch(g, SL, cx - 8, 420, 16, 28); roundArch(g, '#4e3222', cx - 6, 422, 12, 26);
    px(g, '#3a2418', cx - 1, 424, 2, 24); px(g, P.gold, cx - 3, 435, 1, 2); px(g, P.gold, cx + 2, 435, 1, 2);
    for (let i = 0; i < 10; i++) { const half = 2 + Math.round(i * 1.5); px(g, SL, cx - half, 369 + i, half * 2, 1); px(g, S, cx - half, 369 + i, 1, 1); px(g, SD, cx + half - 1, 369 + i, 1, 1); }
    px(g, P.gold, cx - 2, 373, 4, 3);
    px(g, P.stoneL, cx - 11, B - 2, 22, 2);
    px(g, shade(wall, .5), x, 381, 1, 67); px(g, shade(wall, .5), x + w - 1, 381, 1, 67);
  });
}
function lamp(x, by) {
  addObj(x - 3, by - 24, 7, 24, by, g => {
    const d = '#2a2f3a';
    px(g, d, x, by - 16, 1, 16); px(g, d, x - 1, by - 1, 3, 1); px(g, d, x - 2, by - 23, 5, 1);
    px(g, '#ffd978', x - 2, by - 22, 5, 5); px(g, '#fff6c8', x - 1, by - 21, 3, 3);
    px(g, d, x - 2, by - 17, 5, 1); px(g, d, x - 3, by - 22, 1, 5); px(g, d, x + 3, by - 22, 1, 5);
  });
}
function bench(x, by) {
  block(x, by - 8, 16, 8);
  addObj(x, by - 10, 16, 10, by, g => {
    px(g, '#7a5236', x, by - 10, 16, 2); px(g, '#8f6243', x, by - 7, 16, 3); px(g, '#5a3a28', x, by - 4, 16, 1);
    px(g, '#3a2a2e', x + 1, by - 3, 2, 3); px(g, '#3a2a2e', x + 13, by - 3, 2, 3);
  });
}

/* ───────────── Build the town ───────────── */
/* trees over the whole mountain, leaving the castle, the trail and the rock ledges clear */
function mountainWoods() {
  const r = rng(31);
  const nearTrail = (x, y) => TRAILS.some(([tx, ty, tw, th]) => x > tx - 8 && x < tx + tw + 8 && y > ty - 3 && y < ty + th + 21);
  for (let yy = 100, row = 0; yy < 320; yy += 9, row++)
    for (let xx = 4 + (row % 2 ? 6 : 0); xx < W; xx += 13) {
      const x = Math.round(xx + r() * 4 - 2), y = Math.round(yy + r() * 4 - 2);
      const img = pick(r() < .35 ? FIRS : ROUNDS, r);
      if (y < ridge(x) + 4) continue;                                  // above the ridge is sky
      if (x > PEAK - 160 && x < PEAK + 160 && y < 214) continue;       // castle and terrace
      if (nearTrail(x, y)) continue;
      if (LEDGES.some(f => f(x) >= ridge(x) + 10 && y > f(x) - 2 && y < f(x) + 23)) continue;
      addSprite(img, x - 10, y - 28, y);
    }
}

/* a dark outline around a sprite, like a sticker — marks the places you can enter */
function outline(ob, col, t) {
  const mask = mk(ob.w, ob.h), m = mask.getContext('2d');
  m.drawImage(ob.img, 0, 0); m.globalCompositeOperation = 'source-in'; m.fillStyle = col; m.fillRect(0, 0, ob.w, ob.h);
  const c = mk(ob.w + t * 2, ob.h + t * 2), g = c.getContext('2d');
  for (let dx = -t; dx <= t; dx++) for (let dy = -t; dy <= t; dy++) if (dx * dx + dy * dy <= t * t + 1) g.drawImage(mask, t + dx, t + dy);
  g.drawImage(ob.img, t, t);
  ob.img = c; ob.x -= t; ob.y -= t; ob.w += t * 2; ob.h += t * 2;
}
/* a coloured half-round patch of ground in front of a story place */
function forecourt(cx, cy, rx, ry, col) {
  for (let yy = 0; yy < ry; yy++) {
    const half = Math.round(rx * Math.sqrt(1 - (yy / ry) ** 2));
    b.globalAlpha = .32; px(b, col, cx - half, cy + yy, half * 2, 1);
    b.globalAlpha = .9; px(b, col, cx - half, cy + yy, 2, 1); px(b, col, cx + half - 2, cy + yy, 2, 1);
  }
  b.globalAlpha = 1;
}

function build() {
  paintTerrain();
  const [RY, RH] = LAYOUT.river, BX = LAYOUT.bridge, BKY = RY + RH;

  // edges of the world
  block(0, 0, 16, H); block(W - 16, 0, 16, H);
  block(16, RY, BX - 16, RH); block(BX + 48, RY, W - 64 - BX, RH);   // river (bridge deck stays open)
  block(0, 0, W, 320);                                               // the mountain …
  for (const [x, y, w, h] of TRAILS) block(x, y, w, h, 0);           // … except the trail up to the castle

  // woods
  mountainWoods();
  forest(16, BKY + 64, W - 32, 32, 10, .15);
  forest(0, 320, 16, RY - 320, 11); forest(W - 16, 320, 16, RY - 320, 12);
  forest(0, BKY, 16, 96, 13); forest(W - 16, BKY, 16, 96, 14);

  // a handful of houses, with room between them
  for (const [street, segs, seed, heights] of LAYOUT.houses) rowHouses(street, segs, seed, heights);
  bookstore(); cinema(); vinylShop();
  for (const id in shopGeo) shopObjs[id] = objs.find(o => o.x === shopGeo[id].x - 2 && o.y === shopGeo[id].y - 10);

  // landmarks
  castle(...LAYOUT.castle); oldUniversity(...LAYOUT.uni); church(...LAYOUT.church); bridgeGate(BX - 480, RY - 464);
  fountain(...LAYOUT.fountain);
  for (const [x, y] of LAYOUT.lamps) lamp(x, y);
  for (const [x, y] of LAYOUT.benches) bench(x, y);
  for (const [x, y] of LAYOUT.trees) tree(x, y, false);

  // flatten everything onto the base map, back to front
  for (const [x, y, w, h] of shadows) px(b, 'rgba(30,20,40,.2)', x, y, w, h);
  // tone down the colours of the terrain and of every sprite
  // (the three story places keep their full colour so they stand out)
  muteCanvas(base);
  const loud = new Set(Object.values(shopObjs).map(o => o.img));
  for (const img of new Set(objs.map(o => o.img))) if (!loud.has(img)) muteCanvas(img);
  for (const s of SHOPS) {
    const geo = shopGeo[s.id];
    forecourt(geo.x + geo.w / 2, geo.y + geo.h + 1, geo.w / 2 + 8, 14, s.accent);
    outline(shopObjs[s.id], P.out, 2);
  }
  objs.sort((a, c) => a.baseY - c.baseY);
  for (const ob of objs) b.drawImage(ob.img, ob.x, ob.y);
}
build();

const shops = SHOPS.map(s => ({ ...s, ...shopGeo[s.id], found: false, obj: shopObjs[s.id] }));

/* ───────────── Icons — drawn by icons.js ───────────── */
const drawIcon = window.drawShopIcon;
function iconEl(id) {
  const c = mk(16, 16);
  c.setAttribute('aria-hidden', 'true');
  drawIcon(c.getContext('2d'), id);
  return c;
}

/* ───────────── The spirit (you) ─────────────
   A little ghost doodle: a round head and three legs. It collects stories. */
const p = { x: LAYOUT.start[0], y: LAYOUT.start[1], dir: 'd', walk: 0, moving: false };
let route = null, stuck = 0, lastRouted = 0;   // route = list of points the spirit is walking along

function canStand(x, y) {
  return !isSolid(x - 4, y - 5) && !isSolid(x + 3, y - 5) && !isSolid(x - 4, y - 1) && !isSolid(x + 3, y - 1);
}

/* Tap or click to walk: search the collision grid for a way there (around
   buildings, over the bridge, up the castle stairs). If the spot itself cannot
   be reached, go to the nearest place that can. */
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cellFree = (i, j) => i >= 0 && j >= 0 && i < CW && j < CH && !solid[j * CW + i];
function findRoute(tx, ty) {
  const N = CW * CH, prev = new Int32Array(N).fill(-1), queue = new Int32Array(N);
  const start = ((p.y - 3) / CELL | 0) * CW + (p.x / CELL | 0);
  let head = 0, tail = 0, best = start, bestD = Infinity;
  prev[start] = start; queue[tail++] = start;
  while (head < tail) {
    const c = queue[head++], ci = c % CW, cj = c / CW | 0;
    const d = (ci * CELL + 4 - tx) ** 2 + (cj * CELL + 6 - ty) ** 2;
    if (d < bestD) { bestD = d; best = c; }
    for (const [dx, dy] of STEPS) {
      const ni = ci + dx, nj = cj + dy;
      if (!cellFree(ni, nj) || (dx && dy && (!cellFree(ni, cj) || !cellFree(ci, nj)))) continue;   // no cutting corners
      const n = nj * CW + ni;
      if (prev[n] === -1) { prev[n] = c; queue[tail++] = n; }
    }
  }
  const pts = [];
  for (let c = best; c !== start; c = prev[c]) pts.push({ x: (c % CW) * CELL + 4, y: (c / CW | 0) * CELL + 6 });
  pts.reverse();
  if (bestD < 60 && canStand(tx, ty)) pts.push({ x: tx, y: ty });        // finish exactly where you tapped
  return pts.length ? pts : null;
}
/* can the spirit walk straight from a to b without bumping into anything? */
function clearLine(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
  for (let k = 1; k <= n; k++) if (!canStand(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
  return true;
}
function walkTo(pt) { route = findRoute(pt.x, pt.y); stuck = 0; lastRouted = time; }

const SPIRIT_ROWS = [5, 9, 11, 13, 13, 13, 13, 13, 13, 13, 13];   // width of the head, row by row
function drawSpirit(g, x, y, dir, moving, t) {
  const ink = '#2a1f2b', white = '#fffdf6', soft = '#d6e0ee';
  const top = y - 20 + Math.round(Math.sin(t * (moving ? 10 : 3)));          // it floats and bobs
  const legs = [-5, -1, 3].map((lx, i) => [lx, 3 + (moving ? Math.round(Math.sin(t * 14 + i * 2.1) + 1) : i === 1 ? 1 : 0)]);
  // little lights for the stories it has collected circle around it
  const orbs = shops.filter(s => s.found).map((s, i) => {
    const a = t * 1.7 + i * 2.094;
    return { x: Math.round(x + Math.cos(a) * 11), y: Math.round(top + 5 + Math.sin(a) * 5), front: Math.sin(a) > 0, c: s.accent };
  });
  const orb = o => { px(g, ink, o.x - 2, o.y - 1, 5, 3); px(g, ink, o.x - 1, o.y - 2, 3, 5); px(g, o.c, o.x - 1, o.y - 1, 3, 3); px(g, '#fff', o.x - 1, o.y - 1, 1, 1); };

  px(g, 'rgba(0,0,0,.2)', x - 4, y - 1, 9, 2);
  orbs.filter(o => !o.front).forEach(orb);
  // outline, then body
  px(g, ink, x - 2, top - 1, 5, 1);
  SPIRIT_ROWS.forEach((w, i) => px(g, ink, x - (w - 1) / 2 - 1, top + i, w + 2, 1));
  for (const [lx, len] of legs) px(g, ink, x + lx - 1, top + 11, 5, len + 1);
  SPIRIT_ROWS.forEach((w, i) => px(g, white, x - (w - 1) / 2, top + i, w, 1));
  px(g, soft, x + 4, top + 3, 2, 8);
  for (const [lx, len] of legs) { px(g, white, x + lx, top + 11, 3, len); px(g, soft, x + lx + 2, top + 11, 1, len); }
  // face
  if (dir !== 'u') {
    const ex = dir === 'l' ? -2 : dir === 'r' ? 2 : 0, blink = t % 4 < .12;
    px(g, ink, x - 3 + ex, top + (blink ? 5 : 4), 2, blink ? 1 : 3); px(g, ink, x + 2 + ex, top + (blink ? 5 : 4), 2, blink ? 1 : 3);
    px(g, '#f4a8b8', x - 5 + ex, top + 8, 2, 1); px(g, '#f4a8b8', x + 4 + ex, top + 8, 2, 1);
    px(g, ink, x + ex, top + 8, 1, 1);
  }
  orbs.filter(o => o.front).forEach(orb);
}

/* ───────────── Screen and zoom ───────────── */
const cv = $('game'), ctx = cv.getContext('2d');
let zoom = 3, vw = 0, vh = 0, camX = 0, camY = 0;
const MAX_ZOOM = 8;
const fitZoom = () => Math.min(innerWidth / W, innerHeight / H);                      // whole city on screen
const homeZoom = () => Math.max(2, Math.min(Math.round(innerWidth / 400), Math.floor(innerHeight / 170)));
const wholeCity = () => zoom <= fitZoom() * 1.05;
function setZoom(z) {
  zoom = Math.max(fitZoom(), Math.min(MAX_ZOOM, z));
  const w = Math.ceil(innerWidth / zoom), h = Math.ceil(innerHeight / zoom);
  if (w !== vw || h !== vh) { vw = w; vh = h; cv.width = w; cv.height = h; ctx.imageSmoothingEnabled = false; }
  cv.style.width = vw * zoom + 'px'; cv.style.height = vh * zoom + 'px';
  $('view').textContent = wholeCity() ? 'Close up' : 'Whole city';
  $('labels').className = zoom < .8 ? 'tiny' : zoom < 1.7 ? 'short' : '';   // far out: icons only
}
const toggleView = () => setZoom(wholeCity() ? homeZoom() : fitZoom());
addEventListener('resize', () => {
  // turning the phone switches between the tall and the wide town: load the other one
  if (!forcedLayout && matchMedia(PORTRAIT_PHONE).matches !== TALL) { location.reload(); return; }
  setZoom(zoom);
});
setZoom(homeZoom());

/* ───────────── UI: list of places, name tags, tooltip, intro ───────────── */
let paused = true, time = 0, hover = null;

// remember which places were visited while you are away on a story page
const STORE_KEY = 'heidelbrueck';
const saved = (() => { try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } })();
let celebrated = !!saved.celebrated;
for (const s of shops) s.found = (saved.found || []).includes(s.id);
function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ found: shops.filter(s => s.found).map(s => s.id), celebrated }));
  } catch (e) { /* storage unavailable — the town still works */ }
}

/* going into a place opens its own page (store.html) */
function enterShop(s) {
  s.found = true; save();
  location.href = `store.html?shop=${s.id}`;
}

/* one link per place, used twice: in the list (legend) and as a name tag on the map */
function placeLink(s) {
  const a = document.createElement('a');
  a.className = 'stop';
  a.href = `store.html?shop=${s.id}`;
  a.style.setProperty('--c', s.accent);
  a.setAttribute('aria-label', `${s.kind}. ${s.action}. Go inside.`);
  const chip = document.createElement('span'); chip.className = 'chip'; chip.append(iconEl(s.id));
  const txt = document.createElement('span'); txt.className = 'txt';
  const name = document.createElement('b'); name.textContent = s.kind;
  const what = document.createElement('small'); what.textContent = s.action;
  txt.append(name, what);
  const done = document.createElement('span'); done.className = 'done'; done.textContent = '✓'; done.title = 'Visited';
  a.append(chip, txt, done);
  a.addEventListener('click', e => { e.preventDefault(); enterShop(s); });
  return a;
}
const legendEls = {}, tagEls = {};
for (const s of shops) {
  const li = document.createElement('li');
  li.append(legendEls[s.id] = placeLink(s));
  $('legend').append(li);
  tagEls[s.id] = placeLink(s);
  tagEls[s.id].classList.add('tag');
  $('labels').append(tagEls[s.id]);
}
function updateHud() {
  const n = shops.filter(s => s.found).length;
  $('count').textContent = `Visited ${n} of ${shops.length}`;
  for (const s of shops) { legendEls[s.id].classList.toggle('found', s.found); tagEls[s.id].classList.toggle('found', s.found); }
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 7000);
}
function celebrate() {
  if (celebrated || !shops.every(s => s.found)) return;
  celebrated = true; save();
  toast('You visited all three places. Well done!');
}
function start() { $('intro').classList.add('gone'); document.body.classList.add('playing'); paused = false; }
$('start').addEventListener('click', start);
$('view').addEventListener('click', e => { toggleView(); e.currentTarget.blur(); });
$('zoom-in').addEventListener('click', e => { setZoom(zoom * 1.3); e.currentTarget.blur(); });
$('zoom-out').addEventListener('click', e => { setZoom(zoom / 1.3); e.currentTarget.blur(); });
$('list-toggle').addEventListener('click', e => {
  const open = $('panel').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', open);
  e.currentTarget.textContent = open ? 'Close' : 'Places';
});
if (innerWidth <= 640 || innerHeight <= 480) { $('panel').classList.remove('open'); $('list-toggle').setAttribute('aria-expanded', 'false'); } else $('list-toggle').textContent = 'Close';   // phones: list starts folded

const tip = $('tip');
function showTip(s, e) {
  if (hover !== s) {
    hover = s;
    $('tip-name').textContent = s.name;
    $('tip-kind').textContent = `${s.kind} · ${s.action}`;
    $('tip-go').textContent = 'Click to go inside';
    tip.style.setProperty('--c', s.accent);
    tip.hidden = false;
  }
  placeTip(e);
}
function placeTip(e) {
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX + 16)) + 'px';
  tip.style.top = (e.clientY + 22 + hh > innerHeight ? e.clientY - hh - 12 : e.clientY + 22) + 'px';
}
function hideTip() { hover = null; tip.hidden = true; }

const TOUCH = matchMedia('(pointer: coarse)').matches;
$('hint').addEventListener('click', () => { const s = nearShop(); if (s) enterShop(s); });

/* ───────────── Partner boats ─────────────
   Six boats lie still on the river, one per partner (see SPONSORS in stories.js).
   On each, someone holds up a sign. The boat is pixel art; the logo on the sign is
   the real image laid over the map, so it stays sharp and is a link. */
const sponsors = window.SPONSORS || [];
const BOAT_W = 84, BOAT_H = 58, SIGN_W = 64, SIGN_H = 25, SIGN_X = 10;
const BOAT_SPOTS = LAYOUT.boats;
const HULLS = ['#b5492f', '#2f7f86', '#e3b23c', '#3d5a80', '#59a36a', '#7d4f8f'];
function makeBoat(i) {
  const c = mk(BOAT_W, BOAT_H), g = c.getContext('2d'), r = rng(900 + i * 7), col = HULLS[i % HULLS.length];
  const white = '#f8f4ec', ink = P.out, cx = BOAT_W / 2;
  // hull: flat stern on the left, bow rising on the right
  const deckY = x => 46 - (x > BOAT_W - 30 ? Math.round(((x - (BOAT_W - 30)) / 30) ** 2 * 4) : 0);
  const inHull = (x, y) => y >= deckY(x) && y < BOAT_H && x >= 2 + Math.round(Math.max(0, y - 48) * .5) && x <= BOAT_W - 1 - Math.round(Math.max(0, y - 42) * 1.3);
  for (let y = 40; y < BOAT_H; y++) for (let x = 0; x < BOAT_W; x++) {
    if (!inHull(x, y)) continue;
    const edge = !inHull(x - 1, y) || !inHull(x + 1, y) || !inHull(x, y - 1), d = y - deckY(x);
    px(g, edge ? ink : y >= BOAT_H - 2 ? shade(col, .55) : d < 3 ? shade(col, 1.25) : d === 5 || d === 6 ? white : col, x, y);
  }
  // a little cabin at the stern on every other boat, a crate on the rest
  if (i % 2) {
    px(g, ink, 7, 33, 22, 14); px(g, white, 8, 34, 20, 12); px(g, shade(col, .8), 6, 31, 24, 3);
    px(g, '#2a3c55', 11, 37, 6, 5); px(g, '#2a3c55', 19, 37, 6, 5); px(g, '#8fb6d9', 11, 37, 2, 1); px(g, '#8fb6d9', 19, 37, 2, 1);
  } else {
    px(g, ink, 9, 38, 14, 9); px(g, '#8f6243', 10, 39, 12, 7); px(g, '#6b4630', 10, 42, 12, 1); px(g, '#6b4630', 15, 39, 1, 7);
  }
  // crew
  const skins = ['#f2c9a0', '#d9a273', '#a9714b', '#7a4a30', '#e8b98f'], hairs = ['#2a1f2b', '#4a2f24', '#8a5a2b', '#c9a24a', '#5a5a66', '#b8552f'];
  const tops = ['#c0392b', '#2f7f86', '#e3b23c', '#7d4f8f', '#3d5a80', '#59a36a', '#e8703a', '#d86a8f'].filter(t => t !== col);
  const person = (x, holding, small) => {
    const sk = pick(skins, r), hr = pick(hairs, r), tp = pick(tops, r), top = small ? 36 : 31;
    px(g, ink, x - 3, top - 1, 6, 6);
    px(g, hr, x - 2, top, 4, 2); px(g, sk, x - 2, top + 2, 4, 3); px(g, ink, x - 1, top + 3, 1, 1); px(g, ink, x + 1, top + 3, 1, 1);
    if (r() < .35) { const hat = pick(tops, r); px(g, hat, x - 3, top, 6, 1); px(g, hat, x - 2, top - 1, 4, 1); }
    px(g, ink, x - 4, top + 5, 8, 47 - top - 5); px(g, tp, x - 3, top + 5, 6, 46 - top - 5); px(g, shade(tp, .78), x + 1, top + 5, 2, 46 - top - 5);
    if (holding) for (const ax of [x - 5, x + 4]) { px(g, '#6b4630', ax, SIGN_H, 1, top - 1 - SIGN_H); px(g, sk, ax, top - 2, 1, 2); px(g, tp, ax, top, 1, 7); }
    else { px(g, tp, x + 3, top + 4, 2, 2); px(g, tp, x + 4, top + 2, 1, 3); px(g, sk, x + 4, top, 1, 2); }             // waving
  };
  person(cx + 18, false, r() < .5);
  person(cx, true, false);
  // low railing, then the bow flag
  for (let x = 30; x < BOAT_W - 14; x += 5) px(g, white, x, deckY(x) - 3, 1, 3);
  px(g, ink, 30, 42, BOAT_W - 44, 1);
  px(g, ink, BOAT_W - 6, deckY(BOAT_W - 6) - 9, 1, 9); px(g, white, BOAT_W - 11, deckY(BOAT_W - 6) - 9, 5, 3);
  muteCanvas(c);
  px(g, ink, SIGN_X, 0, SIGN_W, SIGN_H); px(g, '#fffdf8', SIGN_X + 1, 1, SIGN_W - 2, SIGN_H - 2);   // clean white sign for the logo
  return c;
}
const boats = sponsors.slice(0, BOAT_SPOTS.length).map((sp, i) => {
  const a = document.createElement('a');
  a.className = 'sponsor';
  a.href = sp.url; a.target = '_blank'; a.rel = 'noreferrer';
  a.setAttribute('aria-label', `${sp.role}: ${sp.name}. Opens their website.`);
  const img = document.createElement('img');
  img.src = sp.logo; img.alt = ''; img.draggable = false;
  a.append(img);
  a.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    hover = null;
    $('tip-name').textContent = sp.name; $('tip-kind').textContent = sp.role; $('tip-go').textContent = 'Click to open their website';
    tip.style.setProperty('--c', '#3f86c0'); tip.hidden = false;
    placeTip(e);
  });
  a.addEventListener('pointerleave', hideTip);
  $('fleet').append(a);
  return { el: a, img: makeBoat(i), x: BOAT_SPOTS[i][0] - BOAT_W / 2, y: BOAT_SPOTS[i][1] - BOAT_H };
});

/* ───────────── Input ───────────── */
const keys = new Set();
const MOVE = { arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd', arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r' };
const nearShop = () => shops.find(s => Math.abs(p.x - s.door.x) < 18 && p.y - s.door.y < 26 && p.y - s.door.y > -4);

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const onControl = e.target instanceof Element && e.target.closest('a, button');     // let links and buttons use Enter / Space
  if (paused) { if ((k === 'enter' || k === ' ') && !onControl) { e.preventDefault(); start(); } return; }
  if (MOVE[k]) { keys.add(MOVE[k]); e.preventDefault(); }
  if (k === 'm') toggleView();
  if (k === '+' || k === '=') setZoom(zoom * 1.3);
  if (k === '-' || k === '_') setZoom(zoom / 1.3);
  if ((k === 'e' || k === 'enter' || k === ' ') && !onControl) {
    e.preventDefault();
    const s = nearShop();
    if (s) enterShop(s);
  }
});
addEventListener('keyup', e => { const k = MOVE[e.key.toLowerCase()]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

const toWorld = e => {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / zoom + camX, y: (e.clientY - r.top) / zoom + camY };
};
const shopAt = pt => shops.find(s => pt.x >= s.x && pt.x < s.x + s.w && pt.y >= s.y && pt.y < s.y + s.h);

// one finger or the mouse: walk / go inside.  two fingers: pinch to zoom.
const fingers = new Map();
let pinch = null, tap = null;
const spread = () => { const [a, c] = [...fingers.values()]; return Math.hypot(a.x - c.x, a.y - c.y) || 1; };
cv.addEventListener('pointerdown', e => {
  if (paused) return;
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size === 2) { pinch = { d: spread(), z: zoom }; route = null; tap = null; return; }
  const pt = toWorld(e);
  tap = { id: e.pointerId, x: e.clientX, y: e.clientY, shop: shopAt(pt), drag: false };
  if (!tap.shop) walkTo(pt);
});
cv.addEventListener('pointermove', e => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && fingers.size === 2) { setZoom(pinch.z * spread() / pinch.d); return; }
  if (tap && tap.id === e.pointerId) {            // finger or mouse button held down and moving: keep steering
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 12) tap.drag = true;
    if (tap.drag && time - lastRouted > .12) walkTo(toWorld(e));
  }
  const s = paused ? null : shopAt(toWorld(e));
  cv.style.cursor = s ? 'pointer' : 'default';
  if (s && e.pointerType === 'mouse') showTip(s, e); else hideTip();
});
function lift(e) {
  fingers.delete(e.pointerId);
  if (fingers.size < 2) pinch = null;
  if (!tap || tap.id !== e.pointerId) return;
  const s = tap.shop, still = !tap.drag;
  tap = null;
  if (e.type === 'pointerup' && s && still && shopAt(toWorld(e)) === s) enterShop(s);
}
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
cv.addEventListener('pointerleave', hideTip);

// mouse wheel and trackpad pinch
addEventListener('wheel', e => {
  if (paused) return;
  e.preventDefault();
  setZoom(zoom * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0018)));
}, { passive: false });
// Safari trackpad pinch
let gestureZoom = 0;
addEventListener('gesturestart', e => { e.preventDefault(); gestureZoom = zoom; });
addEventListener('gesturechange', e => { e.preventDefault(); if (!paused) setZoom(gestureZoom * e.scale); });

/* ───────────── Loop ───────────── */
let hintText = '';
function update(dt) {
  if (paused) { p.moving = false; return; }
  let dx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), dy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
  if (dx || dy) route = null;
  else if (route) {
    while (route.length > 1 && clearLine(p.x, p.y, route[1].x, route[1].y)) route.shift();   // skip corners we can already see past
    const tx = route[0].x - p.x, ty = route[0].y - p.y, d = Math.hypot(tx, ty);
    if (d < 2) { route.shift(); if (!route.length) route = null; } else { dx = tx / d; dy = ty / d; }
  }
  p.moving = !!(dx || dy);
  if (p.moving) {
    const len = Math.hypot(dx, dy), sx = dx / len * SPEED * dt, sy = dy / len * SPEED * dt;
    const ox = p.x, oy = p.y;
    if (canStand(p.x + sx, p.y)) p.x += sx;
    if (canStand(p.x, p.y + sy)) p.y += sy;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
    p.walk += dt;
    if (route) {
      stuck = Math.hypot(p.x - ox, p.y - oy) < SPEED * dt * .3 ? stuck + dt : 0;
      if (stuck > .4) route = null;
    }
  } else p.walk = 0;

  const s = nearShop();
  const h = s ? `${TOUCH ? 'Tap here' : 'Press E'} to go into the ${s.kind.toLowerCase()}` : '';
  if (h !== hintText) { hintText = h; $('hint').textContent = h; $('hint').hidden = !h; if (s) $('hint').style.setProperty('--c', s.accent); }
}

const FX = { shimmer: tint(P.waterL), swan: tint('#fdfaf2'), beak: tint('#f4a836'), spray: tint('#e8f6ff') };
function render() {
  const X = Math.round(p.x), Y = Math.round(p.y);
  camX = vw >= W ? Math.round((W - vw) / 2) : Math.max(0, Math.min(W - vw, X - (vw >> 1)));
  camY = vh >= H ? Math.round((H - vh) / 2) : Math.max(0, Math.min(H - vh, Y - 10 - (vh >> 1)));
  ctx.fillStyle = '#1b1420'; ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(base, -camX, -camY);
  ctx.save(); ctx.translate(-camX, -camY);

  // river sparkles + swans
  for (const s of shimmer) if (Math.sin(time * 1.6 + s.ph) > .45) px(ctx, FX.shimmer, s.x + Math.round(Math.sin(time * .4 + s.ph) * 2), s.y, s.w, 1);
  for (const [sx, sy, ph] of LAYOUT.swans) {
    const x = Math.round(sx + Math.sin(time * .22 + ph) * 14), y = Math.round(sy + Math.sin(time * .9 + ph)), right = Math.cos(time * .22 + ph) > 0;
    px(ctx, 'rgba(20,40,80,.25)', x - 3, y + 2, 7, 1);
    px(ctx, FX.swan, x - 3, y, 6, 2); px(ctx, FX.swan, right ? x + 3 : x - 4, y - 3, 1, 4);
    px(ctx, FX.beak, right ? x + 4 : x - 5, y - 3, 1, 1);
  }
  // partner boats (they lie still), each with a faint reflection
  for (const bt of boats) {
    ctx.save(); ctx.globalAlpha = .2; ctx.translate(bt.x, bt.y + BOAT_H * 1.2); ctx.scale(1, -.2);
    ctx.drawImage(bt.img, 0, 0); ctx.restore();
    px(ctx, 'rgba(20,40,80,.3)', bt.x + 4, bt.y + BOAT_H - 1, BOAT_W - 22, 2);
    ctx.drawImage(bt.img, bt.x, bt.y);
  }
  // cinema marquee lights
  const tick = Math.floor(time * 5);
  for (const bl of bulbs) px(ctx, (bl.k + tick) % 3 === 0 ? '#fffbe0' : '#e08a1e', bl.x, bl.y, 2, 2);
  // fountain
  for (let i = 0; i < 6; i++) {
    const a = time * 3 + i * 1.05, t = (time * 1.4 + i / 6) % 1;
    px(ctx, FX.spray, LAYOUT.fountain[0] + Math.cos(a) * (2 + t * 8), LAYOUT.fountain[1] - 14 + t * t * 14 - t * 4, 1, 1);
  }
  // music drifting out of the record store
  const vd = shopGeo.vinyl.door;
  for (let i = 0; i < 3; i++) {
    const t = (time * .45 + i / 3) % 1, nx = Math.round(vd.x + 16 + Math.sin(time * 2 + i * 2) * 3 + i * 3), ny = Math.round(vd.y - 14 - t * 26);
    ctx.globalAlpha = 1 - t;
    px(ctx, P.out, nx + 2, ny, 1, 5); px(ctx, P.out, nx, ny + 3, 3, 2); px(ctx, P.out, nx + 3, ny, 2, 1);
    ctx.globalAlpha = 1;
  }
  // glow on the place under the cursor
  if (hover && hover.obj) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .2;
    ctx.drawImage(hover.obj.img, hover.obj.x, hover.obj.y);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  drawSpirit(ctx, X, Y, p.dir, p.moving, time);

  // redraw anything standing in front of the spirit
  const bx = X - 14, by = Y - 27, bw = 28, bh = 29;
  for (const ob of objs) {
    if (ob.baseY <= Y) continue;
    const ix = Math.max(ob.x, bx), iy = Math.max(ob.y, by), ix2 = Math.min(ob.x + ob.w, bx + bw), iy2 = Math.min(ob.y + ob.h, by + bh);
    if (ix2 > ix && iy2 > iy) ctx.drawImage(ob.img, ix - ob.x, iy - ob.y, ix2 - ix, iy2 - iy, ix, iy, ix2 - ix, iy2 - iy);
  }

  if (zoom < 1.9) {          // "you are here" arrow when zoomed far out
    const ay = Y - 36 + Math.round(Math.sin(time * 5) * 2);
    px(ctx, P.out, X - 5, ay - 1, 11, 5); px(ctx, P.out, X - 3, ay + 4, 7, 2); px(ctx, P.out, X - 1, ay + 6, 3, 2);
    px(ctx, P.gold, X - 4, ay, 9, 3); px(ctx, P.gold, X - 2, ay + 3, 5, 2); px(ctx, P.gold, X, ay + 5, 1, 2);
  }
  if (route) {              // mark where the spirit is heading
    const t = route[route.length - 1], tx = Math.round(t.x), ty = Math.round(t.y) - 2, a = Math.floor(time * 6) % 2;
    px(ctx, P.out, tx - 3 - a, ty - 1, 7 + a * 2, 3); px(ctx, P.out, tx - 1, ty - 3 - a, 3, 7 + a * 2);
    px(ctx, '#fffdf6', tx - 2 - a, ty, 5 + a * 2, 1); px(ctx, '#fffdf6', tx, ty - 2 - a, 1, 5 + a * 2);
  }
  ctx.restore();

  // partner logos sit on the signs
  for (const bt of boats) {
    const sx = (bt.x + SIGN_X + 1 - camX) * zoom, sy = (bt.y + 1 - camY) * zoom, w = (SIGN_W - 2) * zoom, h = (SIGN_H - 2) * zoom;
    const on = sx + w > 0 && sx < innerWidth && sy + h > 0 && sy < innerHeight;
    bt.el.style.display = on ? '' : 'none';
    if (!on) continue;
    bt.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
    bt.el.style.width = Math.round(w) + 'px'; bt.el.style.height = Math.round(h) + 'px';
    bt.el.style.padding = Math.max(1, Math.round(zoom * 1.3)) + 'px';
  }
  // name tags: real text placed over the map, so it stays sharp at any zoom
  for (const s of shops) {
    const el = tagEls[s.id];
    const sx = (s.x + s.w / 2 - camX) * zoom, top = (s.y - 16 - camY) * zoom, bottom = (s.y + s.h - camY) * zoom;
    const on = sx > -60 && sx < innerWidth + 60 && bottom > 0 && top < innerHeight + 90;
    el.style.display = on ? '' : 'none';
    if (on) el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(Math.max(top, 84))}px) translate(-50%, -100%)`;
  }
}

let last = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0);
  last = ts; time += dt;
  update(dt); render();
  requestAnimationFrame(frame);
}

/* ───────────── Start-up options ─────────────
   ?map            start with the whole city on screen
   ?at=x,y         start at a position
   ?from=vinyl     coming back from a story page: stand at that place's door */
const q = new URLSearchParams(location.search);
if (q.has('map')) { setZoom(fitZoom()); start(); }
if (q.has('at')) { const [x, y] = q.get('at').split(',').map(Number); if (canStand(x, y)) { p.x = x; p.y = y; p.dir = 'd'; } start(); }
if (q.has('from')) {
  const s = shops.find(s => s.id === q.get('from'));
  if (s) {
    s.found = true; save();
    p.x = s.door.x; p.y = s.door.y + 8; p.dir = 'd';
    start();
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* not allowed on some file:// setups */ }
  }
}
updateHud();
if (!paused) celebrate();
requestAnimationFrame(frame);
})();
