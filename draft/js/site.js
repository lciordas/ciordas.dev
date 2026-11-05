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
  set('--ov-row-gap', `${style.rowGap ?? 9}px`);
  set('--ov-col-gap', `${style.columnGap ?? 64}px`);
  set('--ov-width', `${style.width ?? 1180}px`);
  root.classList.toggle('no-tags', style.showTags === false);
  root.classList.toggle('no-numbers', style.showNumbers === false);
}

export function renderOverview(root, c) {
  applyStyle(root, c.style);
  const row = (id, i) => {
    const p = c.projects[id];
    if (!p) return '';
    return `<li><a class="row" href="#${id}" data-project="${id}">
      <span class="row__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="row__t" data-edit="projects.${id}.title">${esc(p.title)}</span>
      <span class="row__d" data-edit="projects.${id}.tag">${esc(p.tag)}</span></a></li>`;
  };
  const list = (key) => {
    const l = c.lists?.[key];
    if (!l) return '';
    return `<section class="ov-list"><h2 data-edit="lists.${key}.title">${esc(l.title)}</h2><ul>${l.items.map((it, i) => `<li><strong data-edit="lists.${key}.items.${i}.title">${esc(it.title)}</strong><span data-edit="lists.${key}.items.${i}.detail">${esc(it.detail)}</span></li>`).join('')}</ul></section>`;
  };
  root.innerHTML = `
    <div class="ov-inner">
      <header class="ov-head ov-reveal">
        <div><p class="ov-name" data-edit="site.name">${esc(c.site.name)}</p><p class="ov-tag" data-edit="site.tagline">${esc(c.site.tagline)}</p></div>
        <nav class="ov-links" aria-label="Links">${(c.site.links || []).map((l, i) => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" data-edit="site.links.${i}.label">${esc(l.label)}</a>`).join('')}</nav>
      </header>
      <div class="ov-cols">
        ${c.columns.map((col, k) => `<section class="ov-col ov-reveal"><h2 data-edit="columns.${k}.title">${esc(col.title)}</h2><ul>${col.items.map(row).join('')}</ul></section>`).join('')}
      </div>
      <div class="ov-extra ov-reveal">${list('distinctions')}${list('experience')}</div>
      <footer class="ov-foot ov-reveal"><span data-edit="site.hint">${esc(c.site.hint)}</span><button id="replay" type="button">Replay intro</button></footer>
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
    const cols = [...root.querySelectorAll('.ov-col')].map((c) => [...c.querySelectorAll('.row')]);
    let cx = cols.findIndex((c) => c.includes(document.activeElement)), ry = cx < 0 ? -1 : cols[cx].indexOf(document.activeElement);
    e.preventDefault();
    if (cx < 0) { cols[0][0]?.focus({ preventScroll: true }); return; }
    if (e.key === 'ArrowDown') ry = Math.min(cols[cx].length - 1, ry + 1);
    if (e.key === 'ArrowUp') ry = Math.max(0, ry - 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { cx = (cx + 1) % cols.length; ry = Math.min(cols[cx].length - 1, ry); }
    cols[cx][ry]?.focus({ preventScroll: true });
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
