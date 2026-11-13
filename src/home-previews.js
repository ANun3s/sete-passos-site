import { gsap, ScrollTrigger } from './vendor/gsap.mjs';

const motionAllowed = '(prefers-reduced-motion: no-preference)';
/** Links scroll position and focus to a crossfading image preview. */
export function initHomePreviews({ signal } = {}) {
  const section = document.querySelector('.home-previews');
  if (!section || signal?.aborted) return () => {};

  const links = [...section.querySelectorAll('[data-menu-preview-link]')];
  const images = [...section.querySelectorAll('[data-menu-preview-image]')];
  if (!links.length || !images.length) return () => {};

  let active = links.find(link => link.dataset.active === 'true')?.dataset.menuPreviewLink || links[0].dataset.menuPreviewLink;
  let currentTween;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const activate = (key, animate = true) => {
    if (!images.some(image => image.dataset.menuPreviewImage === key) || key === active) return;
    const outgoing = images.find(image => image.dataset.menuPreviewImage === active);
    const incoming = images.find(image => image.dataset.menuPreviewImage === key);
    active = key;

    links.forEach(link => { link.dataset.active = String(link.dataset.menuPreviewLink === key); });
    images.forEach(image => image.setAttribute('aria-hidden', String(image !== incoming)));
    currentTween?.kill();
    if (!animate || reduced.matches) {
      gsap.set(images, { autoAlpha: image => image === incoming ? 1 : 0, scale: 1 });
      return;
    }
    gsap.set(incoming, { autoAlpha: 0, scale: 1.045 });
    currentTween = gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(outgoing, { autoAlpha: 0, scale: 1.025, duration: .42, ease: 'power2.out' }, 0)
      .to(incoming, { autoAlpha: 1, scale: 1, duration: .68, ease: 'power3.out' }, .04);
  };

  const onFocusOrHover = event => {
    const link = event.target.closest('[data-menu-preview-link]');
    if (link) activate(link.dataset.menuPreviewLink);
  };
  section.addEventListener('focusin', onFocusOrHover);
  section.addEventListener('pointerover', onFocusOrHover, { passive: true });

  const media = gsap.matchMedia();
  media.add(motionAllowed, () => {
    const context = gsap.context(() => {
      links.forEach(link => {
        ScrollTrigger.create({
          trigger: link,
          start: 'top 62%',
          end: 'bottom 38%',
          onEnter: () => activate(link.dataset.menuPreviewLink),
          onEnterBack: () => activate(link.dataset.menuPreviewLink),
        });
      });
    }, section);
    ScrollTrigger.refresh();
    return () => context.revert();
  });

  const dispose = () => {
    section.removeEventListener('focusin', onFocusOrHover);
    section.removeEventListener('pointerover', onFocusOrHover);
    currentTween?.kill();
    media.revert();
  };
  signal?.addEventListener('abort', dispose, { once: true });
  return () => {
    signal?.removeEventListener('abort', dispose);
    dispose();
  };
}
