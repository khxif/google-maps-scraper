import { chromium, Browser, BrowserContext } from 'playwright';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { BrowserOptions } from '../types.js';

/** Rotating user agents to reduce fingerprinting. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Launch a persistent browser context with anti-detection settings.
 * Headful mode, optional proxy, user-agent rotation.
 */
export async function launchBrowser(
  opts: BrowserOptions = {}
): Promise<{ browser: Browser; context: BrowserContext }> {
  const proxyUrl = opts.proxy || getEnv('PROXY_URL');
  const launchOpts: Parameters<typeof chromium.launch>[0] = {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  if (proxyUrl) {
    launchOpts.proxy = { server: proxyUrl };
  }
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    userAgent: pickUserAgent(),
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
    },
  });
  // Mask webdriver and other automation hints
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  logger.info('Browser launched (headful)', proxyUrl ? 'with proxy' : '');
  return { browser, context };
}
