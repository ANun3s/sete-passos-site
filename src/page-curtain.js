import { createCurtainEffect, pageCurtainDirection } from './curtain-effect.js';
import { loadPageDocument } from './page-document.js';
import { scrollToContent } from './scroll-position.js';

export const routes = [
  { key: 'inicio', path: '/index.html', title: 'Início' },
  { key: 'sobre', path: '/sobre.html', title: 'Sobre a Sete Passos' },
  { key: 'historias', path: '/historias.html', title: 'Casos de sucesso' },
  { key: 'equipe', path: '/equipe.html', title: 'Nossa equipe' },
  { key: 'login', path: '/login.html', title: 'Login' },
  { key: 'perfil', path: '/perfil.html', title: 'Meu perfil' },
  { key: 'admin', path: '/admin.html', title: 'Administração' },
];

/** Vanilla equivalent of usePageCurtain: no React/runtime dependency needed. */
export function createPageCurtain({ mount, titles = routes.map(route => route.title), angle = 9, duration = 780, easing = 'cubic-bezier(.76, 0, .24, 1)', initial } = {}) {
  const ref = document.querySelector('#page-curtain');
  let content = document.querySelector('#page-content');
  const announcement = document.querySelector('#page-announcement');
  const errorNotice = document.querySelector('#navigation-error');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const effect = createCurtainEffect(ref, { angle, duration, easing });
  const events = new AbortController();
  let page = initial ?? routes.findIndex(route => route.key === content.dataset.page);
  let isPending = false;
  let queuedHistory;
  let activeNavigation;
  let dispose = mount?.();

  function routeIndex(url) {
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    return url.origin === location.origin ? routes.findIndex(route => route.path === path) : -1;
  }

  function pending(value) {
    isPending = value;
    content.inert = value;
    content.setAttribute('aria-busy', String(value));
    document.documentElement.classList.toggle('is-navigating', value);
    // Modal dialogs live in the top layer and must be closed explicitly, not just inherited-inert.
    if (value) content.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  }

  function positionAndFocus(url) {
    let target;
    try {
      const found = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (found instanceof HTMLElement && content.contains(found) && !found.matches(':disabled')) target = found;
    } catch {
      // An invalid URL escape is not a reason to leave navigation half-finished.
    }
    const focusTarget = target || content.querySelector('main h1');
    if (!focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    if (target) scrollToContent(target);
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function go(next, { href = routes[next]?.path, historyMode = 'push' } = {}) {
    if (isPending || !routes[next] || next === page) return false;
    const url = new URL(href, location.href);
    if (routeIndex(url) !== next) return false;
    const previousFocus = document.activeElement;
    const navigation = new AbortController();
    activeNavigation = navigation;
    pending(true);
    errorNotice.hidden = true;
    announcement.textContent = `Abrindo ${titles[next]}`;
    let succeeded = false;
    let committed = false;
    let loaded;
    try {
      // Fetch before animating: network latency never leaves an opaque screen stuck.
      loaded = await loadPageDocument(routes[next], url.href, navigation.signal);
      if (navigation.signal.aborted) return false;
      const animated = !reduced.matches && typeof ref.animate === 'function';
      const direction = pageCurtainDirection(page, next);
      if (animated) await effect.cover(titles[next], direction);
      if (navigation.signal.aborted) return false;
      const update = () => {
        // A newer history intent invalidates this click before it can push a stale URL.
        if (committed || navigation.signal.aborted) return;
        loaded.activateStyles?.();
        committed = true;
        dispose?.();
        loaded.content.inert = true;
        loaded.content.setAttribute('aria-busy', 'true');
        content.replaceWith(loaded.content);
        content = loaded.content;
        document.title = loaded.title;
        document.querySelector('meta[name="description"]').content = loaded.description;
        document.body.classList.remove('dialog-open');
        if (historyMode === 'push') history.pushState({ page: routes[next].key }, '', url.href);
        page = next;
        dispose = mount?.();
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      };
      if (animated && !document.hidden && typeof document.startViewTransition === 'function') {
        try {
          const transition = document.startViewTransition(update);
          transition.ready.catch(() => {}); // A browser may skip an otherwise valid transition.
          await transition.updateCallbackDone;
          await transition.finished;
        } catch {
          if (!committed) update();
        }
      } else update();
      if (navigation.signal.aborted) return false;
      if (animated) await effect.reveal();
      succeeded = true;
    } catch {
      if (!navigation.signal.aborted) {
        errorNotice.textContent = 'Não foi possível abrir esta página. Verifique a conexão e tente novamente.';
        errorNotice.hidden = false;
        announcement.textContent = 'A navegação não foi concluída.';
        // A failed history fetch must not leave a different document behind the URL.
        if (historyMode === 'none' && !queuedHistory) location.assign(url.href);
      }
    } finally {
      if (!committed) loaded?.cleanupStyles?.();
      effect.reset();
      pending(false);
      activeNavigation = undefined;
      if (succeeded) {
        positionAndFocus(url);
        announcement.textContent = `Navegou para ${titles[page]}`;
      } else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      // Clicks are ignored while pending; browser history instead keeps its latest intent.
      if (queuedHistory) {
        const queued = queuedHistory;
        queuedHistory = undefined;
        const nextPage = routeIndex(queued);
        if (nextPage >= 0 && nextPage !== page) void go(nextPage, { href: queued.href, historyMode: 'none' });
        else {
          positionAndFocus(queued);
          announcement.textContent = `Navegou para ${titles[page]}`;
        }
      }
    }
    return succeeded;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    const next = routeIndex(url);
    if (next < 0) return;
    if (isPending) { event.preventDefault(); return; }
    if (next === page) return; // Preserve native fragments and same-document links.
    event.preventDefault();
    void go(next, { href: url.href });
  }, { signal: events.signal });

  // Real documents keep refresh/no-JS working; History API keeps back/forward in sync.
  window.addEventListener('popstate', () => {
    const url = new URL(location.href);
    if (isPending) {
      queuedHistory = url;
      activeNavigation.abort();
      effect.reset();
      return;
    }
    const next = routeIndex(url);
    if (next >= 0 && next !== page) void go(next, { href: url.href, historyMode: 'none' });
  }, { signal: events.signal });

  return {
    get page() { return page; },
    get isPending() { return isPending; },
    go,
    ref,
    destroy() {
      events.abort();
      queuedHistory = undefined;
      activeNavigation?.abort();
      dispose?.();
      effect.reset();
      pending(false);
    },
  };
}
