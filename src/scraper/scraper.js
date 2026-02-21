import { launchBrowser } from './browser.js';
import { parsePlaceCard, parseDetailPanel } from './parser.js';
import { delay } from '../utils/delay.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { getEnv } from '../config/env.js';

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';
const DELAY_MIN = Number(getEnv('DELAY_MIN_MS', '2000')) || 2000;
const DELAY_MAX = Number(getEnv('DELAY_MAX_MS', '5000')) || 5000;

const SEARCH_QUERIES = [
  { q: 'resorts in Varkala', category: 'resort' },
  { q: 'homestays in Varkala', category: 'homestay' },
  { q: 'hotels in Varkala', category: 'hotel' },
];

/**
 * Scroll the results feed until no new items load (infinite scroll).
 * @param {import('playwright').Page} page
 */
async function scrollFeedUntilDone(page) {
  const feed = page.locator('div[role="feed"]').first();
  await feed.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
  let lastCount = 0;
  let stableCount = 0;
  const scrollStep = 400;
  const maxStable = 3;

  for (let i = 0; i < 100; i++) {
    const cards = await page.locator('div[role="feed"] a[href*="/maps/place/"]').all();
    const count = cards.length;
    if (count === lastCount) {
      stableCount += 1;
      if (stableCount >= maxStable) break;
    } else {
      stableCount = 0;
    }
    lastCount = count;
    await feed.evaluate((el, step) => {
      el.scrollTop = el.scrollTop + step;
    }, scrollStep);
    await delay(DELAY_MIN, DELAY_MAX);
  }
  logger.info('Scroll finished, found', lastCount, 'place links');
}

/**
 * Get unique place URLs from the current results feed.
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
async function getPlaceUrls(page) {
  const links = await page.locator('div[role="feed"] a[href*="/maps/place/"]').all();
  const urls = new Set();
  for (const a of links) {
    const href = await a.getAttribute('href');
    if (!href) continue;
    const full = href.startsWith('http') ? href : `https://www.google.com${href}`;
    urls.add(full.split('?')[0]);
  }
  return [...urls];
}

/**
 * Scrape one place: open URL, parse details, return stay object.
 * @param {import('playwright').Page} page
 * @param {string} placeUrl
 * @param {string} category
 * @param {{ name: string|null, rating: number|null, totalReviews: number|null }} [cardInfo]
 * @returns {Promise<object|null>}
 */
async function scrapeOnePlace(page, placeUrl, category, cardInfo = {}) {
  try {
    await retry(
      async () => {
        await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      },
      { maxAttempts: 2, initialMs: 2000 }
    );
    await delay(DELAY_MIN, DELAY_MAX);

    const details = await parseDetailPanel(page, placeUrl);
    const name = cardInfo.name || await page.locator('h1').first().textContent().then((t) => t?.trim()).catch(() => null);
    const rating = cardInfo.rating ?? parseFloat(await page.locator('[aria-label*="stars"]').first().getAttribute('aria-label')?.then((a) => a?.match(/(\d+\.?\d*)/)?.[1]) || '') ?? null;
    const totalReviews = cardInfo.totalReviews ?? null;

    if (!name && !details.address) {
      logger.warn('Skipping place with no name/address:', placeUrl);
      return null;
    }

    return {
      name: name || 'Unknown',
      rating: rating ?? null,
      totalReviews: totalReviews ?? null,
      address: details.address ?? null,
      phone: details.phone ?? null,
      website: details.website ?? null,
      category,
      latitude: details.latitude ?? null,
      longitude: details.longitude ?? null,
      googleMapsUrl: placeUrl,
      imageUrls: Array.isArray(details.imageUrls) ? details.imageUrls : [],
    };
  } catch (err) {
    logger.error('Failed to scrape place', placeUrl, err.message);
    return null;
  }
}

/**
 * Deduplicate by google_maps_url, then by name+address.
 * @param {object[]} list
 * @returns {object[]}
 */
function dedupeStays(list) {
  const byUrl = new Map();
  for (const s of list) {
    if (!s?.googleMapsUrl) continue;
    const key = s.googleMapsUrl.split('?')[0];
    if (!byUrl.has(key)) byUrl.set(key, s);
  }
  const byNameAddr = new Map();
  for (const s of byUrl.values()) {
    const key = `${(s.name || '').toLowerCase()}|${(s.address || '').toLowerCase()}`;
    if (!byNameAddr.has(key)) byNameAddr.set(key, s);
  }
  return [...byNameAddr.values()];
}

/**
 * Run full scrape: all queries, scroll, collect, dedupe.
 * @param {{ proxy?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function runScraper(opts = {}) {
  const { browser, context } = await launchBrowser(opts);
  const page = await context.newPage();
  const allStays = [];
  const seenUrls = new Set();

  try {
    for (const { q, category } of SEARCH_QUERIES) {
      const searchUrl = MAPS_SEARCH_BASE + encodeURIComponent(q);
      logger.info('Searching:', q);

      await retry(
        async () => {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        },
        { maxAttempts: 3, initialMs: 3000 }
      );
      await delay(DELAY_MIN, DELAY_MAX);

      await scrollFeedUntilDone(page);
      const urls = await getPlaceUrls(page);

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        logger.info(`Place ${i + 1}/${urls.length} (${category}):`, url.slice(0, 60) + '...');
        const stay = await scrapeOnePlace(page, url, category);
        if (stay) allStays.push(stay);
        await delay(DELAY_MIN, DELAY_MAX);
      }
    }
  } finally {
    await browser.close();
  }

  const deduped = dedupeStays(allStays);
  logger.info('Scraped', allStays.length, 'places, deduped to', deduped.length);
  return deduped;
}
