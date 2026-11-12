// site: the overview page shown behind the name, and moving between it and the projects.
import { REDUCED } from './_util.js';
import { PALETTE, PALETTE_KEY, DEFAULT_PALETTE } from './palette.js';
import { SNAP } from './keynav.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Words wrapped in **double asterisks** in the content file are set in bold.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u || '') ? u : '#');

// Style values from the content file become CSS variables, so the editor can change them live.
// A ?palette= preview shows that palette's highlight colour instead of the content file's.
function applyStyle(root, style = {}) {
  const set = (k, v) => root.style.setProperty(k, v);
  set('--ov-accent', (PALETTE_KEY === DEFAULT_PALETTE && style.accent) || PALETTE.accent);
  set('--ov-title', `${style.titleSize ?? 34}px`);
  set('--ov-row', `${style.rowSize ?? 20}px`);
  set('--ov-row-gap', `${style.rowGap ?? 14}px`);
  set('--ov-col-gap', `${style.columnGap ?? 40}px`);
  root.classList.toggle('no-tags', style.showTags === false);
  root.classList.toggle('no-numbers', style.showNumbers === false);
  root.classList.toggle('no-thumbs', style.showThumbs === false);
}

// Icons for known links: GitHub's and LinkedIn's marks from Simple Icons (CC0) and the mail icon from Lucide (ISC).
const ICONS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
};
const iconFor = (l) => (/^mailto:/i.test(l.url || '') ? ICONS.mail : /github\.com/i.test(l.url || '') ? ICONS.github : /linkedin\.com/i.test(l.url || '') ? ICONS.linkedin : null);

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
  const other = c.other?.items?.length ? `<div class="ov-other"><h3 data-edit="other.title">${esc(c.other.title)}</h3><ul>${c.other.items.map((it, i) => `<li><img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" decoding="async"><strong data-edit="other.items.${i}.title">${esc(it.title)}</strong><span data-edit="other.items.${i}.detail">${esc(it.detail)}</span></li>`).join('')}</ul></div>` : '';
  // Words **marked** in the intro are set in bold.
  const intro = String(c.site.intro || ''), bio = rich(intro);
  const icons = (cls) => `<nav class="ov-links ${cls}" aria-label="Links">${(c.site.links || []).map(link).join('')}</nav>`;
  const research = (c.research?.items || []).filter((id) => c.projects[id]).map((id) => {
    const p = c.projects[id];
    return `<li><a class="rrow" href="#${id}" data-project="${id}">${p.thumb ? `<img src="media/thumbs/${esc(p.thumb)}.webp" alt="" decoding="async">` : ''}<span><strong>${esc(p.fullTitle || p.title)}</strong><em>${esc(p.tag)}</em></span></a></li>`;
  }).join('');
  const fact = (key) => {
    const l = c.lists?.[key];
    if (!l?.items?.length) return '';
    return `<section class="ov-fact ov-fact--${key}"><h2 data-edit="lists.${key}.title">${esc(l.title)}</h2><ul>${l.items.map((it) => `<li><strong>${rich(it.title)}</strong>${it.detail ? `<span>${rich(it.detail)}</span>` : ''}</li>`).join('')}</ul></section>`;
  };
  // The logos twice over, so the row can slide along without a gap.
  const logos = c.site.logos || [];
  const strip = logos.length ? `<div class="ov-marquee" aria-label="${esc(logos.map((l) => l.name).join(', '))}"><ul>${[...logos, ...logos].map((l, i) => `<li${i >= logos.length ? ' aria-hidden="true"' : ''}><img src="${esc(l.src)}" alt="${i >= logos.length ? '' : esc(l.name)}" title="${esc(l.name)}" decoding="async"></li>`).join('')}</ul></div>` : '';
  root.innerHTML = `
    <div class="ov-inner">
      <header class="ov-bar">
        <div class="ov-brand"><p class="ov-name" data-edit="site.name">${esc(c.site.name)}</p>${icons('ov-links--bar')}</div>
        <div class="ov-foot"><span data-edit="site.hint">${esc(c.site.hint)}</span></div>
      </header>
      <section class="ov-hero ov-reveal" aria-label="About">
        <div class="ov-hero-top"><p class="ov-hero-name" aria-hidden="true">${esc(c.site.name)}</p>${icons('ov-links--hero')}</div>
        <div class="ov-card">
        ${intro ? `<p class="ov-bio">${bio}</p>` : ''}
        ${strip}
        <div class="ov-facts">
          ${fact('experience')}
          ${research ? `<section class="ov-fact ov-fact--research"><h2 data-edit="research.title">${esc(c.research.title)}</h2><ul>${research}</ul></section>` : ''}
          ${fact('distinctions')}
        </div>
        </div>
      </section>
      <div class="ov-projects">
        <div class="ov-cols" style="grid-template-columns:${across.map((n) => `${n}fr`).join(' ')}">
          ${c.columns.map((col, k) => `<section class="ov-col ov-reveal" style="--across:${across[k]}"><h2 data-edit="columns.${k}.title" data-count="${String(col.items.filter((id) => c.projects[id]).length).padStart(2, '0')}">${esc(col.title)}</h2><ul>${col.items.map(row).join('')}</ul></section>`).join('')}
        </div>
      </div>
      ${extras ? other : ''}
    </div>`;
}

export function mountSite({ root, work, content }) {
  renderOverview(root, content);
  const veil = document.createElement('div'); veil.id = 'veil'; document.body.appendChild(veil);
  const back = document.createElement('a'); back.id = 'to-overview'; back.href = '#'; back.textContent = 'Overview'; back.setAttribute('aria-label', 'Back to overview'); document.body.appendChild(back);

  // The name starts large over the top of the page and settles into the bar's top-left corner as the page scrolls.
  const bar = root.querySelector('.ov-bar'), small = root.querySelector('.ov-name'), big = root.querySelector('.ov-hero-name');
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const fly = () => {
    if (!bar || !big || root.hidden) return;
    const k0 = clamp01(window.scrollY / (innerHeight * 0.3)), k = k0 * k0 * (3 - 2 * k0);
    // It glides from where the large name sits at the top of the page, rather than scrolling up with it.
    const br = bar.getBoundingClientRect(), b = big.getBoundingClientRect(), top0 = b.top + window.scrollY;
    const ax = br.left + small.offsetLeft, ay = br.top + small.offsetTop, s = b.width / Math.max(1, small.offsetWidth);
    small.style.transform = k >= 1 ? '' : `translate3d(${((b.left - ax) * (1 - k)).toFixed(1)}px,${((top0 - ay) * (1 - k)).toFixed(1)}px,0) scale(${(1 + (s - 1) * (1 - k)).toFixed(4)})`;
    bar.style.setProperty('--k', k.toFixed(3));
    bar.classList.toggle('is-docked', k > 0.6);
  };
  addEventListener('scroll', fly, { passive: true });
  addEventListener('resize', fly);
  document.fonts?.ready.then(fly);
  requestAnimationFrame(fly);
  // The overview fades in, so the name follows it until that's done.
  const settle = performance.now(); const follow = () => { fly(); if (performance.now() - settle < 1600) requestAnimationFrame(follow); }; follow();
  const rows = () => [...root.querySelectorAll('.row, .rrow')];
  // The overview runs from the top of the page to the bottom of the project cards.
  const atOverview = () => window.scrollY < root.offsetHeight - innerHeight * 0.5;

  // Every project sits on the one long page, in order. Picking one goes straight to where it starts, with the projects
  // before it still above and the ones after it still below. The address names the project on screen (#id), so a link
  // to it opens there. The browser's back button, the Overview button, the link at the end and Escape go back to the
  // overview, to the spot a project was picked from (or else the project cards).
  history.scrollRestoration = 'manual';
  const base = location.pathname + location.search;
  const url = (id) => (id ? `${base}#${id}` : base);
  const target = () => { const id = location.hash.slice(1); return content.projects[id] ? id : null; };
  const cardsTop = () => { const g = root.querySelector('.ov-projects'); return g ? g.getBoundingClientRect().top + window.scrollY : 0; };
  // own: the step into a project in the history was added by this page (a card or a link to a project), so going
  // back one step stays on it rather than loading the page again.
  let where = null, from = null, busy = false, pending = false, selfBack = false, pin = null, own = false;
  const name = (id) => { where = id; document.title = id ? `${content.projects[id].title} | Lucas Ciordas` : 'Lucas Ciordas'; };
  const cross = (fn, instant) => {
    busy = true;
    const done = () => {
      fn();
      requestAnimationFrame(() => { busy = false; veil.classList.remove('on'); if (pending) { pending = false; route(); } });
    };
    if (instant || REDUCED) { done(); return; }
    veil.classList.add('on');
    setTimeout(done, 190);
  };
  // Words and pictures above can still change height just after arriving (the fonts coming in), so until the page is
  // moved it stays lined up with the project's start.
  const keep = () => {
    if (!pin || performance.now() > pin.until) { pin = null; return; }
    const y = Math.min(work.top(pin.id), document.documentElement.scrollHeight - innerHeight);
    if (Math.abs(y - window.scrollY) > 1.5) work.jump(y);
    requestAnimationFrame(keep);
  };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, () => { pin = null; }, { passive: true, capture: true }));
  const visit = (id, instant) => cross(() => {
    name(id);
    work.jump(work.top(id));
    pin = { id, until: performance.now() + 2500 }; requestAnimationFrame(keep);
  }, instant);
  const home = () => cross(() => {
    const was = where;
    name(null); pin = null;
    work.jump(from ?? cardsTop()); from = null;
    rows().find((x) => x.dataset.project === was)?.focus({ preventScroll: true });
  });
  const route = () => {
    if (busy) { pending = true; return; }
    const id = target();
    if (id ? id !== where : !atOverview()) id ? visit(id) : home();
  };
  // The address follows the page as it scrolls, without adding steps to the history. Scrolling back up into the
  // overview after picking a project takes the step back itself, so the back button doesn't have to.
  const current = () => {
    if (atOverview()) return null;
    const mid = window.scrollY + innerHeight * 0.5;
    let id = null;
    for (const s of work.sections) { if (s.getBoundingClientRect().top + window.scrollY <= mid) id = s.dataset.project; else break; }
    return id;
  };
  const sync = () => {
    if (busy || selfBack) return;
    const id = current();
    if (id === where) return;
    if (!id && history.state?.lc && own) { selfBack = true; name(null); history.back(); return; }
    history.replaceState(history.state, '', url(id));
    name(id);
  };
  let syncing = false;
  addEventListener('scroll', () => { if (!syncing) { syncing = true; requestAnimationFrame(() => { syncing = false; sync(); }); } }, { passive: true });
  addEventListener('popstate', () => { if (selfBack) { selfBack = false; sync(); } else route(); });
  addEventListener('hashchange', route);
  // Back to the overview straight away, and the step into the project taken off the history quietly, so the back
  // button doesn't lead into it again.
  const leave = () => {
    if (own && history.state?.lc) { selfBack = true; history.back(); }
    else if (location.hash || history.state?.lc) history.replaceState(null, '', base);
    home();
  };
  // A link straight to a project opens there, with the overview one step back.
  const first = target();
  if (first) {
    if (!history.state?.lc) { history.replaceState(null, '', base); history.pushState({ lc: 1 }, '', url(first)); own = true; }
    visit(first, true);
  }

  // A click on a card, or Enter on a focused one.
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-project]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (busy) return;
    from = window.scrollY;
    history.pushState({ lc: 1 }, '', url(a.dataset.project)); own = true;
    visit(a.dataset.project);
  });
  back.addEventListener('click', (e) => { e.preventDefault(); leave(); });
  document.addEventListener('click', (e) => { if (e.target.closest('.after__back')) { e.preventDefault(); leave(); } });

  // Moving the mouse over a row and moving with the keys share one highlight.
  root.addEventListener('pointermove', (e) => { const r = e.target.closest('.row'); if (r && document.activeElement !== r) r.focus({ preventScroll: true }); });
  // Escape goes back to the overview from anywhere in the projects, wherever the focus is, unless something else on
  // the page has used it (closing something) or a video is full screen. It's heard first, so nothing can stop it on
  // the way, and acted on once everything else has had its turn.
  addEventListener('keydown', (e) => {
    if ((e.key !== 'Escape' && e.key !== 'Esc') || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    setTimeout(() => {
      if (e.defaultPrevented || document.fullscreenElement || document.webkitFullscreenElement || atOverview()) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      leave();
    });
  }, true);
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Escape') return;
    // Where the page is headed (a glide's end, read from Lenis), so a key pressed mid-glide into the projects carries on with it.
    const L = work.lenis, y = L ? (L.animate?.isRunning ? L.animate.to : L.targetScroll) : window.scrollY;
    if (y >= root.offsetHeight - innerHeight * 0.5 || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const all = rows(), vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    // Only cards on screen count: the one under the bar's edge or scrolled away is left alone.
    const top = bar?.offsetHeight || 0, onScreen = (n) => { const r = n.getBoundingClientRect(), m = (r.top + r.bottom) / 2; return m > top && m < innerHeight; };
    let cur = document.activeElement;
    if (!all.includes(cur) || !onScreen(cur)) cur = null;
    // With no card picked yet, the arrows start from the first card on screen (the last one going up). With none on
    // screen, up and down move the page a step instead (keynav.js).
    if (!cur) {
      const seen = all.filter(onScreen), first = e.key === 'ArrowUp' ? seen[seen.length - 1] : seen[0];
      if (!first) return;
      e.preventDefault(); first.focus({ preventScroll: true }); return;
    }
    // The nearest card in the arrow's direction.
    const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const a = box(cur), [dx, dy] = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    // Up and down stay inside a card's own category (hardware, software), so down from a category's bottom row
    // leaves the overview instead of stepping sideways into the other one; up from its top row may reach the rows above.
    const col = cur.closest('.ov-col'), inReach = (n) => !vertical || !col || n.closest('.ov-col') === col || (dy < 0 && !n.closest('.ov-col'));
    let best = null, bestD = Infinity;
    all.forEach((n) => {
      if (n === cur || !inReach(n)) return;
      const b = box(n), along = (b.x - a.x) * dx + (b.y - a.y) * dy, across = Math.abs((b.x - a.x) * dy) + Math.abs((b.y - a.y) * dx);
      if (along < 4) return;
      const d = along + across * 2.2;
      if (d < bestD) { bestD = d; best = n; }
    });
    // Past the last row going down, or the first going up, the page moves on a step instead (keynav.js).
    if (!best) { if (vertical) cur.blur(); else e.preventDefault(); return; }
    e.preventDefault();
    best.focus({ preventScroll: true });
    const r = best.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) {
      // Kept inside the overview, so the page never rests with the first project half on screen.
      if (SNAP && work.lenis) work.lenis.scrollTo(Math.max(0, Math.min(root.offsetHeight - innerHeight, r.top + window.scrollY - innerHeight * 0.3)), { duration: 0.7 });
      else if (work.lenis) work.lenis.scrollTo(best, { offset: -innerHeight * 0.3 }); else best.scrollIntoView({ block: 'center' });
    }
  });
  addEventListener('scroll', () => {
    // Only once the overview's own bar has gone, so the two never sit on top of each other.
    back.classList.toggle('on', window.scrollY > root.offsetHeight - (bar?.offsetHeight || 64));
  }, { passive: true });
  return { rows };
}
