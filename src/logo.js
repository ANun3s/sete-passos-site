import { createSpring } from './spring.js';

/** Alpha-only emblem depth. GSAP owns ancestors; this module owns only the emblem. */
export function initLogoDepth({ signal } = {}) {
  const scene = document.querySelector('[data-logo-scene]');
  const emblem = scene?.querySelector('[data-logo-emblem]');
  const image = emblem?.querySelector('.hero-logo');
  if (!image) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const properties = ['--tilt-x', '--tilt-y', '--light', '--light-x', '--light-y', '--shadow-x', '--shadow-y'];
  const rest = { x: 0, y: 0, light: 0 };
  let alpha;
  let frame = 0;
  let point;
  const spring = createSpring(rest, ({ x, y, light }) => {
    emblem.style.setProperty('--tilt-x', `${x}deg`);
    emblem.style.setProperty('--tilt-y', `${y}deg`);
    emblem.style.setProperty('--light', String(light));
    emblem.style.setProperty('--light-x', `${50 + y * 6.25}%`);
    emblem.style.setProperty('--light-y', `${50 - x * 8.333}%`);
    emblem.style.setProperty('--shadow-x', `${-y * .22}px`);
    emblem.style.setProperty('--shadow-y', `${2 + x * .15}px`);
  }, { response: .35, onRest: () => {
    if (emblem.dataset.active) return;
    delete emblem.dataset.settling;
    properties.forEach(property => emblem.style.removeProperty(property));
  } });

  // Sample the untransformed artwork once, not the transformed hit box on every
  // frame. Transparent corners and the spaces between letters never activate it.
  image.decode().then(async () => {
    if (signal?.aborted || !CSS.supports('mask-image', 'url("x")')) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // WebKit can resolve decode before its first drawable bitmap is available.
    // Never cache an all-clear hit map; retry across at most two paint frames.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      if (pixels.some((value, index) => index % 4 === 3 && value >= 48)) {
        alpha = { width: canvas.width, height: canvas.height, pixels };
        scene.dataset.logoReady = 'true';
        return;
      }
      if (attempt < 2) await new Promise(requestAnimationFrame);
    }
  }).catch(() => {
    // A decoding/CORS/canvas restriction leaves the complete static PNG intact.
  });

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    delete emblem.dataset.active;
    delete emblem.dataset.settling;
    spring.jump(rest);
  }

  function release() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!emblem.dataset.active) return;
    emblem.dataset.settling = 'true';
    delete emblem.dataset.active;
    spring.to(rest);
  }

  function renderInput() {
    frame = 0;
    if (signal?.aborted || reduced.matches || !finePointer.matches || !alpha) return;
    // The invisible scene is stable even while the silhouette rotates.
    const bounds = scene.getBoundingClientRect();
    const x = (point.x - bounds.left) / bounds.width;
    const y = (point.y - bounds.top) / bounds.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) { release(); return; }
    const pixel = (Math.floor(y * alpha.height) * alpha.width + Math.floor(x * alpha.width)) * 4 + 3;
    if (alpha.pixels[pixel] < 48) { release(); return; }
    emblem.dataset.active = 'true';
    delete emblem.dataset.settling;
    spring.to({ x: (y - .5) * -12, y: (x - .5) * 16, light: .14 });
  }

  function move(event) {
    if (reduced.matches || !finePointer.matches || event.pointerType === 'touch' || !alpha) return;
    point = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(renderInput);
  }

  scene.addEventListener('pointermove', move, { passive: true, signal });
  scene.addEventListener('pointerleave', release, { signal });
  scene.addEventListener('pointercancel', reset, { signal });
  window.addEventListener('scroll', release, { passive: true, signal });
  window.addEventListener('blur', reset, { signal });
  window.addEventListener('resize', reset, { passive: true, signal });
  reduced.addEventListener('change', reset, { signal });
  finePointer.addEventListener('change', reset, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal });
  signal?.addEventListener('abort', () => {
    reset();
    alpha = undefined;
    delete scene.dataset.logoReady;
  }, { once: true });
}
