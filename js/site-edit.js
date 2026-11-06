// The overview inside the editor: every text is typed on directly, and changes go back to the editor around it.
import { renderOverview } from './site.js';

const post = (msg) => window.parent.postMessage(msg, location.origin);

export function mountEditable(root) {
  root.hidden = false;
  document.body.classList.remove('is-intro'); document.body.classList.add('is-portfolio', 'is-editing');
  document.documentElement.classList.add('can-scroll');
  const paint = (content) => {
    const editing = root.contains(document.activeElement) && document.activeElement.isContentEditable;
    if (editing) return;
    renderOverview(root, content);
    root.querySelectorAll('.ov-reveal').forEach((n) => { n.style.opacity = 1; });
    root.querySelectorAll('[data-edit]').forEach((n) => { n.contentEditable = 'plaintext-only'; n.spellcheck = true; });
  };
  root.addEventListener('input', (e) => {
    const n = e.target.closest('[data-edit]');
    if (n) post({ type: 'lc:edit', path: n.dataset.edit, value: n.textContent });
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('[data-edit]')) { e.preventDefault(); e.target.blur(); } });
  root.addEventListener('focusin', (e) => {
    const n = e.target.closest('[data-edit]');
    if (n) post({ type: 'lc:focus', path: n.dataset.edit });
  });
  root.addEventListener('focusout', () => post({ type: 'lc:blur' }));
  root.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'lc:content') paint(e.data.content);
  });
  post({ type: 'lc:ready' });
}
