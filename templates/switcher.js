// Small tab switcher shown on every page of the site.
// Edit TABS to add, rename, or remove a tab.
(() => {
  const TABS = [
    { key: '0', label: 'Home', href: '/' },
    { key: '1', label: 'Monolith', href: '/templates/01-monolith/' },
    { key: '2', label: 'Expedition', href: '/templates/02-expedition/' },
    { key: '3', label: 'Circuit', href: '/templates/03-circuit/' },
    { key: '4', label: 'Draft', href: '/draft/' },
    { key: '5', label: 'Editor', href: '/draft/edit/' },
  ];
  if (window.self !== window.top || document.getElementById('site-tabs')) return;

  const path = location.pathname;
  const isActive = (t) => (t.href === '/' ? path === '/' || path === '/index.html' : path.startsWith(t.href) && !TABS.some((o) => o.href.length > t.href.length && o.href.startsWith(t.href) && path.startsWith(o.href)));

  const host = document.createElement('div');
  host.id = 'site-tabs';
  host.style.cssText = 'position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      nav { display:flex; flex-direction:column; align-items:flex-end; gap:2px; opacity:.45; transition:opacity .2s ease;
            font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.02em; }
      nav:hover, nav:focus-within { opacity:1; }
      a { display:flex; align-items:center; justify-content:flex-end; gap:6px; height:20px; padding:0 5px 0 6px;
          border-radius:4px 0 0 4px; color:#f4f4ed; background:rgba(20,20,22,.55); text-decoration:none;
          -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); transition:background .2s ease; }
      a:hover, a:focus-visible { background:rgba(20,20,22,.92); outline:none; }
      a[aria-current] { background:#f4f4ed; color:#141416; }
      .label { max-width:0; overflow:hidden; white-space:nowrap; transition:max-width .25s ease; }
      nav:hover .label, nav:focus-within .label { max-width:80px; }
      @media (prefers-reduced-motion: reduce) { nav, a, .label { transition:none; } }
      @media (max-width: 600px) { a { height:26px; padding:0 7px 0 8px; } }
    </style>
    <nav aria-label="Site tabs">
      ${TABS.map((t) => `<a href="${t.href}" title="${t.label}" aria-label="${t.label}"${isActive(t) ? ' aria-current="page"' : ''}><span class="label">${t.label}</span><span>${t.key}</span></a>`).join('')}
    </nav>`;

  // Keep pointer, wheel, and key input on the tabs from reaching full-screen page handlers.
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'wheel'].forEach((type) =>
    host.addEventListener(type, (e) => e.stopPropagation()));

  const mount = () => document.body.appendChild(host);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
