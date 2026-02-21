const PREFIX = '[maps-scraper]';

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info(msg: string, ...args: unknown[]): void {
    console.log(`${ts()} ${PREFIX}`, msg, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    console.warn(`${ts()} ${PREFIX}`, msg, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    console.error(`${ts()} ${PREFIX}`, msg, ...args);
  },
};
