// Thin progress bar on the right edge that shows only while scrolling.
export function mountScrollBar({ root = document.body } = {}) {
  const el = document.createElement('div'); el.className = 'scroll-bar'; el.innerHTML = '<i></i>';
  root.appendChild(el);
  const bar = el.firstChild; let t;
  const up = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    bar.style.transform = `translateY(${(scrollY / max) * 900}%)`;
    el.classList.add('on'); clearTimeout(t); t = setTimeout(() => el.classList.remove('on'), 900);
  };
  addEventListener('scroll', up, { passive: true });
  return el;
}
