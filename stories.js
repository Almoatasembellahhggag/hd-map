/* Heidelbrück — the three shops and the stories inside them.
   This is the only file you need to edit to add or change content.

   Every entry needs:   slug (unique, no spaces), title, date ('YYYY-MM-DD'), summary
   and can have:        body: ['paragraph', 'paragraph', …]

   Cinema  (video stories):  video: 'media/film.mp4'  or a YouTube / Vimeo link
                             poster: 'media/still.jpg' (optional thumbnail), duration: '12:40'
   Bookstore:                type: 'written'  → readTime: '6 min read'
                             type: 'photo'    → photos: [{ src: 'media/1.jpg', caption: '…' }, …]
   Vinyl   (audio stories):  audio: 'media/episode.mp3', duration: '18:22'

   Each shop also has: kind (the plain name on the map), action (what you do there, shown
   under the name) and accent (its colour on the map).

   Leave video / audio / src empty ('') and the page shows a placeholder instead.
   Everything below is SAMPLE content — replace it with your own. */

window.SHOPS = [
  {
    id: 'books', kind: 'Bookstore', name: 'Eule & Feder', accent: '#2f9469', action: 'Read stories',
    stories: 'Written stories & photo essays',
    tag: 'New, used & slightly haunted books.',
    intro: 'Three crooked floors under a timbered gable. Pull something off the shelf and stay a while.',
    entries: [
      {
        slug: 'the-cat-who-runs-the-poetry-shelf', type: 'written',
        title: 'The Cat Who Runs the Poetry Shelf', date: '2026-11-10', readTime: '5 min read',
        summary: 'Nobody remembers hiring her, but nothing on the second floor moves without her approval.',
        body: [
          'She arrived in a box of donated paperbacks, or so the story goes, and by the end of the week she had chosen the warm shelf above the radiator — the one that happens to hold the poetry.',
          'Regulars know the rule: you may take a book from her shelf only if she is asleep, and only if you put something back.',
          'This is sample text. Replace it with your own story in stories.js.',
        ],
      },
      {
        slug: 'forty-doors-of-the-old-town', type: 'photo',
        title: 'Forty Doors of the Old Town', date: '2026-10-24',
        summary: 'A walk from the bridge gate to the castle stairs, one front door at a time.',
        photos: [
          { src: '', caption: 'The green door of the bookstore, repainted every spring.' },
          { src: '', caption: 'A blue door on the riverside promenade.' },
          { src: '', caption: 'The cinema’s glass doors, just before the evening show.' },
          { src: '', caption: 'The church portal on market day.' },
        ],
        body: [
          'Sample photo essay. Add your image files to a folder (for example media/) and put their paths in the photos list in stories.js.',
        ],
      },
      {
        slug: 'letters-in-a-second-hand-atlas', type: 'written',
        title: 'Letters Found in a Second-Hand Atlas', date: '2026-09-30', readTime: '7 min read',
        summary: 'Eleven envelopes, pressed flat between the maps of two countries that no longer exist.',
        body: [
          'The atlas came in with a house clearance and sat in the window for a month before anyone opened it past the index.',
          'This is sample text. Replace it with your own story in stories.js.',
        ],
      },
    ],
  },
  {
    id: 'cinema', kind: 'Cinema', name: 'Kino Mondschein', accent: '#d8394e', action: 'Watch videos',
    stories: 'Video stories',
    tag: 'One screen, 84 velvet seats, popcorn in paper cones.',
    intro: 'The neon has hummed over the main street since 1952. Take a seat — the programme is below.',
    entries: [
      {
        slug: 'the-last-projectionist',
        title: 'The Last Projectionist', date: '2026-11-14', duration: '12:40',
        summary: 'Forty years in the booth, and he still rings a little bell before the lights go down.',
        video: '', poster: '',
        body: ['Sample video story. Set the video field in stories.js to a file path (media/film.mp4) or a YouTube / Vimeo link.'],
      },
      {
        slug: 'morning-on-the-old-bridge',
        title: 'Morning on the Old Bridge', date: '2026-10-18', duration: '4:05',
        summary: 'Fog, swans and the first delivery bikes, filmed in one take from the bridge gate.',
        video: '', poster: '',
        body: ['Sample video story. Replace this text with your own.'],
      },
      {
        slug: 'how-to-hang-a-neon-sign',
        title: 'How to Hang a Neon Sign', date: '2026-09-06', duration: '8:22',
        summary: 'Four letters, one ladder, and a whole street giving advice.',
        video: '', poster: '',
        body: ['Sample video story. Replace this text with your own.'],
      },
    ],
  },
  {
    id: 'vinyl', kind: 'Record store', name: 'Goldene Rille', accent: '#f59a23', action: 'Listen to audio',
    stories: 'Audio stories',
    tag: 'Second-hand vinyl & strong opinions since 1974.',
    intro: 'Crates up to the ceiling and a listening booth held together with tape. Put the headphones on.',
    entries: [
      {
        slug: 'the-shop-that-refused-to-close',
        title: 'The Shop That Refused to Close', date: '2026-11-07', duration: '18:22',
        summary: 'Three landlords, two floods and one very stubborn owner.',
        audio: '',
        body: ['Sample audio story. Set the audio field in stories.js to a file path such as media/episode.mp3.'],
      },
      {
        slug: 'field-recording-market-day',
        title: 'Field Recording: Market Day', date: '2026-10-12', duration: '6:48',
        summary: 'The square from six in the morning until the stalls come down. No narration.',
        audio: '',
        body: ['Sample audio story. Replace this text with your own.'],
      },
      {
        slug: 'three-records-i-should-not-have-sold',
        title: 'Three Records I Should Not Have Sold', date: '2026-09-21', duration: '24:10',
        summary: 'A confession from behind the counter, with the songs to prove it.',
        audio: '',
        body: ['Sample audio story. Replace this text with your own.'],
      },
    ],
  },
];
