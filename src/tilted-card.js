import { springValue, styleEffect } from './vendor/motion.mjs';

/** Adaptation of React Bits TiltedCard; the outer card belongs to scroll. */
export function initTiltedCards({ signal } = {}) {
  const allowed = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const spring = { damping: 30, stiffness: 100, mass: 2 };
  document.querySelectorAll('[data-tilted-card]').forEach(card => {
    const inner = card.querySelector('.tilted-card-inner');
    const rotateX = springValue(0, spring);
    const rotateY = springValue(0, spring);
    const scale = springValue(1, spring);
    const stopRendering = styleEffect(inner, { rotateX, rotateY, scale });
    let frame = 0;
    let pointer;
    function reset(immediate = false) {
      cancelAnimationFrame(frame);
      frame = 0;
      const method = immediate ? 'jump' : 'set';
      rotateX[method](0);
      rotateY[method](0);
      scale[method](1);
    }
    function update() {
      frame = 0;
      if (!allowed.matches || signal?.aborted) return;
      const rect = card.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (pointer.x - rect.left - rect.width / 2) / (rect.width / 2)));
      const y = Math.max(-1, Math.min(1, (pointer.y - rect.top - rect.height / 2) / (rect.height / 2)));
      rotateX.set(-y * 6);
      rotateY.set(x * 8);
      scale.set(1.025);
    }
    card.addEventListener('pointermove', event => {
      if (!allowed.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true, signal });
    card.addEventListener('pointerleave', () => reset(), { signal });
    card.addEventListener('pointercancel', () => reset(true), { signal });
    card.addEventListener('focusin', () => reset(true), { signal });
    allowed.addEventListener('change', () => reset(true), { signal });
    window.addEventListener('resize', () => reset(true), { passive: true, signal });
    window.addEventListener('blur', () => reset(true), { signal });
    window.addEventListener('scroll', () => reset(), { passive: true, signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(true); }, { signal });
    signal?.addEventListener('abort', () => {
      cancelAnimationFrame(frame);
      stopRendering();
      [rotateX, rotateY, scale].forEach(value => value.destroy());
      inner.style.removeProperty('transform');
    }, { once: true });
  });
}
