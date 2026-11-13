import { revealAccountSurface, clearAccountMotion } from './account-motion.js';
import { ACCOUNT_EVENT, DEFAULT_AVATAR, adminAccess, notifyAccountChanged, request, session, setAvatar } from './account-api.js';

export function initAccountHeader({ signal } = {}) {
  const nav = document.querySelector('.main-nav');
  const link = nav?.querySelector('[data-account-link], a[href="/login.html"], a[href="/perfil.html"]');
  if (!link) return () => {};
  let adminLink = nav.querySelector('[data-admin-link]');
  if (!adminLink) {
    adminLink = document.createElement('a');
    adminLink.href = '/admin.html'; adminLink.dataset.adminLink = ''; adminLink.textContent = 'Administração'; adminLink.hidden = true;
    const cta = nav.querySelector('.nav-cta');
    nav.insertBefore(adminLink, cta || null);
  }
  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const events = { signal: controller.signal };
  const home = document.createComment('account-link');
  link.before(home);
  const menu = document.createElement('div');
  menu.className = 'account-menu'; menu.hidden = true;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'account-toggle';
  toggle.setAttribute('aria-label', 'Abrir menu da conta');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'account-dropdown');
  const image = document.createElement('img');
  image.width = 32; image.height = 32; image.alt = ''; image.src = DEFAULT_AVATAR;
  image.dataset.accountAvatar = '';
  const chevron = document.createElement('span');
  chevron.className = 'account-chevron'; chevron.setAttribute('aria-hidden', 'true');
  toggle.append(image, chevron);
  const dropdown = document.createElement('div');
  dropdown.id = 'account-dropdown'; dropdown.className = 'account-dropdown'; dropdown.inert = true;
  const name = document.createElement('span');
  name.className = 'account-menu-name'; name.dataset.accountName = '';
  const status = document.createElement('span');
  status.className = 'account-header-status'; status.setAttribute('role', 'alert'); status.hidden = true;
  const logout = document.createElement('button');
  logout.type = 'button'; logout.className = 'account-signout'; logout.textContent = 'Sair';
  dropdown.append(name, logout, status); menu.append(toggle, dropdown); nav.append(menu);
  link.dataset.accountLink = '';
  let revision = 0;
  let disposed = false;
  let open = false;
  let closeTimer;
  let hoverOpened = false;
  function setOpen(next, focus = false) {
    clearTimeout(closeTimer);
    const previouslyOpen = open;
    open = next && !menu.hidden;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    dropdown.inert = !open;
    if (open && !previouslyOpen) revealAccountSurface(dropdown);
    else if (!open) clearAccountMotion(dropdown);
    if (!open) hoverOpened = false;
    if (focus) (open ? link : toggle).focus({ preventScroll: true });
  }
  menu.addEventListener('pointerenter', (event) => {
    clearTimeout(closeTimer);
    if (event.pointerType === 'mouse' && matchMedia('(hover: hover)').matches && !open) {
      setOpen(true); hoverOpened = true;
    }
  }, events);
  menu.addEventListener('pointerleave', () => {
    if (!dropdown.contains(document.activeElement)) closeTimer = setTimeout(() => setOpen(false), 160);
  }, events);
  toggle.addEventListener('click', () => {
    if (hoverOpened) { hoverOpened = false; return; }
    setOpen(!open);
  }, events);
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false, true);
    } else if (event.target === toggle && event.key === 'ArrowDown') {
      event.preventDefault(); setOpen(true, true);
    }
  }, events);
  menu.addEventListener('focusout', (event) => {
    // activeElement is temporarily the body between blur and the next focus.
    if (!menu.contains(event.relatedTarget)) setOpen(false);
  }, events);
  link.addEventListener('click', () => setOpen(false), events);
  document.addEventListener('pointerdown', (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  }, events);
  nav.addEventListener('navigation-close', () => setOpen(false), events);
  function render(user) {
    const wasAuthenticated = !menu.hidden;
    menu.hidden = !user;
    if (wasAuthenticated !== Boolean(user)) setOpen(false);
    link.classList.toggle('account-link', Boolean(user));
    link.replaceChildren();
    link.href = user ? '/perfil.html' : '/login.html';
    const active = document.querySelector('#page-content')?.dataset.page === (user ? 'perfil' : 'login');
    active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
    link.removeAttribute('aria-label');
    link.textContent = user ? 'Meu perfil' : 'Login';
    adminLink.hidden = true;
    if (document.querySelector('#page-content')?.dataset.page === 'admin') adminLink.setAttribute('aria-current', 'page');
    else adminLink.removeAttribute('aria-current');
    if (user) {
      setAvatar(image, user.image);
      name.textContent = user.name;
      toggle.title = `Conta de ${user.name}`;
      if (link.parentElement !== dropdown) dropdown.insertBefore(link, logout);
    } else { home.after(link); }
  }
  async function refresh() {
    const current = ++revision;
    try {
      const result = await session(signal);
      if (!disposed && !signal?.aborted && current === revision) {
        render(result?.user);
        if (result?.user) {
          try {
            const access = await adminAccess(signal);
            if (!disposed && !signal?.aborted && current === revision) adminLink.hidden = access.authorized !== true;
          } catch { if (!disposed && current === revision) adminLink.hidden = true; }
        }
      }
    } catch { if (!disposed && !signal?.aborted && current === revision) render(null); }
  }
  function changed(event) {
    const kind = event.detail?.kind || event.data?.kind;
    if (kind === 'signed-out') { revision++; render(null); }
    else refresh();
  }
  logout.addEventListener('click', async () => {
    if (logout.disabled) return;
    logout.disabled = true; status.hidden = true;
    try {
      await request('/api/auth/sign-out', { method: 'POST', body: {}, signal });
      notifyAccountChanged('signed-out');
      // A mounted private page handles invalidation and redirects exactly once.
    } catch {
      if (!signal?.aborted) { status.textContent = 'Não foi possível sair. Tente novamente.'; status.hidden = false; }
    } finally { logout.disabled = false; }
  }, events);
  window.addEventListener(ACCOUNT_EVENT, changed, events);
  window.addEventListener('focus', refresh, events);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }, events);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sete-passos-account') : null;
  channel?.addEventListener('message', changed);
  refresh();
  return () => { clearAccountMotion(dropdown); disposed = true; revision++; clearTimeout(closeTimer); controller.abort(); channel?.close(); };
}
