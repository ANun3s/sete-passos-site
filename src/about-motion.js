import { gsap, ScrollTrigger } from './vendor/gsap.mjs';

const motionAllowed = '(prefers-reduced-motion: no-preference)';

/** Reveals editorial photos as they enter view; the page stays readable without JS. */
export function initAboutMotion({ signal } = {}) {
  const photos = [...document.querySelectorAll('[data-about-image]')];
  if (!photos.length || signal?.aborted) return () => {};

  const media = gsap.matchMedia();
  media.add(motionAllowed, () => {
    const context = gsap.context(() => {
      photos.forEach(image => {
        ScrollTrigger.create({
          trigger: image,
          start: 'top 84%',
          once: true,
          onEnter: () => gsap.fromTo(image, {
            clipPath: 'inset(0 8% 0 8% round 1.75rem)',
            scale: 1.045,
          }, {
            clipPath: 'inset(0 0% 0 0% round 1.75rem)',
            scale: 1,
            duration: 1.05,
            ease: 'power3.out',
            clearProps: 'clipPath,scale',
          }),
        });
      });
    });
    ScrollTrigger.refresh();
    return () => context.revert();
  });

  const dispose = () => media.revert();
  signal?.addEventListener('abort', dispose, { once: true });
  return () => {
    signal?.removeEventListener('abort', dispose);
    dispose();
  };
}
