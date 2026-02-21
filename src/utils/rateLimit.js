/**
 * Simple in-memory rate limiter: max N operations per windowMs.
 * @param {number} maxPerWindow
 * @param {number} windowMs
 */
export function createRateLimiter(maxPerWindow = 10, windowMs = 60_000) {
  const timestamps = [];
  return {
    async acquire() {
      const now = Date.now();
      const cut = now - windowMs;
      while (timestamps.length && timestamps[0] < cut) timestamps.shift();
      if (timestamps.length >= maxPerWindow) {
        const wait = timestamps[0] + windowMs - now;
        await new Promise((r) => setTimeout(r, wait));
        return this.acquire();
      }
      timestamps.push(now);
    },
  };
}
