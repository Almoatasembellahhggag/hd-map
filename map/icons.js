/* Line icons for the three kinds of place. Used on the map and on the story pages.
   shopIconInner(id) → the drawing alone (for use inside another SVG)
   shopIcon(id)      → a complete <svg> */
(() => {
  const DRAW = {
    cinema: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.2v5.6l5-2.8z" fill="currentColor"/>',
    books: '<path d="M12 6.5C10 5 7 4.5 4 5v12.5c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5V19"/>',
    vinyl: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><path d="M6.2 9.5A6.4 6.4 0 0 1 9.5 6.2"/>',
  };
  const wrap = d => `<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
  window.shopIconInner = id => wrap(DRAW[id] || DRAW.books);
  window.shopIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${window.shopIconInner(id)}</svg>`;
})();
