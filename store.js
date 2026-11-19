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
document.title = `${story ? story.title + ' — ' : ''}${shop.name} · Heidelbrück`;
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
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
}
function icon() {
  const c = h('canvas', { width: 16, height: 16, 'aria-hidden': 'true' });
  window.drawShopIcon(c.getContext('2d'), shop.id);
  return c;
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

/* ───────── one story ───────── */
const empty = (label, hint) => h('div', { class: 'empty' }, h('strong', { text: label }), h('span', { text: hint }));

function video(e) {
  const src = e.video || '';
  if (!src) return h('div', { class: 'frame' }, empty('No video yet', 'Add a file path or a YouTube / Vimeo link as "video" in stories.js'));
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(src);
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(src);
  const embed = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
  return h('div', { class: 'frame' }, embed
    ? h('iframe', { src: embed, title: e.title, allow: 'fullscreen; picture-in-picture', allowfullscreen: true })
    : h('video', { src, controls: true, preload: 'metadata', poster: e.poster || null }));
}
function audio(e) {
  const deck = h('div', { class: 'deck' }, icon());
  if (!e.audio) { deck.append(empty('No audio yet', 'Add a file path as "audio" in stories.js')); return deck; }
  const player = h('audio', { src: e.audio, controls: true, preload: 'metadata' });
  player.addEventListener('play', () => deck.classList.add('playing'));
  for (const ev of ['pause', 'ended']) player.addEventListener(ev, () => deck.classList.remove('playing'));
  deck.append(player);
  return deck;
}
function photos(e) {
  return (e.photos || []).map((ph, i) => h('figure', {},
    ph.src ? h('img', { src: ph.src, alt: ph.caption || '', loading: i ? 'lazy' : null })
           : h('div', { class: 'frame photo' }, empty(`Photo ${i + 1}`, 'Add an image path as "src" in stories.js')),
    ph.caption && h('figcaption', { text: ph.caption })));
}

function renderStory(e) {
  const i = shop.entries.indexOf(e), prev = shop.entries[i - 1], next = shop.entries[i + 1];
  const step = (s, label, cls) => s
    ? h('a', { class: cls, href: storyUrl(s) }, h('small', { text: label }), h('span', { text: s.title }))
    : h('span', {});
  app.append(h('article', { class: 'story' },
    h('a', { class: 'crumb', href: `store.html?shop=${shop.id}`, text: `← ${shop.name} · all stories` }),
    h('p', { class: 'meta', text: metaLine(e) }),
    h('h1', { text: e.title }),
    h('p', { class: 'lede', text: e.summary }),
    MEDIA === 'video' && h('div', { class: 'media' }, video(e)),
    MEDIA === 'audio' && h('div', { class: 'media' }, audio(e)),
    h('div', { class: 'body' }, (e.body || []).map(t => h('p', { text: t }))),
    MEDIA === 'text' && photos(e),
    h('nav', { class: 'more' }, step(prev, '← Previous', 'prev'), step(next, 'Next →', 'next'))));
}

if (story) renderStory(story); else renderList();
})();
