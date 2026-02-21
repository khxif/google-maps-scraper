const PREFIX = '[maps-scraper]';

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info(msg, ...args) {
    console.log(`${ts()} ${PREFIX}`, msg, ...args);
  },
  warn(msg, ...args) {
    console.warn(`${ts()} ${PREFIX}`, msg, ...args);
  },
  error(msg, ...args) {
    console.error(`${ts()} ${PREFIX}`, msg, ...args);
  },
};
