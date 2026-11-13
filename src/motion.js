export function initGlassButtons({ signal } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.glass, [data-pointer-glow]').forEach((button) => {
    let frame = 0;
    button.addEventListener('pointermove', (event) => {
      if (reduced.matches || event.pointerType === 'touch' || button.matches(':disabled')) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (reduced.matches || button.matches(':disabled')) return;
        const bounds = button.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100));
        const y = Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100));
        button.style.setProperty('--pointer-x', `${x}%`);
        button.style.setProperty('--pointer-y', `${y}%`);
      });
    }, { passive: true, signal });
    button.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      button.style.removeProperty('--pointer-x');
      button.style.removeProperty('--pointer-y');
      button.style.removeProperty('--glow-strength');
    }, { signal });
    signal?.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  });
}
