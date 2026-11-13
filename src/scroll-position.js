/** Stable document coordinates; sections never pin or animate during scrolling. */
export function layoutTop(element) {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
}

export function scrollToContent(target) {
  if (target.id === 'inicio') window.scrollTo({ top: 0, behavior: 'instant' });
  else target.scrollIntoView({ behavior: 'instant', block: 'start' });
}

export function initContentAnchors({ signal } = {}) {
  function targetFor(hash) {
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || link.hasAttribute('data-contact') || link.hasAttribute('download') ||
        (link.target && link.target !== '_self') || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    const path = value => value === '/' ? '/index.html' : value;
    if (url.origin !== location.origin || path(url.pathname) !== path(location.pathname) || !url.hash) return;
    const target = targetFor(url.hash);
    if (!target || link.hasAttribute('data-admin-section')) return;
    event.preventDefault();
    if (url.hash !== location.hash) history.pushState(history.state, '', url.hash);
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    scrollToContent(target);
  }, { signal });
  function restoreFragment() {
    const target = targetFor(location.hash);
    if (target) scrollToContent(target);
  }
  window.addEventListener('hashchange', restoreFragment, { signal });
  const initialHash = location.hash;
  document.fonts.ready.then(() => {
    if (!signal?.aborted && initialHash && location.hash === initialHash) restoreFragment();
  });
}
