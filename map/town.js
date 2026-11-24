/* The town as a quiet, flat map.
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

/* ───────────── Drawing the map (one SVG) ───────────── */
const svg = $('map');
let world, trailEl;

function drawMap() {
  const r = rng(11), o = [], u = L.u;
  const X0 = -2500, X1 = L.w + 2500, Y0 = -2500, Y1 = L.h + 2500;
  const [ry0, ry1] = L.river, [hx, hy, hrx, hry] = L.hill, [cx, cy, cs] = L.castle;
  const rect = (cls, x, y, w, hh, extra = '') => `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(hh)}"${extra}/>`;

  /* the castle hill: height lines and woods */
  for (let k = 5; k >= 1; k--) {
    let d = '';
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, m = 1 + .06 * Math.sin(3 * a + k) + .04 * Math.sin(5 * a + 2 * k);
      d += (i ? 'L' : 'M') + f(hx + Math.cos(a) * (40 + k * hrx) * m) + ' ' + f(hy + Math.sin(a) * (24 + k * hry) * m);
    }
    o.push(`<path class="contour" d="${d}Z"/>`);
  }
  let woods = '';
  for (let i = 0; i < 170; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()), x = hx + Math.cos(a) * d * (40 + 5.3 * hrx), y = hy + Math.sin(a) * d * (24 + 5.3 * hry), rad = (6 + r() * 5) * u;
    if (y > L.rows[0] - 16 || (Math.abs(x - cx) < 112 * cs && y > cy - 54 * cs && y < cy + 68 * cs) || (Math.abs(x - cx) < 36 * u && y > cy)) continue;
    woods += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}"/>`;
  }
  o.push(`<g class="wood">${woods}</g>`);

  /* river */
  const top = x => ry0 + 14 * Math.sin(x / 260), bot = x => ry1 + 10 * Math.sin(x / 300 + 1);
  let d = '';
  for (let x = X0; x <= X1; x += 50) d += (d ? 'L' : 'M') + x + ' ' + f(top(x));
  for (let x = X1; x >= X0; x -= 50) d += 'L' + x + ' ' + f(bot(x));
  o.push(`<path class="river" d="${d}Z"/>`);
  for (const t of [.25, .5, .75]) {
    d = '';
    for (let x = X0; x <= X1; x += 50) d += (d ? 'L' : 'M') + x + ' ' + f(top(x) + (bot(x) - top(x)) * t);
    o.push(`<path class="flow" d="${d}"/>`);
  }

  /* streets */
  const road = (x1, y1, x2, y2, w) => `<line class="road" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`;
  const south = ry1 + 45;
  o.push(road(X0, L.main, X1, L.main, 20), road(X0, south, X1, south, 16), road(L.bridge, L.bridgeFrom, L.bridge, ry0 - 10, 16), road(L.bridge, ry1 + 10, L.bridge, Y1, 16));
  for (const [x1, y1, x2, y2] of L.lanes) o.push(road(x1, y1, x2, y2, 15));
  o.push(`<path class="trailway" d="M${cx} ${f(cy + 46 * cs)}C${cx - 60} ${f(cy + (L.bridgeFrom - cy) * .4)} ${cx + 70} ${f(cy + (L.bridgeFrom - cy) * .55)} ${cx + 6} ${f(cy + (L.bridgeFrom - cy) * .78)}S${L.bridge} ${L.bridgeFrom - 30} ${L.bridge} ${L.bridgeFrom}"/>`);

  /* houses: a row along the top and the bottom of every block, a courtyard in between */
  const avoid = Object.values(L.places);
  let houses = '';
  const block = (x, y, w, hh, density) => {
    const depth = Math.min(hh / 2 - 3, 46);
    for (const upper of [true, false]) {
      let bx = x;
      while (bx < x + w - 14) {
        let bw = 24 + r() * 34;
        if (x + w - bx - bw < 16) bw = x + w - bx;
        const bd = depth * (.68 + r() * .32), by = upper ? y : y + hh - bd, shade = 1 + (r() * 3 | 0);
        if (r() < density && !avoid.some(a => bx < a[0] + a[2] + 12 && bx + bw > a[0] - 12 && by < a[1] + a[3] + 12 && by + bd > a[1] - 12))
          houses += rect('h' + shade, bx, by, bw - 3, bd);
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
  o.push(`<g class="houses">${houses}</g>`);

  /* market square with the church and the fountain */
  const sx = L.cols[L.square[0]] + 12, sy = L.rows[L.square[1]] + 12, sw = L.cols[L.square[0] + 1] - L.cols[L.square[0]] - 24, sh = L.rows[L.square[1] + 1] - L.rows[L.square[1]] - 24;
  const chx = sx + sw * .34, chy = sy + sh * .42, fx = sx + sw * .76, fy = sy + sh * .52;
  o.push(rect('plaza', sx, sy, sw, sh, ' rx="5"'),
    `<g class="landmark">${rect('', chx - 48, chy - 15, 92, 30)}${rect('', chx + 8, chy - 31, 26, 62)}${rect('', chx - 62, chy - 13, 26, 26)}</g>`,
    `<circle class="fountain" cx="${f(fx)}" cy="${f(fy)}" r="${12 * u}"/><circle class="landmark" cx="${f(fx)}" cy="${f(fy)}" r="${3.5 * u}"/>`);
  let trees = '';
  for (const [tx, ty] of [[.62, .2], [.9, .2], [.62, .84], [.9, .84]]) trees += `<circle cx="${f(sx + sw * tx)}" cy="${f(sy + sh * ty)}" r="${7 * u}"/>`;
  const nameW = L.text * 9;
  for (let x = L.cols[0] + 10; x < L.cols[nc]; x += 30 * u) if (x < L.bridge - 34 || x > L.bridge + 34 + nameW) trees += `<circle cx="${f(x)}" cy="${f(L.rows[nr] + 26 * u)}" r="${6 * u}"/>`;
  o.push(`<g class="wood">${trees}</g>`);

  /* the old bridge */
  let piers = '';
  for (let i = 1; i <= 4; i++) piers += rect('', L.bridge - 19, ry0 + (ry1 - ry0) * i / 5 - 5, 38, 10);
  o.push(`<g class="landmark">${piers}<circle cx="${L.bridge - 15}" cy="${ry0 - 16}" r="9"/><circle cx="${L.bridge + 15}" cy="${ry0 - 16}" r="9"/></g>`,
    rect('deck', L.bridge - 10, ry0 - 24, 20, ry1 - ry0 + 48));

  /* the castle */
  const c = (x, y, w, hh) => rect('', cx + x * cs, cy + y * cs, w * cs, hh * cs);
  const tower = (x, y, rad) => `<circle cx="${f(cx + x * cs)}" cy="${f(cy + y * cs)}" r="${f(rad * cs)}"/>`;
  o.push(`<g class="landmark">${c(-80, -28, 160, 22)}${c(-80, -28, 24, 68)}${c(56, -28, 24, 68)}${c(-80, 22, 62, 18)}${tower(-80, -28, 14)}${tower(80, -28, 14)}${tower(80, 42, 17)}</g>`);

  /* survey grid, with a letter for every column and a number for every row */
  let grid = '', ticks = '', refs = '';
  for (let x = Math.ceil(X0 / 100) * 100; x <= X1; x += 100) grid += `M${x} ${Y0}V${Y1}`;
  for (let y = Math.ceil(Y0 / 100) * 100; y <= Y1; y += 100) grid += `M${X0} ${y}H${X1}`;
  for (let x = 0; x <= L.w; x += 100) for (let y = 0; y <= L.h; y += 100) ticks += `M${x - 5} ${y}h10M${x} ${y - 5}v10`;
  for (let i = 0; i < L.w / 100; i++) refs += `<text x="${i * 100 + 50}" y="${L.h - 9 * u}" text-anchor="middle">${String.fromCharCode(65 + i)}</text>`;
  for (let j = 0; j < L.h / 100; j++) refs += `<text x="${9 * u}" y="${j * 100 + 50 + L.text * .3}">${j + 1}</text>`;
  o.push(`<path class="grid" d="${grid}"/><path class="grid tick" d="${ticks}"/><g class="ref" font-size="${f(L.text * .85)}">${refs}</g>`);

  /* names on the map */
  o.push(`<g class="name" font-size="${L.text}">
    <text x="${f(cx + 108 * cs)}" y="${f(cy + 6 * cs)}">SCHLOSS</text>
    <text x="${f(sx + sw * .76)}" y="${f(sy + sh - 9 * u)}" text-anchor="middle">MARKTPLATZ</text>
    <text x="${L.bridge + 34}" y="${f(ry0 - 12 * u)}">ALTE BRÜCKE</text></g>`);

  /* partner boats: the hull is the sign, the logo links to the partner */
  SPONSORS.slice(0, L.boats.length).forEach((sp, i) => {
    const [x, y] = L.boats[i], [bw, bh] = L.boat, n = bh * .56;
    o.push(`<a class="boat" href="${esc(sp.url)}" target="_blank" rel="noopener" data-role="${esc(sp.role)}" data-name="${esc(sp.name)}" aria-label="${esc(sp.role + ': ' + sp.name)}">
      <g style="animation-delay:${-i * .8}s"><path class="wake" d="M${x - 10} ${f(y + bh * .32)}h${-f(bh * .5)}M${x - 10} ${f(y + bh * .68)}h${-f(bh * .85)}"/>
      <path class="hull" d="M${x + 12} ${y}H${f(x + bw - n)}L${x + bw} ${f(y + bh / 2)}L${f(x + bw - n)} ${y + bh}H${x + 12}Q${x} ${y + bh} ${x} ${y + bh - 12}V${y + 12}Q${x} ${y} ${x + 12} ${y}Z"/>
      <image href="${esc(sp.logo)}" x="${x + 14}" y="${y + 9}" width="${f(bw - n - 20)}" height="${bh - 18}" preserveAspectRatio="xMidYMid meet"/></g></a>`);
  });

  /* where the spirit has just been */
  o.push('<polyline id="trail" class="trail" points=""/>');

  /* the three places with stories: the only colour on the map */
  SHOPS.forEach((s, i) => {
    const [x, y, w, hh] = L.places[s.id], g = Math.min(w, hh) * .6;
    o.push(`<g class="place" data-place="${s.id}" style="--c:${esc(s.accent)}">
      ${rect('ping', x, y, w, hh, ` rx="6" style="animation-delay:${i * .9}s"`)}${rect('body', x, y, w, hh, ' rx="6"')}
      <svg class="glyph" x="${f(x + (w - g) / 2)}" y="${f(y + (hh - g) / 2)}" width="${f(g)}" height="${f(g)}" viewBox="0 0 24 24">${window.shopIconInner(s.id)}</svg></g>`);
  });

  svg.innerHTML = `<g id="world">${o.join('')}</g>`;
  world = $('world'); trailEl = $('trail');
}

/* ───────────── Camera: fit the town into the free part of the screen ───────────── */
const panel = $('stories'), tagsEl = $('tags');
let cam = { s: 1, x: 0, y: 0 }, camFrom = null, camTo = null, camT = 0;
let openId = null;       // the place whose stories are showing in the panel
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
  world.setAttribute('transform', `translate(${f(cam.x)} ${f(cam.y)}) scale(${cam.s})`);
  tagsEl.classList.toggle('short', cam.s < .72);
  tagsEl.classList.toggle('tiny', cam.s < .3);
  for (const s of SHOPS) {
    const [x, y, w] = L.places[s.id];
    tagEls[s.id].style.transform = `translate(${f(cam.x + (x + w / 2) * cam.s)}px, ${f(cam.y + y * cam.s - 14)}px) translate(-50%, -100%)`;
  }
  placePeek();
}
function moveCam(instant) {
  const goal = camGoal();
  if (instant || REDUCED) { cam = goal; camTo = null; applyCam(); return; }
  camFrom = { ...cam }; camTo = goal; camT = 0;
}
const toMap = (x, y) => ({ x: (x - cam.x) / cam.s, y: (y - cam.y) / cam.s });
const toScreen = (x, y) => ({ x: cam.x + x * cam.s, y: cam.y + y * cam.s });
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

  if (held.size) {                                   // arrow keys or W A S D
    let dx = 0, dy = 0;
    for (const k of held) { dx += MOVE[k][0]; dy += MOVE[k][1]; }
    const n = Math.hypot(dx, dy) || 1, step = 420 * dt / cam.s, a = toMap(14, 14), b = toMap(innerWidth - 14, innerHeight - 14);
    aim({ x: clamp(to.x + dx / n * step, a.x, b.x), y: clamp(to.y + dy / n * step, a.y, b.y) }, .08);
    setHot(placeAt(to), 'keys');
  }

  const ease = REDUCED ? 1 : 1 - Math.exp(-dt / tau), px = me.x;
  me.x += (to.x - me.x) * ease; me.y += (to.y - me.y) * ease;
  const vx = dt ? (me.x - px) * cam.s / dt : 0, p = toScreen(me.x, me.y);
  const sway = 1 - Math.exp(-dt / .14);              // lean and glance settle gently, at any frame rate
  lookX += (clamp(vx / 260, -1, 1) - lookX) * sway;
  tilt += (clamp(vx / 140, -7, 7) - tilt) * sway;
  spirit.style.transform = `translate3d(${f(p.x)}px, ${f(p.y)}px, 0)`;
  if (!REDUCED) {
    ghost.style.transform = `translateY(${f(Math.sin(clock * 2.4) * 3)}px) rotate(${f(tilt)}deg)`;
    eyes.setAttribute('transform', `translate(${f(lookX * 2.2)} 0)`);
    /* a dotted line where it has just been */
    const tail = trail[trail.length - 1];
    if (!tail || Math.hypot(tail.x - me.x, tail.y - me.y) * cam.s > 5) trail.push({ x: me.x, y: me.y, t: clock });
    while (trail.length && clock - trail[0].t > .3) trail.shift();
    if (trail.length || lastTrail) trailEl.setAttribute('points', trail.map(q => f(q.x) + ',' + f(q.y)).join(' '));
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
const from = shopOf(params.get('from'));
if (from) {                                          // coming back from a story: its place is open again
  openPlace(from.id, false, true);
  const p = front(from.id);
  me.x = to.x = p.x; me.y = to.y = p.y;
}
document.body.classList.add('ready');
requestAnimationFrame(frame);
})();
