// Process-local protection for custom API calls (Better Auth's direct server
// APIs do not traverse its HTTP rate limiter). Never trust forwarded IP headers.
export function createProfileRateLimiter({ now = Date.now, maxKeys = 4096 } = {}) {
  const entries = new Map();
  return (scope, actor, max) => {
    const timestamp = now();
    for (const [key, entry] of entries) if (entry.until <= timestamp) entries.delete(key);
    const key = `${scope}\0${actor}`;
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= maxKeys) return 60; // Bounded memory; fail closed.
      entry = { until: timestamp + 60_000, count: 0 };
      entries.set(key, entry);
    }
    if (entry.count >= max) return Math.max(1, Math.ceil((entry.until - timestamp) / 1000));
    entry.count++;
    return 0;
  };
}
