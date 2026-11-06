// site: the overview page shown behind the name, and moving between it and the project pages.
import { REDUCED } from './_util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u || '') ? u : '#');

// Style values from the content file become CSS variables, so the editor can change them live.
function applyStyle(root, style = {}) {
  const set = (k, v) => root.style.setProperty(k, v);
  set('--ov-accent', style.accent || '#ffb98a');
  set('--ov-title', `${style.titleSize ?? 34}px`);
  set('--ov-row', `${style.rowSize ?? 20}px`);
  set('--ov-row-gap', `${style.rowGap ?? 14}px`);
  set('--ov-col-gap', `${style.columnGap ?? 40}px`);
  root.classList.toggle('no-tags', style.showTags === false);
  root.classList.toggle('no-numbers', style.showNumbers === false);
  root.classList.toggle('no-thumbs', style.showThumbs === false);
}

// Icons for known links: GitHub's mark from Simple Icons (CC0) and the mail icon from Lucide (ISC).
const ICONS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
};
const iconFor = (l) => (/^mailto:/i.test(l.url || '') ? ICONS.mail : /github\.com/i.test(l.url || '') ? ICONS.github : null);

export function renderOverview(root, c) {
  applyStyle(root, c.style);
  const row = (id, i) => {
    const p = c.projects[id];
    if (!p) return '';
    return `<li><a class="row" href="#${id}" data-project="${id}">
      ${p.thumb ? `<span class="row__f"><img class="row__i" src="media/thumbs/${esc(p.thumb)}.webp" alt="" loading="eager" decoding="async"></span>` : ''}
      <span class="row__x">
        <span class="row__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <span class="row__t" data-edit="projects.${id}.title">${esc(p.title)}</span>
        <span class="row__d" data-edit="projects.${id}.tag">${esc(p.tag)}</span>
      </span></a></li>`;
  };
  const link = (l, i) => {
    const icon = iconFor(l);
    return `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" ${icon ? `class="ov-icon" aria-label="${esc(l.label)}" title="${esc(l.label)}">${icon}` : `data-edit="site.links.${i}.label">${esc(l.label)}`}</a>`;
  };
  // Each column is two cards tall, so the cards come out the same size across both.
  const across = c.columns.map((col) => Math.max(1, Math.ceil(col.items.filter((id) => c.projects[id]).length / 2)));
  const extras = c.style?.showExtras === true;
  const list = (key) => {
    const l = c.lists?.[key];
    if (!l) return '';
    return `<section class="ov-list"><h2 data-edit="lists.${key}.title">${esc(l.title)}</h2><ul>${l.items.map((it, i) => `<li><strong data-edit="lists.${key}.items.${i}.title">${esc(it.title)}</strong><span data-edit="lists.${key}.items.${i}.detail">${esc(it.detail)}</span></li>`).join('')}</ul></section>`;
  };
  const other = c.other?.items?.length ? `<div class="ov-other"><h3 data-edit="other.title">${esc(c.other.title)}</h3><ul>${c.other.items.map((it, i) => `<li><img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" decoding="async"><strong data-edit="other.items.${i}.title">${esc(it.title)}</strong><span data-edit="other.items.${i}.detail">${esc(it.detail)}</span></li>`).join('')}</ul></div>` : '';
  root.innerHTML = `
    <div class="ov-inner">
      <header class="ov-head ov-reveal">
        <div class="ov-id">
          <p class="ov-name" data-edit="site.name">${esc(c.site.name)}</p>
          <nav class="ov-links" aria-label="Links">${(c.site.links || []).map(link).join('')}</nav>
          <p class="ov-tag" data-edit="site.tagline">${esc(c.site.tagline)}</p>
        </div>
        <div class="ov-foot"><span data-edit="site.hint">${esc(c.site.hint)}</span><button id="replay" type="button">Replay intro</button></div>
      </header>
      <div class="ov-cols" style="grid-template-columns:${across.map((n) => `${n}fr`).join(' ')}">
        ${c.columns.map((col, k) => `<section class="ov-col ov-reveal" style="--across:${across[k]}"><h2 data-edit="columns.${k}.title" data-count="${String(col.items.filter((id) => c.projects[id]).length).padStart(2, '0')}">${esc(col.title)}</h2><ul>${col.items.map(row).join('')}</ul></section>`).join('')}
      </div>
      ${extras ? `<div class="ov-extra ov-reveal">${list('distinctions')}${list('experience')}</div>${other}` : ''}
    </div>`;
}

export function mountSite({ root, work, content, onReplay }) {
  renderOverview(root, content);
  root.querySelector('#replay')?.addEventListener('click', onReplay);
  const veil = document.createElement('div'); veil.id = 'veil'; document.body.appendChild(veil);
  const back = document.createElement('a'); back.id = 'to-overview'; back.href = '#'; back.textContent = 'Overview'; back.setAttribute('aria-label', 'Back to overview'); document.body.appendChild(back);

  const rows = () => [...root.querySelectorAll('.row')];
  const atOverview = () => window.scrollY < innerHeight * 0.5;
  let last = null;

  const cross = (fn) => {
    if (REDUCED) { fn(); return; }
    veil.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => veil.classList.remove('on')); }, 190);
  };
  const open = (id, instant) => {
    const go = () => { work.focus(id); document.title = `${content.projects[id].title} | Lucas Ciordas`; };
    last = id;
    instant ? go() : cross(go);
  };
  const close = () => cross(() => {
    work.toTop();
    document.title = 'Lucas Ciordas';
    const r = rows().find((x) => x.dataset.project === last);
    r?.focus({ preventScroll: true });
  });
  const route = (instant) => {
    const id = location.hash.slice(1);
    if (id && content.projects[id]) open(id, instant);
    else if (!instant) close();
  };
  addEventListener('hashchange', () => route(false));
  if (location.hash.length > 1) route(true);

  // A click on a row, or Enter on a focused one, follows its link and goes through the same path.
  back.addEventListener('click', (e) => { e.preventDefault(); if (location.hash.length > 1) history.pushState(null, '', location.pathname + location.search); close(); });

  document.addEventListener('click', (e) => { if (e.target.closest('.after__back')) { e.preventDefault(); back.click(); } });

  // Moving the mouse over a row and moving with the keys share one highlight.
  root.addEventListener('pointermove', (e) => { const r = e.target.closest('.row'); if (r && document.activeElement !== r) r.focus({ preventScroll: true }); });
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (!atOverview()) back.click(); return; }
    if (!atOverview() || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const all = rows(), cur = document.activeElement;
    e.preventDefault();
    if (!all.includes(cur)) { all[0]?.focus({ preventScroll: true }); return; }
    // The nearest card in the arrow's direction.
    const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const a = box(cur), [dx, dy] = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    let best = null, bestD = Infinity;
    all.forEach((n) => {
      if (n === cur) return;
      const b = box(n), along = (b.x - a.x) * dx + (b.y - a.y) * dy, across = Math.abs((b.x - a.x) * dy) + Math.abs((b.y - a.y) * dx);
      if (along < 4) return;
      const d = along + across * 2.2;
      if (d < bestD) { bestD = d; best = n; }
    });
    best?.focus({ preventScroll: true });
  });
  addEventListener('scroll', () => {
    const past = window.scrollY > innerHeight * 0.75;
    back.classList.toggle('on', past);
    // Back at the top after a single project: show everything in order again.
    if (window.scrollY < innerHeight * 0.2 && work.focused()) {
      work.clearFocus();
      if (location.hash.length > 1) history.replaceState(null, '', location.pathname + location.search);
      document.title = 'Lucas Ciordas';
    }
  }, { passive: true });
  return { rows };
}
