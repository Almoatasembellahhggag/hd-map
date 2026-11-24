/* Store pages.
   store.html?shop=cinema              → list of that shop's stories
   store.html?shop=cinema&story=slug   → one story */
(() => {
'use strict';

const q = new URLSearchParams(location.search);
const shop = window.SHOPS.find(s => s.id === q.get('shop')) || window.SHOPS[0];
const story = shop.entries.find(e => e.slug === q.get('story'));
const MEDIA = { cinema: 'video', vinyl: 'audio', books: 'text' }[shop.id];
const app = document.getElementById('app');

document.body.dataset.shop = shop.id;
document.title = `${story ? story.title + ' — ' : ''}${shop.name} · heartblicke`;
document.getElementById('back').href = `index.html?from=${shop.id}`;

/* tiny element builder: h('p', { class: 'meta', text: 'hi' }, child, child) */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return el;
}
function icon() {
  const el = h('span', { class: 'icon', 'aria-hidden': 'true' });
  el.innerHTML = window.shopIcon(shop.id);
  return el;
}
function fmtDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
const kindOf = e => MEDIA === 'video' ? 'Video' : MEDIA === 'audio' ? 'Audio' : e.type === 'photo' ? 'Photo essay' : 'Story';
const lengthOf = e => e.duration || e.readTime || (e.photos && e.photos.length ? `${e.photos.length} photos` : '');
const metaLine = e => [kindOf(e), lengthOf(e), fmtDate(e.date)].filter(Boolean).join(' · ');
const storyUrl = e => `store.html?shop=${shop.id}&story=${encodeURIComponent(e.slug)}`;
const bg = src => `background-image:url("${encodeURI(src)}")`;

/* ───────── list of entries ───────── */
function entry(e, i) {
  const info = h('div', { class: 'info' },
    h('p', { class: 'meta', text: metaLine(e) }),
    h('h2', { text: e.title }),
    h('p', { class: 'sum', text: e.summary }));
  let kids;
  if (MEDIA === 'video') {
    kids = [h('div', { class: 'thumb' + (e.poster ? '' : ' blank'), style: e.poster ? bg(e.poster) : null },
      h('span', { class: 'badge', text: '▶' }),
      e.duration && h('span', { class: 'dur', text: e.duration })), info];
  } else if (MEDIA === 'audio') {
    const half = Math.ceil(shop.entries.length / 2);
    kids = [h('span', { class: 'num', text: i < half ? `A${i + 1}` : `B${i - half + 1}` }), info,
      h('span', { class: 'play', 'aria-hidden': 'true', text: '▶' })];
  } else {
    const first = e.type === 'photo' && e.photos && e.photos[0];
    kids = [info, first && h('div', { class: 'thumb photo' + (first.src ? '' : ' blank'), style: first.src ? bg(first.src) : null })];
  }
  return h('li', {}, h('a', { class: 'entry', href: storyUrl(e) }, kids));
}

function renderList() {
  const n = shop.entries.length;
  app.append(
    h('section', { class: 'hero' }, icon(),
      h('div', {},
        h('p', { class: 'kicker', text: `${shop.kind} · ${shop.stories}` }),
        h('h1', { text: shop.name }),
        h('p', { class: 'tag', text: shop.tag }),
        h('p', { class: 'intro', text: shop.intro }))),
    h('p', { class: 'count', text: `${n} ${n === 1 ? 'story' : 'stories'}` }),
    n ? h('ol', { class: `entries ${MEDIA}` }, shop.entries.map(entry))
      : h('p', { class: 'none', text: 'Nothing on the shelves yet.' }));
}

/* ───────── one story ─────────
   Each kind of story is shown in its own setting:
   video → on the screen of a small cinema, audio → on a record player, text → in an open book. */
const empty = (label, hint) => h('div', { class: 'empty' }, h('strong', { text: label }), h('span', { text: hint }));
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* the film itself: a video file, or a YouTube / Vimeo player */
function video(e) {
  const src = e.video || '';
  if (!src) return h('div', { class: 'frame' }, empty('No video yet', 'Add a file path or a YouTube / Vimeo link as "video" in stories.js'));
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(src);
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(src);
  const embed = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
  return h('div', { class: 'frame' }, embed
    ? h('iframe', { src: embed, title: e.title, allow: 'fullscreen; picture-in-picture', allowfullscreen: true })
    : h('video', { src, controls: true, playsinline: true, preload: 'metadata', poster: e.poster || null }));
}

/* ── cinema: curtains part in front of the screen, and the lights go down while the film runs ── */
function cinema(e) {
  const screen = video(e);
  const hidden = { 'aria-hidden': 'true' };
  const room = h('div', { class: 'theatre' },
    h('div', { class: 'valance', ...hidden }),
    h('div', { class: 'stage' }, screen, h('div', { class: 'curtain left', ...hidden }), h('div', { class: 'curtain right', ...hidden })),
    h('div', { class: 'seats', ...hidden }, [9, 8].map(n => h('div', { class: 'row' }, Array.from({ length: n }, () => h('span'))))));
  const film = screen.querySelector('video');
  if (film) {
    film.addEventListener('play', () => document.body.classList.add('lights-down'));
    for (const ev of ['pause', 'ended']) film.addEventListener(ev, () => document.body.classList.remove('lights-down'));
  }
  if (still) room.classList.add('open'); else setTimeout(() => room.classList.add('open'), 500);
  return room;
}

/* ── record player: the record turns and the arm travels across it while the audio plays ── */
const clockTime = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
function turntable(e) {
  const i = shop.entries.indexOf(e), half = Math.ceil(shop.entries.length / 2);
  const arm = h('div', { class: 'arm', 'aria-hidden': 'true' }, h('i'));
  const disc = h('button', { class: 'record', type: 'button', 'aria-label': 'Play' },
    h('span', { class: 'label' }, h('b', { text: i < half ? `A${i + 1}` : `B${i - half + 1}` }), h('small', { text: '33 rpm' })));
  const table = h('div', { class: 'turntable' },
    h('div', { class: 'plinth' }, h('div', { class: 'platter', 'aria-hidden': 'true' }), disc, arm, h('span', { class: 'knob', 'aria-hidden': 'true' })));
  if (!e.audio) {
    disc.disabled = true;
    table.append(empty('No audio yet', 'Add a file path as "audio" in stories.js'));
    return table;
  }
  const player = h('audio', { src: e.audio, preload: 'metadata' });
  const word = h('span', { text: 'Play' });
  const button = h('button', { class: 'pp', type: 'button' }, h('i', { 'aria-hidden': 'true' }), word);
  const seek = h('input', { class: 'seek', type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Position in the recording' });
  const clock = h('span', { class: 'clock', text: e.duration ? `0:00 / ${e.duration}` : '0:00' });
  let dragging = false;
  const sync = () => {
    const d = player.duration, part = d ? player.currentTime / d : 0, on = !player.paused;
    if (!dragging) seek.value = Math.round(part * 1000);
    clock.textContent = [clockTime(player.currentTime), d ? clockTime(d) : e.duration].filter(Boolean).join(' / ');
    table.classList.toggle('playing', on);
    word.textContent = on ? 'Pause' : 'Play';
    disc.setAttribute('aria-label', on ? 'Pause' : 'Play');
    // the arm rests beside the record until the audio has started, and goes back at the end
    if (player.ended || (!on && !player.currentTime)) arm.style.removeProperty('--a');
    else arm.style.setProperty('--a', `${(29 + 20 * part).toFixed(2)}deg`);
  };
  const toggle = () => { if (player.paused) player.play().catch(() => {}); else player.pause(); };
  for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked']) player.addEventListener(ev, sync);
  player.addEventListener('error', () => {
    button.disabled = seek.disabled = disc.disabled = true;
    clock.textContent = 'This audio could not be loaded.';
  });
  button.addEventListener('click', toggle);
  disc.addEventListener('click', toggle);
  seek.addEventListener('input', () => { dragging = true; if (player.duration) player.currentTime = seek.value / 1000 * player.duration; });
  seek.addEventListener('change', () => { dragging = false; });
  table.append(h('div', { class: 'controls' }, button, seek, clock), player);
  return table;
}

/* ── book: the story is set on pages that you turn ── */
function photos(e) {
  return (e.photos || []).map((ph, i) => h('figure', {},
    ph.src ? h('img', { src: ph.src, alt: ph.caption || '', loading: i ? 'lazy' : null })
           : h('div', { class: 'frame photo' }, empty(`Photo ${i + 1}`, 'Add an image path as "src" in stories.js')),
    ph.caption && h('figcaption', { text: ph.caption })));
}
function book(e, head) {
  const flow = h('div', { class: 'flow' },
    h('header', { class: 'title-page' }, icon(), head),
    (e.body || []).map(t => h('p', { text: t })),
    photos(e),
    h('p', { class: 'fin', 'aria-hidden': 'true', text: '· · ·' }));
  const view = h('div', { class: 'pages' }, flow);
  const back = h('button', { class: 'turn', type: 'button', text: '← Page back' });
  const next = h('button', { class: 'turn', type: 'button', text: 'Next page →' });
  const where = h('span', { class: 'where', 'aria-live': 'polite' });
  const volume = h('div', { class: 'book' },
    h('div', { class: 'spread' }, h('span', { class: 'ribbon', 'aria-hidden': 'true' }), view),
    h('div', { class: 'turns' }, back, where, next));
  let at = 0, views = 1;
  function layout() {
    const cs = getComputedStyle(flow), per = parseInt(cs.columnCount, 10) || 1, gap = parseFloat(cs.columnGap) || 0;
    const width = view.clientWidth, col = (width - (per - 1) * gap) / per;
    const cols = Math.max(1, Math.round((flow.scrollWidth + gap) / (col + gap)));
    views = Math.ceil(cols / per); at = Math.max(0, Math.min(at, views - 1));
    flow.style.transform = `translateX(${-at * (width + gap)}px)`;
    where.textContent = per > 1 && cols > 1
      ? `Pages ${at * per + 1}–${Math.min(at * per + per, cols)} of ${cols}` : `Page ${at + 1} of ${views}`;
    back.disabled = at === 0; next.disabled = at === views - 1;
    volume.dataset.per = per;
  }
  function turn(by) {
    const to = Math.max(0, Math.min(views - 1, at + by));
    if (to === at) return;
    at = to;
    if (still) return layout();
    volume.classList.add('turning');
    setTimeout(() => { layout(); volume.classList.remove('turning'); }, 140);
  }
  back.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  document.addEventListener('keydown', ev => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { turn(1); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { turn(-1); ev.preventDefault(); }
  });
  let down = null;                                   // swipe sideways to turn the page
  view.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
  view.addEventListener('pointerup', ev => {
    if (!down) return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y; down = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  view.addEventListener('pointercancel', () => { down = null; });
  addEventListener('resize', layout);
  flow.addEventListener('load', layout, true);        // pictures change how the pages fall
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  requestAnimationFrame(layout);
  return volume;
}

function renderStory(e) {
  const i = shop.entries.indexOf(e), prev = shop.entries[i - 1], next = shop.entries[i + 1];
  const step = (s, label, cls) => s
    ? h('a', { class: cls, href: storyUrl(s) }, h('small', { text: label }), h('span', { text: s.title }))
    : h('span', {});
  const head = [
    h('p', { class: 'meta', text: metaLine(e) }),
    h('h1', { text: e.title }),
    h('p', { class: 'lede', text: e.summary })];
  const notes = h('div', { class: 'body' }, (e.body || []).map(t => h('p', { text: t })));
  app.append(h('article', { class: `story ${MEDIA}` },
    h('a', { class: 'crumb', href: `store.html?shop=${shop.id}`, text: `← ${shop.name} · all stories` }),
    MEDIA === 'video' ? [head, h('div', { class: 'media' }, cinema(e)), notes]
      : MEDIA === 'audio' ? [head, h('div', { class: 'media' }, turntable(e)), notes]
      : book(e, head),
    h('nav', { class: 'more' }, step(prev, '← Previous', 'prev'), step(next, 'Next →', 'next'))));
}

document.body.dataset.view = story ? 'story' : 'list';
if (story) renderStory(story); else renderList();
})();
