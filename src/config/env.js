import dotenv from 'dotenv';

dotenv.config();

/**
 * Get env var with optional default.
 * @param {string} key
 * @param {string} [defaultValue]
 * @returns {string|undefined}
 */
export function getEnv(key, defaultValue) {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : defaultValue;
}
