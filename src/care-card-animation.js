import { gsap, ScrollTrigger } from './vendor/gsap.mjs';

const desktopMotion = '(min-width: 1000px) and (min-height: 820px) and (hover: hover) and (prefers-reduced-motion: no-preference)';

/** The care cards fan out as the reader scrolls through their section. */
export function initCareCardAnimation({ signal } = {}) {
  const grid = document.querySelector('[data-care-cards]');
  const cards = grid ? gsap.utils.toArray('[data-care-card]', grid) : [];
  if (!grid || cards.length !== 4 || signal?.aborted) return () => {};

  const media = gsap.matchMedia();
  const dispose = () => media.revert();

  media.add(desktopMotion, () => {
    const rotations = [-4.5, 4.2, -3.3, 4.8];
    grid.dataset.careLayout = 'deck';

    const context = gsap.context(() => {
      const deckPosition = index => {
        return {
          x: (index % 2 ? -1 : 1) * grid.clientWidth * .24,
          y: (index < 2 ? 1 : -1) * grid.clientHeight * .24 + index * 6,
          z: -index * 14,
        };
      };

      gsap.set(cards, {
        transformOrigin: 'center center',
        transformPerspective: 1400,
        zIndex: index => cards.length - index,
      });
      const setMotionHint = active => {
        gsap.set(cards, active ? { willChange: 'transform' } : { clearProps: 'willChange' });
      };

      const timeline = gsap.timeline({
        scrollTrigger: {
          id: 'care-card-fan',
          trigger: grid,
          pin: grid,
          pinSpacing: true,
          start: 'top top+=160',
          end: () => `+=${Math.round(window.innerHeight * 1.25)}`,
          scrub: .55,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onEnter: () => setMotionHint(true),
          onEnterBack: () => setMotionHint(true),
          onUpdate: ({ progress }) => {
            const amount = gsap.utils.clamp(0, 1, progress);
            grid.dataset.careLayout = amount < .015 ? 'deck' : amount > .985 ? 'fan' : 'opening';
          },
          onLeave: () => { grid.dataset.careLayout = 'fan'; setMotionHint(false); },
          onLeaveBack: () => { grid.dataset.careLayout = 'deck'; setMotionHint(false); },
        },
      });

      timeline.fromTo(cards, {
        x: index => deckPosition(index).x,
        y: index => deckPosition(index).y,
        z: index => deckPosition(index).z,
        scale: .93,
        rotation: index => gsap.utils.mapRange(0, cards.length - 1, -1.8, 1.8, index),
      }, {
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotation: index => rotations[index],
        duration: .82,
        ease: 'power3.inOut',
        stagger: { each: .035, from: 'center' },
      }, 0);

      timeline.to(grid, { '--care-glow': 1, duration: .7, ease: 'power2.out' }, .16);

      const openForKeyboard = () => {
        const trigger = timeline.scrollTrigger;
        if (!trigger?.enabled) return;
        trigger.disable(false, false);
        timeline.progress(1);
        setMotionHint(false);
        grid.dataset.careLayout = 'fan';
      };
      const resumeScrollAnimation = event => {
        if (grid.contains(event.relatedTarget)) return;
        const trigger = timeline.scrollTrigger;
        if (!trigger || trigger.enabled) return;
        trigger.enable(false, false);
        ScrollTrigger.refresh();
      };
      grid.addEventListener('focusin', openForKeyboard);
      grid.addEventListener('focusout', resumeScrollAnimation);

      return () => {
        grid.removeEventListener('focusin', openForKeyboard);
        grid.removeEventListener('focusout', resumeScrollAnimation);
      };
    }, grid);

    ScrollTrigger.refresh();
    return () => {
      context.revert();
      delete grid.dataset.careLayout;
      grid.style.removeProperty('--care-glow');
    };
  });

  signal?.addEventListener('abort', dispose, { once: true });
  return () => {
    signal?.removeEventListener('abort', dispose);
    dispose();
  };
}
