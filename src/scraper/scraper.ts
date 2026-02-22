import type { Page } from 'playwright';
import { getEnv } from '../config/env.js';
import { delay } from '../utils/delay.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { launchBrowser } from './browser.js';
import { parseDetailPanel } from './parser.js';
import type { Place, SearchQuery, BrowserOptions } from '../types.js';

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';
const DELAY_MIN = Number(getEnv('DELAY_MIN_MS', '2000')) || 2000;
const DELAY_MAX = Number(getEnv('DELAY_MAX_MS', '5000')) || 5000;

const SEARCH_QUERIES: SearchQuery[] = [
  // Core searches - cast a wide net
  { q: 'hotels in Varkala Kerala', category: 'hotel' },
  // { q: 'resorts in Varkala Kerala', category: 'resort' },
  // { q: 'homestays in Varkala Kerala', category: 'homestay' },
  
  // // Beach/cliff specific (different result sets)
  // { q: 'Varkala Cliff hotels', category: 'hotel' },
  // { q: 'Papanasam Beach resorts', category: 'resort' },
  
  // // Catch-all broader terms
  // { q: 'accommodation Varkala', category: 'accommodation' },
  // { q: 'places to stay Varkala', category: 'accommodation' },
];

// Scroll the results feed until no new items load (infinite scroll).
async function scrollFeedUntilDone(page: Page): Promise<void> {
  const feed = page.locator('div[role="feed"]').first();
  await feed.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);

  let lastCount = 0;
  let stableCount = 0;
  const scrollStep = 500; // Increased from 400
  const maxStable = 5; // Increased from 3 - wait longer before assuming we're done
  const maxScrollAttempts = 150; // Increased from 100

  logger.info('Starting infinite scroll...');

  for (let i = 0; i < maxScrollAttempts; i++) {
    const cards = await page.locator('div[role="feed"] a[href*="/maps/place/"]').all();
    const count = cards.length;

    // Check if Google Maps shows "You've reached the end" message
    const endOfResults = await page
      .locator('text=/reached the end|no more results|that\'s all/i')
      .first()
      .isVisible()
      .catch(() => false);
    
    if (endOfResults) {
      logger.info({ finalCount: count, scrollAttempts: i + 1 }, 'Reached end of results (Google Maps confirmation)');
      break;
    }

    if (count === lastCount) {
      stableCount += 1;
      if (stableCount >= maxStable) {
        logger.info({ finalCount: count, scrollAttempts: i + 1 }, 'Scroll complete - no new results');
        break;
      }
    } else {
      // New results found, reset stable counter
      stableCount = 0;
      logger.info({ currentCount: count, newItems: count - lastCount }, 'Found more results');
    }
    lastCount = count;

    // Scroll down
    await feed.evaluate((el, step) => {
      el.scrollTop = el.scrollTop + step;
    }, scrollStep);
    
    // Random delay to appear more human-like
    await delay(1000, 2000); // Reduced delay between scrolls
  }
  
  logger.info({ placeLinks: lastCount }, 'Scroll finished');
}

/**
 * Get unique place URLs from the current results feed.
 */
async function getPlaceUrls(page: Page): Promise<string[]> {
  const links = await page.locator('div[role="feed"] a[href*="/maps/place/"]').all();
  const urls = new Set<string>();

  for (const a of links) {
    const href = await a.getAttribute('href');
    if (!href) continue;

    const full = href.startsWith('http') ? href : `https://www.google.com${href}`;
    urls.add(full.split('?')[0]);
  }
  return [...urls];
}

/**
 * Extract rating and total reviews from the detail page.
 * IMPROVED: Better handling of lazy-loaded rating and reviews.
 */
async function extractRatingAndReviews(
  page: Page,
): Promise<{ rating: number | null; totalReviews: number | null }> {
  let rating: number | null = null;
  let totalReviews: number | null = null;

  try {
    // Wait for rating section to load
    const ratingLocator = page.locator('[aria-label*="stars"]').first();
    await ratingLocator.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);

    if (await ratingLocator.isVisible().catch(() => false)) {
      const ariaLabel = await ratingLocator.getAttribute('aria-label');
      if (ariaLabel) {
        // Extract rating (e.g., "4.5 stars")
        const ratingMatch = ariaLabel.match(/(\d+\.?\d*)\s*stars?/i);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }
      }
    }

    // Try alternative rating selector (sometimes in a different format)
    if (rating === null) {
      const ratingText = await page
        .locator('span[role="img"][aria-label*="stars"]')
        .first()
        .textContent()
        .catch(() => null);
      if (ratingText) {
        const match = ratingText.match(/(\d+\.?\d*)/);
        if (match) rating = parseFloat(match[1]);
      }
    }

    // Extract total reviews - IMPROVED with multiple strategies
    // Strategy 1: Look for review count in button or text near rating
    const reviewLocator = page
      .locator('button[aria-label*="reviews"], a[aria-label*="reviews"]')
      .first();
    await reviewLocator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);

    if (await reviewLocator.isVisible().catch(() => false)) {
      const reviewAriaLabel = await reviewLocator.getAttribute('aria-label');
      if (reviewAriaLabel) {
        const reviewMatch = reviewAriaLabel.match(/(\d[\d,]*)\s*reviews?/i);
        if (reviewMatch) {
          totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
        }
      }
    }

    // Strategy 2: Look in text content near rating
    if (totalReviews === null) {
      const reviewText = await page
        .locator('span[aria-label*="reviews"]')
        .first()
        .textContent()
        .catch(() => null);
      if (reviewText) {
        const match = reviewText.match(/(\d[\d,]*)\s*reviews?/i);
        if (match) totalReviews = parseInt(match[1].replace(/,/g, ''), 10);
      }
    }

    // Strategy 3: Look for reviews text anywhere in the panel
    if (totalReviews === null) {
      const panelText = await page
        .locator('[role="main"]')
        .first()
        .textContent()
        .catch(() => null);
      if (panelText) {
        const match = panelText.match(/(\d[\d,]+)\s*reviews?/i);
        if (match) totalReviews = parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Failed to extract rating/reviews');
  }

  return { rating, totalReviews };
}

/**
 * Scrape one place: open URL, parse details, return stay object.
 */
async function scrapeOnePlace(
  page: Page,
  placeUrl: string,
  category: string,
): Promise<Place | null> {
  try {
    await retry(
      async () => {
        await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      },
      { maxAttempts: 2, initialMs: 2000 },
    );
    await delay(DELAY_MIN, DELAY_MAX);

    // Extract name
    const name = await page
      .locator('h1')
      .first()
      .textContent()
      .then(t => t?.trim())
      .catch(() => null);

    // Extract rating and reviews with improved logic
    const { rating, totalReviews } = await extractRatingAndReviews(page);

    // Extract other details
    const details = await parseDetailPanel(page, placeUrl);

    if (!name && !details.address) {
      logger.warn({ url: placeUrl }, 'Skipping place with no name/address');
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
    logger.error({ url: placeUrl, error: (err as Error).message }, 'Failed to scrape place');
    return null;
  }
}

/**
 * Deduplicate by google_maps_url, then by name+address.
 */
function dedupeStays(list: (Place | null)[]): Place[] {
  const byUrl = new Map<string, Place>();
  for (const s of list) {
    if (!s?.googleMapsUrl) continue;
    const key = s.googleMapsUrl.split('?')[0];
    if (!byUrl.has(key)) byUrl.set(key, s);
  }
  const byNameAddr = new Map<string, Place>();
  for (const s of byUrl.values()) {
    const key = `${(s.name || '').toLowerCase()}|${(s.address || '').toLowerCase()}`;
    if (!byNameAddr.has(key)) byNameAddr.set(key, s);
  }
  return [...byNameAddr.values()];
}

/**
 * Run full scrape: all queries, scroll, collect, dedupe.
 */
export async function runScraper(opts: BrowserOptions = {}): Promise<Place[]> {
  const { browser, context } = await launchBrowser(opts);
  const page = await context.newPage();

  const allStays: (Place | null)[] = [];
  const seenUrls = new Set<string>();

  try {
    for (const { q, category } of SEARCH_QUERIES) {
      const searchUrl = MAPS_SEARCH_BASE + encodeURIComponent(q);
      logger.info({ query: q }, 'Searching');

      await retry(
        async () => {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        },
        { maxAttempts: 3, initialMs: 3000 },
      );
      await delay(DELAY_MIN, DELAY_MAX);

      await scrollFeedUntilDone(page);
      const urls = await getPlaceUrls(page);

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (seenUrls.has(url)) continue;

        seenUrls.add(url);
        logger.info(
          { current: i + 1, total: urls.length, category, url: url.slice(0, 60) + '...' },
          'Scraping place',
        );

        const stay = await scrapeOnePlace(page, url, category);
        if (stay) allStays.push(stay);

        await delay(DELAY_MIN, DELAY_MAX);
      }
    }
  } finally {
    await browser.close();
  }

  const deduped = dedupeStays(allStays);
  logger.info({ scraped: allStays.length, deduped: deduped.length }, 'Scraping summary');
  return deduped;
}
