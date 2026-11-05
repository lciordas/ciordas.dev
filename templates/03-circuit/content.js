// Fill this file in. Everything the visitor reads, and every link and image path, lives here.
// <em> inside a text string switches to the display serif in the accent color.
window.SITE = {
  meta: {
    title: 'Lucas Ciordas — Portfolio',
    description: 'Portfolio of Lucas Ciordas. Replace this description in content.js.',
    copyright: '© 2026 Lucas Ciordas.',
    rights: 'All rights reserved',
  },

  name: { first: 'Lucas', last: 'Ciordas' },

  // Monogram used by the nav, loader, and page transition. Keep the shape chunky: it becomes the reveal hole.
  mark: {
    viewBox: '0 0 100 100',
    d: 'M14 8 38 8 30 68 46 68 43 92 3 92ZM60 8 98 8 95 28 79 28 75 56 91 56 88 76 52 76Z',
    focus: [22, 50],  // a point inside a stroke; the zoom lands here
    stroke: 20,       // rough stroke thickness in viewBox units
  },

  colors: {
    accent: '#d2ff00',      // bright highlight: buttons, reveal blocks, scribbles
    accentSoft: '#b2c73a',  // serif accent on dark backgrounds
    paper: '#f4f4ed',       // light page background and light text
    hero: '#fcfcfa',        // hero frame background
    ink: '#282c20',         // dark page background and dark text
    black: '#111112',       // darkest section
    muted: '#b4b8a5',       // quiet labels
  },

  nav: {
    cta: { label: 'Contact', href: 'mailto:hello@ciordas.dev' },
    links: [
      { label: 'Home', href: 'index.html', image: 'assets/placeholders/menu-1.webp' },
      { label: 'Work', href: 'work.html', image: 'assets/placeholders/menu-2.webp' },
      { label: 'About', href: 'index.html#statement', image: 'assets/placeholders/menu-3.webp' },
      { label: 'Archive', href: 'index.html#projects', image: 'assets/placeholders/menu-4.webp' },
    ],
    menuEyebrow: 'Designer and developer',
    socialsEyebrow: 'Say hello',
  },

  socials: [
    { label: 'GitHub', href: 'https://github.com/lciordas' },
    { label: 'LinkedIn', href: '#' },
    { label: 'Instagram', href: '#' },
    { label: 'X', href: '#' },
  ],

  hero: {
    // Optional real images, both the same size with transparent backgrounds. Leave null for the 3D placeholder.
    portrait: null,
    portraitReveal: null,
    card: { eyebrow: 'Current', title: 'Project name', badge: 'Independent since 2019' },
    touchHint: { lock: 'Tap to lock', unlock: 'Back to scroll' },
  },

  message: {
    eyebrow: 'A note from Lucas',
    rows: ['A short line about the work', 'A second line that keeps on moving'],
  },

  statement: {
    eyebrow: 'Independent since 2019',
    text: '<em>Designing</em> interfaces, shipping <em>products</em>, sweating the small details in all ways. Building a <em>body</em> of work on and off the clock.',
  },

  gallery: {
    // Twelve fixed slots. tint: true shows the image as a quiet duotone. Labels sit above each image.
    items: [
      { type: 'image', src: 'assets/placeholders/photo-01.webp', label: 'Project one, 2026', tint: false },
      { type: 'image', src: 'assets/placeholders/photo-02.webp', label: 'Project two, 2026', tint: true },
      { type: 'text', text: 'A short thought about how you work, in a sentence or two.' },
      { type: 'image', src: 'assets/placeholders/photo-03.webp', label: 'Project three, 2025', tint: false },
      { type: 'image', src: 'assets/placeholders/photo-04.webp', label: 'Project four, 2025', tint: true },
      { type: 'image', src: 'assets/placeholders/photo-05.webp', label: 'Project five, 2025', tint: false },
      { type: 'image', src: 'assets/placeholders/photo-06.webp', label: 'Project six, 2024', tint: false },
      { type: 'image', src: 'assets/placeholders/photo-07.webp', label: 'Project seven, 2024', tint: true },
      { type: 'image', src: 'assets/placeholders/photo-08.webp', label: 'Project eight, 2024', tint: false },
      { type: 'text', text: 'Another line about where you started and what you keep coming back to.' },
      { type: 'image', src: 'assets/placeholders/photo-09.webp', label: 'Project nine, 2023', tint: false },
      { type: 'image', src: 'assets/placeholders/photo-10.webp', label: 'Project ten, 2023', tint: true },
    ],
  },

  split: {
    left: { top: 'Paid', bottom: 'Work', text: 'Client projects, shipped products, and the results they drove.', href: 'work.html', image: 'assets/placeholders/side-left.webp' },
    right: { top: 'Side', bottom: 'Work', text: 'Experiments, tools, and things built for the fun of it.', href: 'work.html', image: 'assets/placeholders/figure-side.webp' },
    rise: 'assets/placeholders/wide-01.webp',
  },

  projects: {
    titleTop: 'Selected',
    titleBottom: 'Projects',
    text: 'From small tools to full products, a running list of the work you are proudest of. Replace this paragraph.',
    items: [
      ['Project one', '2026'], ['Project two', '2026'], ['Project three', '2025'], ['Project four', '2025'],
      ['Project five', '2024'], ['Project six', '2024'], ['Project seven', '2024'], ['Project eight', '2023'],
      ['Project nine', '2023'], ['Project ten', '2022'], ['Project eleven', '2021'], ['Project twelve', '2020'],
      ['Project thirteen', '2020'], ['Project fourteen', '2019'], ['Project fifteen', '2019'], ['Project sixteen', '2018'],
    ].map(([name, year], i) => ({
      name, year, href: 'work.html',
      image: `assets/placeholders/token-${String((i % 12) + 1).padStart(2, '0')}.webp`,
      hover: `assets/placeholders/photo-${String((i % 16) + 1).padStart(2, '0')}.webp`,
    })),
    callout: { text: 'See more projects and case studies<br>from the full archive', cta: { label: 'View all work', href: 'work.html' } },
  },

  feature: {
    eyebrow: 'Latest case study',
    lines: ['Latest', 'Featured', '<em>Project</em>'],
    text: 'Introduce the project you most want people to see, what you did, and why it mattered. Three lines reads best here.',
    cta: { label: 'Read the case', href: 'work.html' },
    images: {
      main: 'assets/placeholders/photo-11.webp', float: 'assets/placeholders/photo-12.webp', low: 'assets/placeholders/photo-13.webp',
      corner: 'assets/placeholders/photo-14.webp', sticker: 'assets/placeholders/token-07.webp',
    },
  },

  clients: {
    titleTop: 'Clients',
    titleBottom: '&Partners',
    text: 'Proud to work with a range of teams who care about the details. Replace these names with real ones.',
    names: ['Client One', 'Studio Two', 'Northwind', 'Atlas', 'Field Co', 'Meridian', 'Halcyon', 'Parallel', 'Good Form'],
  },

  socialsBlock: {
    titleTop: 'Say hi',
    titleBottom: 'On socials',
    caption: 'Follow along on social media',
    cards: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ image: `assets/placeholders/card-${n}.webp`, href: '#' })),
  },

  footer: {
    line: 'Always <em>shipping</em> the <em>next</em> thing.',
    pagesEyebrow: 'Pages',
    followEyebrow: 'Follow on',
    extra: { label: 'Resume', href: '#' },
    cta: { label: 'Work with me', href: 'mailto:hello@ciordas.dev' },
    figure: 'assets/placeholders/figure-solid.webp',
    legal: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }],
  },

  // Inner page (work.html)
  work: {
    titleWord: 'Archive',
    facts: [['Based in', 'Your city'], ['Focus', 'Product design'], ['Status', 'Available']],
    intro: 'A sentence or two that frames the work below. <em>The last few words stand out.</em>',
    statement: 'Picking <em>hard</em> problems, shipping <em>real</em> work, and caring about <em>every</em> detail.',
    stats: [['48', 'Projects shipped'], ['12', 'Years working'], ['6', 'Awards won']],
    ledgerTitleTop: 'Year',
    ledgerTitleBottom: 'By year',
    ledger: [
      ['2026', 'Project one', 'Design and build', 'Live'],
      ['2025', 'Project three', 'Product design', 'Live'],
      ['2025', 'Project four', 'Front end', 'Live'],
      ['2024', 'Project six', 'Art direction', 'Archived'],
      ['2024', 'Project seven', 'Design system', 'Live'],
      ['2023', 'Project nine', 'Prototyping', 'Archived'],
    ],
    countdown: { label: 'Next launch', target: '2027-01-15T09:00:00Z' },
  },
};
