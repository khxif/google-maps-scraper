import { logger } from './logger.js';
import { delayMs } from './delay.js';
import type { RetryOptions } from '../types.js';

/**
 * Retry an async function with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, initialMs = 1000, maxMs = 30000, shouldRetry = () => true } = opts;
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      if (attempt === maxAttempts || !shouldRetry(lastErr)) {
        throw lastErr;
      }
      const wait = Math.min(initialMs * Math.pow(2, attempt - 1), maxMs);
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${wait}ms:`, lastErr.message);
      await delayMs(wait);
    }
  }

  throw lastErr;
}
