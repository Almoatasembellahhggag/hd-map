/* 16×16 pixel icons for the three shops. Used by the map HUD and the store pages. */
window.drawShopIcon = function (g, id) {
  const px = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const disc = (c, cx, cy, r) => {
    g.fillStyle = c;
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy;
        if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
      }
  };
  g.clearRect(0, 0, 16, 16);
  if (id === 'vinyl') {
    disc('#1a1620', 8, 8, 7.5); disc('#3a3344', 8, 8, 5.5); disc('#1a1620', 8, 8, 4.6);
    disc('#f4a836', 8, 8, 2.6); disc('#1a1620', 8, 8, .8);
    px('#6a6278', 3, 4, 2, 1); px('#6a6278', 2, 5, 1, 2);
  } else if (id === 'cinema') {
    px('#2a1f2b', 1, 6, 14, 9); px('#3d3348', 2, 7, 12, 7);
    px('#2a1f2b', 1, 2, 14, 3);
    for (let i = 0; i < 4; i++) px('#f6ecd4', 2 + i * 4, 2, 2, 3);
    px('#f6ecd4', 3, 9, 10, 1); px('#e0465b', 3, 11, 6, 1); px('#f6ecd4', 3, 12, 8, 1);
  } else {
    px('#1f3d35', 2, 1, 12, 14); px('#2f5d50', 4, 1, 10, 13);
    px('#f6ecd4', 4, 14, 10, 1); px('#f1d27a', 6, 4, 6, 1); px('#f1d27a', 6, 6, 6, 1);
    px('#c0392b', 10, 12, 2, 4);
  }
};
