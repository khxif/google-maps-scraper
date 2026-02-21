import { logger } from './logger.js';
import { delayMs } from './delay.js';

/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<T>} fn
 * @param {object} [opts]
 * @param {number} [opts.maxAttempts=3]
 * @param {number} [opts.initialMs=1000]
 * @param {number} [opts.maxMs=30000]
 * @param {(err: Error) => boolean} [opts.shouldRetry] - return false to skip retry
 * @returns {Promise<T>}
 * @template T
 */
export async function retry(fn, opts = {}) {
  const { maxAttempts = 3, initialMs = 1000, maxMs = 30000, shouldRetry = () => true } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      const wait = Math.min(initialMs * Math.pow(2, attempt - 1), maxMs);
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${wait}ms:`, err.message);
      await delayMs(wait);
    }
  }
  throw lastErr;
}
