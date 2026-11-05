// Everything you need to edit lives in this file. Text, links, colours and media.
// Palette keys: top, mid, haze = sky from zenith to horizon. low = dark ground.
// pale, stone, deep = the monolith's light, middle and dark mineral bands. shard = broken pieces.
window.SITE = {
  name: 'Lucas Ciordas',
  title: 'Lucas Ciordas — Portfolio',
  description: 'Portfolio of Lucas Ciordas.',
  intro: true, // false skips the loading sequence
  sound: true, // false removes the sound button
  navAbout: 'About',
  navClose: 'Close',
  visitLabel: 'Visit website',

  about: {
    role: ', short description of what you do.',
    paragraphs: ['Two sentences about how you work and what you care about. Keep them short so they read well in the masked line animation.'],
    facts: [
      { text: 'Founder of ', link: { label: 'Company', href: 'https://example.com' }, after: ', a line about what it does.' },
      { text: 'Previously at ', link: { label: 'Studio One', href: 'https://example.com' }, and: { label: 'Studio Two', href: 'https://example.com' }, after: '.' },
    ],
    awards: [
      ['5x', 'Award Name, Category'],
      ['4x', 'Award Name, Category'],
      ['3x', 'Award Name, Another Category'],
      ['2x', 'Other Award'],
      ['1x', 'Other Award, Category'],
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/lciordas' },
      { label: 'LinkedIn', href: 'https://linkedin.com' },
      { label: 'Instagram', href: 'https://instagram.com' },
    ],
    email: 'hello@ciordas.dev',
    copyLabel: 'Copy email',
    copiedLabel: 'Copied',
  },

  // Palette for the about view.
  aboutPalette: { top: '#0f0403', mid: '#2a140b', haze: '#4b3218', low: '#22120a', pale: '#ffdfca', stone: '#d9694a', deep: '#8a1b10', shard: '#d3af8f' },

  // Add or remove freely. `title` is the two big lines. `media` takes images and videos,
  // for example [{ src: 'media/one.mp4' }, { src: 'media/one.jpg' }]. Empty shows a placeholder.
  projects: [
    { slug: 'project-one', title: ['PROJECT', 'ONE'], name: 'Project One', description: 'One or two lines describing this project and your role in it.', meta: ['Made with Collaborator'], year: '2026', url: 'https://example.com', media: [],
      palette: { top: '#170505', mid: '#452019', haze: '#6d4b31', low: '#4a3220', pale: '#ffdfca', stone: '#d9694a', deep: '#8a1b10', shard: '#d3af8f' } },
    { slug: 'project-two', title: ['PROJECT', 'TWO'], name: 'Project Two', description: 'One or two lines describing this project and your role in it.', meta: ['Made with Collaborator'], year: '2026', url: 'https://example.com', media: [],
      palette: { top: '#070407', mid: '#1a1924', haze: '#2c2f3c', low: '#121015', pale: '#fbecd9', stone: '#c98a58', deep: '#8a4c22', shard: '#c8ab90' } },
    { slug: 'project-three', title: ['PROJECT', 'THREE'], name: 'Project Three', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2025', url: 'https://example.com', media: [],
      palette: { top: '#080c16', mid: '#1e3546', haze: '#37636f', low: '#224049', pale: '#f3efe8', stone: '#a06a33', deep: '#7c3414', shard: '#8fa6ad' } },
    { slug: 'project-four', title: ['PROJECT', 'FOUR'], name: 'Project Four', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2025', url: 'https://example.com', media: [],
      palette: { top: '#130b14', mid: '#39333f', haze: '#5d6467', low: '#404546', pale: '#f4ece2', stone: '#83603f', deep: '#5e2c0a', shard: '#b5b3b2' } },
    { slug: 'project-five', title: ['PROJECT', 'FIVE'], name: 'Project Five', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2024', url: 'https://example.com', media: [],
      palette: { top: '#1d0706', mid: '#50231b', haze: '#7b5238', low: '#53321d', pale: '#ffe7d6', stone: '#c47f60', deep: '#8e2c16', shard: '#d0ad90' } },
    { slug: 'project-six', title: ['PROJECT', 'SIX'], name: 'Project Six', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2024', url: 'https://example.com', media: [],
      palette: { top: '#101711', mid: '#324742', haze: '#537070', low: '#39504f', pale: '#f8efdf', stone: '#b98055', deep: '#7a5126', shard: '#a7b3a7' } },
    { slug: 'project-seven', title: ['PROJECT', 'SEVEN'], name: 'Project Seven', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2024', url: 'https://example.com', media: [],
      palette: { top: '#091c13', mid: '#235048', haze: '#41797a', low: '#255252', pale: '#f6f0dc', stone: '#a69a4f', deep: '#5f6a28', shard: '#9fb5ab' } },
    { slug: 'project-eight', title: ['PROJECT', 'EIGHT'], name: 'Project Eight', description: 'One or two lines describing this project and your role in it.', meta: ['Studio Name'], year: '2023', url: 'https://example.com', media: [],
      palette: { top: '#1c0d04', mid: '#4e391f', haze: '#766740', low: '#4a3e1e', pale: '#fbf1d9', stone: '#b5974f', deep: '#6b4b18', shard: '#c9b78e' } },
  ],
};
