import { gsap } from './vendor/gsap.mjs';

/** Vanilla adaptation of React Bits CardSwap for this project's non-React shell.
 * Source reference: https://reactbits.dev/r/CardSwap-JS-CSS.json
 * The existing local GSAP bundle handles the 3D card transitions.
 */
export function initCardSwap({ signal } = {}) {
  const root = document.querySelector('[data-card-swap]');
  if (!root || signal?.aborted) return () => {};

  const stage = root.querySelector('[data-swap-stage]');
  const cards = [...root.querySelectorAll('[data-swap-card]')];
  const nextButton = root.querySelector('[data-swap-next]');
  const previousButton = root.querySelector('[data-swap-previous]');
  const toggleButton = root.querySelector('[data-swap-toggle]');
  const toggleLabel = root.querySelector('[data-swap-toggle-label]');
  const status = root.querySelector('[data-swap-status]');
  if (!stage || cards.length < 2 || !nextButton || !toggleButton) return () => {};

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let order = [...cards];
  let timer = 0;
  let active = true;
  let focused = false;
  let manuallyPaused = false;
  let moving = false;
  let drag = null;
  let geometry = null;
  let observer;
  let resizeObserver;
  const events = new AbortController();
  const eventSignal = events.signal;

  const isPaused = () => !active || focused || manuallyPaused || reducedMotion.matches || document.hidden;

  function updateControls() {
    const pause = reducedMotion.matches;
    toggleButton.hidden = pause;
    toggleButton.setAttribute('aria-pressed', String(manuallyPaused));
    if (toggleLabel) toggleLabel.textContent = manuallyPaused ? 'Retomar apresentação' : 'Pausar apresentação';
    root.dataset.motion = pause ? 'reduced' : 'full';
  }

  function announce(shouldAnnounce) {
    if (!status) return;
    const activeCard = order[0];
    const index = cards.indexOf(activeCard) + 1;
    status.setAttribute('aria-live', shouldAnnounce ? 'polite' : 'off');
    status.textContent = `${activeCard.dataset.swapTitle || 'Imagem'} — ${index} de ${cards.length}.`;
  }

  function updateAccessibleCards() {
    order.forEach((card, position) => {
      const isFront = position === 0;
      card.toggleAttribute('data-front', isFront);
      card.setAttribute('aria-hidden', String(!isFront));
      card.inert = !isFront;
      card.style.zIndex = String(cards.length - position);
    });
  }

  function layout({ animate = true } = {}) {
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    if (!stageWidth || !stageHeight) return;
    const pad = 18;
    const distance = Math.min(40, stageWidth * 0.065);
    const verticalDistance = Math.min(36, stageHeight * 0.09);
    const spread = distance * (order.length - 1);
    const cardWidth = Math.max(200, Math.min(470, stageWidth - pad * 2 - spread));
    const cardHeight = Math.min(stageHeight * 0.88, cardWidth * 0.76);
    geometry = { stageWidth, stageHeight, distance, verticalDistance, spread, cardWidth, cardHeight };

    root.style.setProperty('--swap-w', `${cardWidth}px`);
    root.style.setProperty('--swap-h', `${cardHeight}px`);
    root.style.setProperty('--swap-ox', `${stageWidth / 2}px`);
    root.style.setProperty('--swap-oy', `${stageHeight / 2}px`);
    root.style.setProperty('--swap-radius', '22px');

    order.forEach((card, position) => {
      const target = {
        x: position * distance - spread / 2,
        y: (order.length - 1) * verticalDistance / 2 - position * verticalDistance,
        z: -position * 28,
        rotationY: position * -3.5,
        rotation: position * 0.8,
        skewY: 5.5,
        scale: 1 - position * 0.045,
        opacity: Math.max(0, 1 - position * 0.13),
        duration: reducedMotion.matches || !animate ? 0 : 0.62,
        ease: 'power3.out',
        overwrite: true,
      };
      if (animate && !reducedMotion.matches) gsap.to(card, target);
      else gsap.set(card, target);
    });
    updateAccessibleCards();
  }

  function clearTimer() {
    window.clearTimeout(timer);
    timer = 0;
  }

  function schedule() {
    clearTimer();
    if (isPaused() || moving) return;
    timer = window.setTimeout(() => move('next', false), 4300);
  }

  function move(direction, userInitiated = true) {
    clearTimer();
    if (moving || !order.length) return;
    moving = true;
    const outgoing = order[0];
    const stageWidth = stage.clientWidth || 360;
    const distance = direction === 'previous' ? stageWidth * 0.82 : -stageWidth * 0.82;
    const finish = () => {
      order = direction === 'previous'
        ? [order[order.length - 1], ...order.slice(0, -1)]
        : [...order.slice(1), order[0]];
      moving = false;
      layout({ animate: true });
      announce(userInitiated);
      schedule();
    };

    if (reducedMotion.matches) {
      finish();
      return;
    }
    gsap.to(outgoing, {
      x: distance,
      y: -12,
      z: 50,
      rotationY: direction === 'previous' ? -18 : 18,
      rotation: direction === 'previous' ? -8 : 8,
      opacity: 0,
      duration: 0.42,
      ease: 'power2.in',
      overwrite: true,
      onComplete: finish,
    });
  }

  function onPointerDown(event) {
    const card = event.target.closest('[data-swap-card]');
    if (!card || card !== order[0] || moving || event.button > 0) return;
    clearTimer();
    drag = {
      card,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      baseX: Number(gsap.getProperty(card, 'x')) || 0,
      baseY: Number(gsap.getProperty(card, 'y')) || 0,
      baseRotation: Number(gsap.getProperty(card, 'rotation')) || 0,
      started: false,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
    };
    card.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const now = performance.now();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.started && Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
    if (Math.abs(dx) < Math.abs(dy) * 0.8 && !drag.started) return;
    drag.started = true;
    drag.dx = dx;
    drag.dy = dy;
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocityX = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    root.dataset.dragging = 'true';
    event.preventDefault();
    gsap.set(drag.card, {
      x: drag.baseX + dx,
      y: drag.baseY + Math.max(-24, Math.min(24, dy * 0.16)),
      rotation: drag.baseRotation + Math.max(-12, Math.min(12, dx * 0.025)),
      scale: 1.025,
      overwrite: true,
    });
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    try { current.card.releasePointerCapture?.(event.pointerId); } catch { /* capture may already be released */ }
    drag = null;
    delete root.dataset.dragging;
    if (current.started) {
      const threshold = Math.max(48, (geometry?.cardWidth || 320) * 0.16);
      const flick = Math.abs(current.velocityX) > 0.45 && Math.abs(current.dx) > 26;
      if (Math.abs(current.dx) >= threshold || flick) {
        move(current.dx < 0 ? 'next' : 'previous');
        return;
      }
      layout({ animate: true });
    }
    schedule();
  }

  function syncAutoplay() {
    if (isPaused()) clearTimer();
    else schedule();
  }

  nextButton.addEventListener('click', () => move('next'), { signal: eventSignal });
  previousButton?.addEventListener('click', () => move('previous'), { signal: eventSignal });
  toggleButton.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    updateControls();
    syncAutoplay();
  }, { signal: eventSignal });
  stage.addEventListener('pointerdown', onPointerDown, { signal: eventSignal });
  stage.addEventListener('pointermove', onPointerMove, { signal: eventSignal });
  stage.addEventListener('pointerup', onPointerUp, { signal: eventSignal });
  stage.addEventListener('pointercancel', onPointerUp, { signal: eventSignal });
  root.addEventListener('focusin', () => { focused = true; syncAutoplay(); }, { signal: eventSignal });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) { focused = false; syncAutoplay(); }
  }, { signal: eventSignal });
  document.addEventListener('visibilitychange', syncAutoplay, { signal: eventSignal });

  const motionChanged = () => { updateControls(); layout({ animate: false }); syncAutoplay(); };
  reducedMotion.addEventListener?.('change', motionChanged);
  if (!reducedMotion.addEventListener) reducedMotion.addListener(motionChanged);

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      active = entries.some(entry => entry.isIntersecting);
      syncAutoplay();
    }, { threshold: 0.15 });
    observer.observe(root);
  }
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => layout({ animate: false }));
    resizeObserver.observe(stage);
  } else window.addEventListener('resize', () => layout({ animate: false }), { signal: eventSignal });

  updateControls();
  root.dataset.ready = 'true';
  layout({ animate: false });
  announce(false);
  syncAutoplay();

  return () => {
    clearTimer();
    events.abort();
    observer?.disconnect();
    resizeObserver?.disconnect();
    reducedMotion.removeEventListener?.('change', motionChanged);
    if (!reducedMotion.removeEventListener) reducedMotion.removeListener(motionChanged);
    gsap.killTweensOf(cards);
  };
}
