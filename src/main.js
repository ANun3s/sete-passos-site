import { initNavigation } from './navigation.js';
import { initAuth } from './auth.js';
import { initAccountHeader } from './account-header.js';
import { initProfile } from './profile.js';
import { initAdmin } from './admin.js';
import { initGlassButtons } from './motion.js';
import { initContact } from './contact.js';
import { initLogoDepth } from './logo.js';
import { initTiltedCards } from './tilted-card.js';
import { initAboutMotion } from './about-motion.js';
import { initContentAnchors } from './scroll-position.js';
import { initCardSwap } from './card-swap.js';
import { initHomePreviews } from './home-previews.js';

import { createPageCurtain } from './page-curtain.js';

function initAboutDither({ signal } = {}) {
  const container = document.querySelector('[data-dither-veil]');
  if (!container || signal?.aborted) return () => {};
  let cancelled = false;
  let dispose = () => {};
  const stop = () => { cancelled = true; dispose(); };
  const number = (key, fallback) => {
    const value = Number(container.dataset[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  import('./components/DitherVeil.js').then(({ initDitherVeil }) => {
    if (cancelled || signal?.aborted || !container.isConnected) return;
    dispose = initDitherVeil(container, {
      src: container.dataset.src,
      fallbackSrc: container.dataset.fallbackSrc,
      pattern: container.dataset.pattern || 'floyd',
      pixelSize: number('pixelSize', 2),
      inkColor: container.dataset.inkColor || '#ffffff',
      paperColor: container.dataset.paperColor || '#3b82f6',
      revealRadius: number('revealRadius', 200),
      softness: number('softness', 0.6),
      linger: number('linger', 1),
      rimColor: container.dataset.rimColor || '#3b82f6',
      fit: container.dataset.fit || 'contain',
      palette: container.dataset.palette || 'duotone',
      levels: number('levels', 2),
      contrast: number('contrast', 1.15),
      brightness: number('brightness', 0),
      rim: number('rim', 0),
      reverse: container.dataset.reverse === 'true',
      wander: container.dataset.wander === 'true',
      clickBurst: container.dataset.clickBurst !== 'false',
    });
  }).catch(error => console.warn('DitherVeil: não foi possível iniciar o efeito.', error));
  signal?.addEventListener('abort', stop, { once: true });
  return () => { signal?.removeEventListener('abort', stop); stop(); };
}

function initCareFolder({ signal } = {}) {
  const host = document.querySelector('[data-care-folder-root]');
  if (!host || signal?.aborted) return () => {};
  let cancelled = false;
  let dispose = () => {};
  import('./care-folder.jsx').then(({ mountCareFolder }) => {
    if (cancelled || signal?.aborted || !host.isConnected) return;
    dispose = mountCareFolder(host);
  }).catch(error => console.warn('Pasta de cuidados: não foi possível iniciar a interação.', error));
  const stop = () => { cancelled = true; dispose(); };
  signal?.addEventListener('abort', stop, { once: true });
  return () => { signal?.removeEventListener('abort', stop); stop(); };
}

function initStoriesDriftWall({ signal } = {}) {
  const host = document.querySelector('[data-drift-wall]');
  if (!host || signal?.aborted) return () => {};
  let cancelled = false;
  let dispose = () => {};
  import('./stories-drift-wall.js').then(({ mountStoriesDriftWall }) => {
    if (cancelled || signal?.aborted || !host.isConnected) return;
    dispose = mountStoriesDriftWall(host);
  }).catch(error => console.warn('DriftWall: não foi possível iniciar a animação.', error));
  const stop = () => { cancelled = true; dispose(); };
  signal?.addEventListener('abort', stop, { once: true });
  return () => { signal?.removeEventListener('abort', stop); stop(); };
}

function initTeamCards({ signal } = {}) {
  const host = document.querySelector('[data-team-cards]');
  if (!host || signal?.aborted) return () => {};
  let cancelled = false;
  let dispose = () => {};
  import('./team-cards.jsx').then(({ mountTeamCards }) => {
    if (cancelled || signal?.aborted || !host.isConnected) return;
    dispose = mountTeamCards(host);
  }).catch(error => console.warn('Nossa equipe: não foi possível iniciar os cartões.', error));
  const stop = () => { cancelled = true; dispose(); };
  signal?.addEventListener('abort', stop, { once: true });
  return () => { signal?.removeEventListener('abort', stop); stop(); };
}

function mountPage() {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  initNavigation(options);
  initAuth(options);
  const disposeHeader = initAccountHeader(options);
  const disposeProfile = initProfile(options);
  const disposeAdmin = initAdmin(options);
  const disposeCareFolder = initCareFolder(options);
  const disposeStoriesDriftWall = initStoriesDriftWall(options);
  const disposeTeamCards = initTeamCards(options);
  const disposeAboutMotion = initAboutMotion(options);
  const disposeAboutDither = initAboutDither(options);
  initGlassButtons(options);
  initLogoDepth(options);
  initTiltedCards(options);
  initContentAnchors(options);
  initContact(options);
  const disposeCardSwap = initCardSwap(options);
  const disposeHomePreviews = initHomePreviews(options);
  return () => { controller.abort(); disposeHeader(); disposeProfile(); disposeAdmin(); disposeCareFolder(); disposeStoriesDriftWall(); disposeTeamCards(); disposeAboutMotion(); disposeAboutDither(); disposeCardSwap(); disposeHomePreviews(); };
}

// Adjust angle/duration/easing here; colors live in page-curtain.css.
createPageCurtain({ mount: mountPage, angle: 9, duration: 780, easing: 'cubic-bezier(.76, 0, .24, 1)' });
