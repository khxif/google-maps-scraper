/**
 * Random delay between min and max ms (inclusive).
 * Used for human-like pauses between actions to avoid blocking.
 */
export function delay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fixed delay in ms.
 */
export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
