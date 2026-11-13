/** Exact critically damped solution. response is seconds, velocity is units/s. */
export function advanceSpring(value, velocity, target, seconds, response = .35) {
  const omega = 2 * Math.PI / response;
  const offset = value - target;
  const impulse = velocity + omega * offset;
  const decay = Math.exp(-omega * seconds);
  return {
    value: target + (offset + impulse * seconds) * decay,
    velocity: (velocity - omega * impulse * seconds) * decay,
  };
}

/** Each axis owns its velocity. Changing a target never resets the displayed state. */
export function createSpring(initial, render, { response = .35, onRest = () => {} } = {}) {
  const axes = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, { value, velocity: 0, target: value }]));
  let frame = 0;
  let last = 0;
  const values = () => Object.fromEntries(Object.entries(axes).map(([key, axis]) => [key, axis.value]));

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick(time) {
    frame = 0;
    const seconds = Math.max(0, Math.min((time - last) / 1000, .064));
    last = time;
    let moving = false;
    for (const axis of Object.values(axes)) {
      Object.assign(axis, advanceSpring(axis.value, axis.velocity, axis.target, seconds, response));
      if (Math.abs(axis.value - axis.target) < .001 && Math.abs(axis.velocity) < .01) {
        axis.value = axis.target;
        axis.velocity = 0;
      } else moving = true;
    }
    render(values());
    if (moving) frame = requestAnimationFrame(tick);
    else onRest(); // No perpetual idle loop.
  }

  function to(targets) {
    for (const [key, target] of Object.entries(targets)) axes[key].target = target;
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function jump(targets) {
    stop();
    for (const [key, target] of Object.entries(targets)) Object.assign(axes[key], { value: target, target, velocity: 0 });
    render(values());
    onRest();
  }

  return { to, jump, stop };
}
