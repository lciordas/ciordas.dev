// Site editor: changes draft/data/content.json, which the overview and project pages read.
// Work is saved in this browser as you type. Publishing commits the file through GitHub with your own token.
const REPO = 'lciordas/ciordas.dev', FILE = 'draft/data/content.json';
const DRAFT = 'lc-content-draft', TOKEN = 'lc-github-token';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* preview or private mode */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* same */ } } };
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.flat().forEach((k) => n.append(k)); return n; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

let published = null, c = null, tab = 'overview', picked = null, overviewReady = false;
const frame = $('preview');

const setStatus = (t) => { $('status').textContent = t; };
const dirty = () => JSON.stringify(c) !== JSON.stringify(published);
let saveTimer = 0, previewTimer = 0;
const changed = (repaintPanel) => {
  clearTimeout(saveTimer);
  setStatus('Saving');
  saveTimer = setTimeout(() => { dirty() ? store.set(DRAFT, JSON.stringify(c)) : store.del(DRAFT); setStatus(dirty() ? 'Saved on this browser, not published' : 'Matches the live site'); }, 250);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(pushPreview, 60);
  if (repaintPanel) render();
};
const pushPreview = () => {
  if ($('page').value === 'overview') { if (overviewReady) frame.contentWindow.postMessage({ type: 'lc:content', content: c }, location.origin); } else store.set(DRAFT, JSON.stringify(c));
};
const setPath = (path, value) => { const k = path.split('.'); let o = c; k.slice(0, -1).forEach((p) => { o = o[p]; }); o[k[k.length - 1]] = value; };
const getPath = (path) => path.split('.').reduce((o, p) => o?.[p], c);

// Small form pieces. Each text box finds its value by path, so it can follow typing in the preview.
const field = (label, path, opts = {}) => {
  const input = opts.long ? el('textarea', { value: getPath(path) ?? '' }) : el('input', { type: opts.url ? 'url' : 'text', value: getPath(path) ?? '' });
  input.dataset.path = path;
  input.addEventListener('input', () => { setPath(path, input.value); changed(); });
  return el('label', {}, label, input);
};
const range = (label, key, min, max, unit = 'px') => {
  const out = el('output', { textContent: `${c.style[key]}${unit}` });
  const input = el('input', { type: 'range', min, max, value: c.style[key] });
  input.addEventListener('input', () => { c.style[key] = +input.value; out.textContent = `${input.value}${unit}`; changed(); });
  return el('label', { className: 'range' }, el('span', { textContent: label }), out, input);
};
const toggle = (label, key) => {
  const input = el('input', { type: 'checkbox', checked: key === 'showExtras' ? c.style[key] === true : c.style[key] !== false });
  input.addEventListener('change', () => { c.style[key] = input.checked; changed(); });
  return el('label', { className: 'check' }, input, label);
};
const mini = (text, title, fn, disabled) => { const b = el('button', { type: 'button', className: 'mini', textContent: text, title, disabled: !!disabled }); b.setAttribute('aria-label', title); b.addEventListener('click', fn); return b; };
const moveIn = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; changed(true); };

const TABS = {
  overview() {
    const out = [el('p', { className: 'note', textContent: 'Order and contents of the overview. The scroll order of the project pages follows these lists.' }),
      el('h2', { textContent: 'Heading' }), field('Name', 'site.name'), field('Intro under the name (wrap words in **double asterisks** for bold)', 'site.intro', { long: true }), field('Hint at the top right', 'site.hint')];
    c.columns.forEach((col, k) => {
      out.push(el('h2', { textContent: `Column ${k + 1}` }), field('Column title', `columns.${k}.title`));
      col.items.forEach((id, i) => out.push(el('div', { className: 'item' },
        el('span', { textContent: c.projects[id]?.title || id }),
        mini('↑', 'Move up', () => moveIn(col.items, i, -1), i === 0),
        mini('↓', 'Move down', () => moveIn(col.items, i, 1), i === col.items.length - 1),
        mini('⇄', 'Move to the other column', () => { col.items.splice(i, 1); c.columns[(k + 1) % c.columns.length].items.push(id); changed(true); }),
        mini('Edit', 'Edit this project', () => { picked = id; tab = 'projects'; render(); }))));
    });
    if (c.research) {
      out.push(el('h2', { textContent: 'Research' }), field('Section title', 'research.title'));
      c.research.items.forEach((id, i) => out.push(el('div', { className: 'item' },
        el('span', { textContent: c.projects[id]?.title || id }),
        mini('↑', 'Move up', () => moveIn(c.research.items, i, -1), i === 0),
        mini('↓', 'Move down', () => moveIn(c.research.items, i, 1), i === c.research.items.length - 1),
        mini('Edit', 'Edit this project', () => { picked = id; tab = 'projects'; render(); }))));
    }
    out.push(el('h2', { textContent: 'Links' }));
    (c.site.links || []).forEach((l, i) => out.push(el('div', { className: 'card' }, field('Label', `site.links.${i}.label`), field('Address', `site.links.${i}.url`, { url: true }), el('div', { className: 'row-btns' }, mini('Remove', 'Remove link', () => { c.site.links.splice(i, 1); changed(true); })))));
    out.push(mini('Add link', 'Add link', () => { c.site.links.push({ label: 'New link', url: 'https://' }); changed(true); }));
    return out;
  },
  projects() {
    const ids = Object.keys(c.projects);
    if (!picked || !c.projects[picked]) picked = ids[0];
    const sel = el('select', {}, ids.map((id) => el('option', { value: id, textContent: c.projects[id].title, selected: id === picked })));
    sel.addEventListener('change', () => { picked = sel.value; render(); });
    const p = c.projects[picked], base = `projects.${picked}`;
    const out = [el('label', {}, 'Project', sel), field('Title', `${base}.title`), ...(p.fullTitle !== undefined ? [field('Full title (shown under Research)', `${base}.fullTitle`)] : []), field('Line on the overview', `${base}.tag`), field('Summary', `${base}.summary`, { long: true })];
    if (p.captions) {
      out.push(el('h2', { textContent: 'Captions below the window' }), el('p', { className: 'note', textContent: 'They show in this order as you scroll. Choose the project under Preview to see them in place.' }));
      p.captions.forEach((_, i) => out.push(field(`Caption ${i + 1}`, `${base}.captions.${i}`, { long: true })));
    } else {
      const tech = el('input', { type: 'text', value: (p.tech || []).join(', ') });
      tech.addEventListener('input', () => { p.tech = tech.value.split(',').map((s) => s.trim()).filter(Boolean); changed(); });
      out.push(el('label', {}, 'Tools and methods, separated by commas', tech));
    }
    if (p.media?.length) {
      out.push(el('h2', { textContent: 'Picture and video captions' }));
      p.media.forEach((_, i) => out.push(field(`Item ${i + 1}`, `${base}.media.${i}.caption`)));
    }
    if (p.kind === 'detail') {
      out.push(el('h2', { textContent: 'Links' }));
      p.links = p.links || [];
      p.links.forEach((l, i) => out.push(el('div', { className: 'card' }, field('Label', `${base}.links.${i}.label`), field('Address', `${base}.links.${i}.url`, { url: true }), el('div', { className: 'row-btns' }, mini('Remove', 'Remove link', () => { p.links.splice(i, 1); changed(true); })))));
      out.push(mini('Add link', 'Add link', () => { p.links.push({ label: 'Code', url: 'https://' }); changed(true); }));
      out.push(el('h2', { textContent: 'Remove' }), mini('Remove this project', 'Remove this project', () => {
        if (!confirm(`Remove ${p.title}?`)) return;
        c.columns.forEach((col) => { col.items = col.items.filter((x) => x !== picked); }); delete c.projects[picked]; picked = null; changed(true); fillPages();
      }));
    }
    out.push(el('h2', { textContent: 'New project' }), mini('Add a project', 'Add a project', () => {
      const name = prompt('Project title'); if (!name) return;
      let id = slug(name) || 'project'; while (c.projects[id]) id += '-2';
      c.projects[id] = { title: name, tag: '', kind: 'detail', summary: '', tech: [], links: [] };
      c.columns[0].items.push(id); picked = id; changed(true); fillPages();
    }));
    return out;
  },
  lists() {
    const out = [];
    Object.entries(c.lists).forEach(([key, l]) => {
      out.push(el('h2', { textContent: l.title }), field('List title', `lists.${key}.title`));
      l.items.forEach((_, i) => out.push(el('div', { className: 'card' }, field('Title', `lists.${key}.items.${i}.title`), field('Detail', `lists.${key}.items.${i}.detail`), el('div', { className: 'row-btns' },
        mini('↑', 'Move up', () => moveIn(l.items, i, -1), i === 0), mini('↓', 'Move down', () => moveIn(l.items, i, 1), i === l.items.length - 1), mini('Remove', 'Remove', () => { l.items.splice(i, 1); changed(true); })))));
      out.push(mini('Add row', `Add a row to ${l.title}`, () => { l.items.push({ title: 'New', detail: '' }); changed(true); }));
    });
    if (c.other) {
      out.push(el('h2', { textContent: c.other.title }), field('Section title', 'other.title'));
      c.other.items.forEach((_, i) => out.push(el('div', { className: 'card' }, field('Title', `other.items.${i}.title`), field('Line below', `other.items.${i}.detail`), el('div', { className: 'row-btns' },
        mini('\u2191', 'Move up', () => moveIn(c.other.items, i, -1), i === 0), mini('\u2193', 'Move down', () => moveIn(c.other.items, i, 1), i === c.other.items.length - 1), mini('Remove', 'Remove', () => { c.other.items.splice(i, 1); changed(true); })))));
    }
    return out;
  },
  style() {
    const color = el('input', { type: 'color', value: c.style.accent });
    color.addEventListener('input', () => { c.style.accent = color.value; changed(); });
    return [el('label', { className: 'check' }, color, 'Highlight color'),
      range('Name size', 'titleSize', 22, 72), range('Project title size', 'rowSize', 14, 34), range('Space between cards', 'rowGap', 0, 32), range('Space between columns', 'columnGap', 12, 120),
      toggle('Show the line under each project', 'showTags'), toggle('Show pictures', 'showThumbs'), toggle('Show numbers', 'showNumbers'), toggle('Show distinctions, experience and other projects', 'showExtras')];
  },
};
const LABELS = { overview: 'Overview', projects: 'Projects', lists: 'Lists', style: 'Style' };
const render = () => {
  const scroll = $('body').scrollTop;
  $('tabs').replaceChildren(...Object.keys(TABS).map((t) => { const b = el('button', { type: 'button', role: 'tab', textContent: LABELS[t] }); b.setAttribute('aria-selected', t === tab); b.addEventListener('click', () => { tab = t; render(); }); return b; }));
  $('body').replaceChildren(...TABS[tab]());
  $('body').scrollTop = scroll;
};

// The preview: the overview takes typing directly, a project page shows the saved draft as you'd scroll it.
const fillPages = () => {
  const cur = $('page').value;
  $('page').replaceChildren(el('option', { value: 'overview', textContent: 'Overview (type on it)' }), ...Object.keys(c.projects).map((id) => el('option', { value: id, textContent: c.projects[id].title })));
  if ([...$('page').options].some((o) => o.value === cur)) $('page').value = cur;
};
const loadPreview = () => {
  overviewReady = false;
  const page = $('page').value;
  store.set(DRAFT, JSON.stringify(c));
  frame.src = page === 'overview' ? `/draft/?edit=1&v=${Date.now()}` : `/draft/?draft=1&v=${Date.now()}#${page}`;
  $('tip').textContent = page === 'overview' ? 'Click any text in the preview and type.' : 'Scroll in the preview. Choose a page again to refresh it.';
};
$('page').addEventListener('change', loadPreview);
$('sizes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; [...$('sizes').children].forEach((x) => x.classList.toggle('on', x === b)); frame.style.width = b.dataset.w; });
addEventListener('message', (e) => {
  if (e.origin !== location.origin || !c) return;
  const m = e.data;
  if (m?.type === 'lc:ready') { overviewReady = true; pushPreview(); }
  if (m?.type === 'lc:edit') {
    setPath(m.path, m.value);
    document.querySelectorAll('[data-path]').forEach((n) => { if (n.dataset.path === m.path && n !== document.activeElement) n.value = m.value; });
    changed();
  }
  if (m?.type === 'lc:focus') {
    const hit = /^projects\.([^.]+)/.exec(m.path);
    if (hit && (tab !== 'projects' || picked !== hit[1])) { picked = hit[1]; tab = 'projects'; render(); }
  }
});

// Saving out.
$('download').addEventListener('click', () => { const a = el('a', { href: URL.createObjectURL(new Blob([`${JSON.stringify(c, null, 2)}\n`], { type: 'application/json' })), download: 'content.json' }); a.click(); URL.revokeObjectURL(a.href); });
$('reset').addEventListener('click', () => { if (!dirty() || !confirm('Discard your changes and go back to the live version?')) return; c = clone(published); store.del(DRAFT); render(); fillPages(); loadPreview(); setStatus('Matches the live site'); });
$('publish').addEventListener('click', () => { $('token').value = store.get(TOKEN) || ''; $('remember').checked = !!store.get(TOKEN); $('dlgmsg').textContent = ''; $('dlg').showModal(); });
const toB64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
$('go').addEventListener('click', async () => {
  const token = $('token').value.trim();
  if (!token) { $('dlgmsg').textContent = 'Paste your token first.'; return; }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  $('go').disabled = true; $('dlgmsg').textContent = 'Publishing';
  try {
    const cur = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}?ref=main&t=${Date.now()}`, { headers });
    if (!cur.ok) throw new Error(cur.status === 401 || cur.status === 403 || cur.status === 404 ? 'GitHub refused that token. Check it covers ciordas.dev with Contents read and write.' : `GitHub said ${cur.status}.`);
    const { sha } = await cur.json();
    const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, { method: 'PUT', headers, body: JSON.stringify({ message: 'Update site content', content: toB64(`${JSON.stringify(c, null, 2)}\n`), sha, branch: 'main' }) });
    if (!put.ok) throw new Error(`GitHub said ${put.status} when saving.`);
    $('remember').checked ? store.set(TOKEN, token) : store.del(TOKEN);
    published = clone(c); store.del(DRAFT);
    setStatus('Published, live in about a minute');
    $('dlg').close();
  } catch (err) { $('dlgmsg').textContent = err.message; } finally { $('go').disabled = false; }
});

// Start from the live file, and pick up unpublished work if there is any.
published = await (await fetch(`../data/content.json?t=${Date.now()}`)).json();
let draft = null;
try { draft = JSON.parse(store.get(DRAFT)); } catch { /* no usable draft */ }
c = draft || clone(published);
setStatus(dirty() ? 'Restored your unpublished changes' : 'Matches the live site');
fillPages(); render(); loadPreview();
