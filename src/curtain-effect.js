/** Pure geometry: the horizontal skew is tan(angle) × viewport height. */
export function pageCurtainDirection(current, next) {
  return next > current ? 'left' : 'right';
}

export function curtainPolygons(direction, angle, width, height) {
  const skew = Math.tan(Math.max(0, Math.min(20, angle)) * Math.PI / 180) * height / Math.max(1, width) * 100;
  const polygon = x => `polygon(${x}% 0%, ${x + 100 + 2 * skew}% 0%, ${x + 100 + skew}% 100%, ${x - skew}% 100%)`;
  const points = [polygon(100 + skew), polygon(0), polygon(-100 - 2 * skew)];
  return direction === 'left' ? points : points.reverse();
}

/** Two halves leave a fully opaque curtain in place while the DOM changes. */
export function createCurtainEffect(ref, { angle, duration, easing }) {
  const copy = ref.querySelector('.curtain-copy');
  let polygons;
  let sign;

  async function half(from, to, fromX, toX, fromOpacity, toOpacity) {
    const options = { duration: duration / 2, easing, fill: 'forwards' };
    const shape = ref.animate([{ clipPath: from }, { clipPath: to }], options);
    const text = copy.animate([
      { transform: `translateX(${fromX}vw)`, opacity: fromOpacity },
      { transform: `translateX(${toX}vw)`, opacity: toOpacity },
    ], options);
    await Promise.all([shape.finished, text.finished]);
    // Keep the exact end state without leaving finished animations attached.
    ref.style.clipPath = to;
    copy.style.transform = `translateX(${toX}vw)`;
    copy.style.opacity = toOpacity;
    shape.cancel();
    text.cancel();
  }

  return {
    async cover(title, direction) {
      polygons = curtainPolygons(direction, angle, innerWidth, innerHeight);
      sign = direction === 'left' ? 1 : -1;
      ref.querySelector('#page-curtain-title').textContent = title;
      ref.dataset.direction = direction;
      ref.dataset.phase = 'covering';
      ref.style.clipPath = polygons[0];
      ref.hidden = false;
      await half(polygons[0], polygons[1], sign * 12, 0, .3, 1);
      ref.dataset.phase = 'covered';
    },
    async reveal() {
      ref.dataset.phase = 'revealing';
      await half(polygons[1], polygons[2], 0, -sign * 12, 1, .2);
    },
    reset() {
      (ref.getAnimations?.({ subtree: true }) || []).forEach(animation => animation.cancel());
      ref.hidden = true;
      ref.dataset.phase = 'idle';
      ref.style.removeProperty('clip-path');
      copy.removeAttribute('style');
    },
  };
}
