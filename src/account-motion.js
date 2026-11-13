import { gsap } from './vendor/gsap.mjs';

export function revealAccountSurface(element) {
  gsap.killTweensOf(element);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(element, { clearProps: 'transform,opacity' });
    return;
  }
  gsap.fromTo(element, { y: -7, scale: .96, opacity: 0 }, {
    y: 0, scale: 1, opacity: 1, duration: .25, ease: 'power2.out',
    overwrite: true, clearProps: 'transform,opacity',
  });
}

export function clearAccountMotion(element) {
  gsap.killTweensOf(element);
  gsap.set(element, { clearProps: 'transform,opacity' });
}
