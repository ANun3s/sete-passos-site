import { gsap } from './vendor/gsap.mjs';

/** A reversible disclosure, not a modal. Native links work without JavaScript. */
export function initNavigation({ signal } = {}) {
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('#main-nav');
  const toggle = document.querySelector('.menu-toggle');
  if (!header || !nav || !toggle) return;
  const compact = matchMedia('(max-width: 800px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let open = false;
  const state = { progress: 0 };
  function paint() {
    const { progress } = state;
    nav.style.setProperty('--menu-progress', progress);
    nav.style.setProperty('--menu-shift', `${(1 - progress) * -6}px`);
    nav.style.setProperty('--menu-scale', .98 + progress * .02);
  }
  function finish() {
    delete nav.dataset.animating;
    if (!open && compact.matches) delete nav.dataset.visible;
  }
  function animateTo(progress, immediate = false) {
    gsap.killTweensOf(state);
    if (immediate) { state.progress = progress; paint(); finish(); return; }
    nav.dataset.animating = 'true';
    gsap.to(state, { progress, duration: .22, ease: 'power2.out', onUpdate: paint, onComplete: finish });
  }

  function measureRoom() {
    // The header grows with text size. Reserve space from its actual lower edge.
    nav.style.setProperty('--menu-room', `${Math.max(0, innerHeight - header.getBoundingClientRect().bottom)}px`);
  }

  function setOpen(next, restoreFocus = false, immediate = false) {
    if (compact.matches) measureRoom();
    const hadFocus = nav.contains(document.activeElement);
    open = compact.matches && next;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.inert = compact.matches && !open;
    nav.dataset.visible = 'true';
    header.classList.toggle('menu-open', open);
    if (!open) nav.dispatchEvent(new Event('navigation-close')); 
    animateTo(!compact.matches || open ? 1 : 0, immediate || reduced.matches || !compact.matches);
    // Focus changes immediately; input is never locked while the material settles.
    if (open) nav.querySelector('a')?.focus({ preventScroll: true });
    else if (compact.matches && (restoreFocus || hadFocus)) toggle.focus({ preventScroll: true });
  }

  function settle() {
    animateTo(!compact.matches || open ? 1 : 0, true);
  }

  document.documentElement.classList.add('navigation-ready');
  setOpen(false, false, true);
  toggle.addEventListener('click', () => setOpen(!open, open), { signal });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) setOpen(false, true);
  }, { signal });
  document.addEventListener('click', (event) => {
    if (open && !header.contains(event.target)) setOpen(false);
  }, { signal });
  compact.addEventListener('change', () => setOpen(false, false, true), { signal });
  reduced.addEventListener('change', settle, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle();
  }, { signal });
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(measureRoom) : null;
  resizeObserver?.observe(header);
  window.addEventListener('resize', measureRoom, { passive: true, signal });
  signal?.addEventListener('abort', () => {
    gsap.killTweensOf(state);
    resizeObserver?.disconnect();
  }, { once: true });
}
