/**
 * Random delay between min and max ms (inclusive).
 * Used for human-like pauses between actions to avoid blocking.
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {Promise<void>}
 */
export function delay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fixed delay in ms.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
