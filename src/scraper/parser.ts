import type { Page, Locator } from 'playwright';
import type { PlaceCard, PlaceDetails, Coordinates } from '../types.js';

/**
 * Safe text from locator, or default.
 */
async function getTextSafe(locator: Locator, defaultVal: string | null = null): Promise<string | null> {
  try {
    const visible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) return defaultVal;
    const t = await locator.textContent();
    return (t && t.trim()) || defaultVal;
  } catch {
    return defaultVal;
  }
}

/**
 * Parse rating number from text like "4.2" or "4.2 · 120 reviews".
 */
function parseRating(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Parse total review count from text like "120 reviews" or "4.2 · 120 reviews".
 */
function parseReviewCount(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d[\d,]*)\s*reviews?/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

/**
 * Extract place ID or coords from Google Maps URL.
 */
function parseCoordsFromUrl(url: string): Coordinates {
  if (!url) return { lat: null, lng: null };
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return { lat: null, lng: null };
}

/**
 * Parse a place card in the results list (minimal info from list item).
 */
export async function parsePlaceCard(card: Locator): Promise<PlaceCard> {
  const link = card.locator('a[href*="/maps/place/"]').first();
  const href = await link.getAttribute('href').catch(() => null);
  const fullUrl = href ? (href.startsWith('http') ? href : `https://www.google.com${href}`) : null;
  const name = await getTextSafe(link.locator('[role="heading"], h1, .fontHeadlineSmall, .qBF1Pd').first());
  const ratingText = await getTextSafe(
    card.locator('[aria-label*="stars"], [aria-label*="rating"], .ZkP5Je, span[aria-hidden="true"]').first()
  );
  const rating = parseRating(ratingText);
  const totalReviews = parseReviewCount(ratingText);
  return {
    name: name || null,
    rating: rating ?? null,
    totalReviews: totalReviews ?? null,
    googleMapsUrl: fullUrl,
  };
}

/**
 * From the opened detail panel, extract address, phone, website, coords, images.
 * IMPROVED: Better handling of lazy-loaded content for phone, rating, and reviews.
 */
export async function parseDetailPanel(page: Page, currentUrl = ''): Promise<PlaceDetails> {
  const panel = page.locator('[role="main"]').first();
  let address: string | null = null;
  let phone: string | null = null;
  let website: string | null = null;
  let imageUrls: string[] = [];

  // Wait for main content to be visible
  await panel.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);

  // Address: often in a button with address or data-item-id
  try {
    const addrButton = page.locator('button[data-item-id="address"], a[data-item-id="address"], [data-tooltip="Copy address"]').first();
    await addrButton.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
    if (await addrButton.isVisible().catch(() => false)) {
      address = await addrButton.getAttribute('aria-label') || await addrButton.textContent();
      if (address) address = address.replace(/^Copy address\s*/i, '').trim();
    }
    if (!address) {
      address = await getTextSafe(panel.locator('[data-item-id="address"]').first());
    }
  } catch {}

  // Phone: link with tel: - IMPROVED with better waiting
  try {
    const telLink = page.locator('a[href^="tel:"]').first();
    // Wait for phone to load (sometimes lazy-loaded)
    await telLink.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
    if (await telLink.isVisible().catch(() => false)) {
      const href = await telLink.getAttribute('href');
      phone = href ? href.replace(/^tel:/, '').trim() : null;
    }
    // Fallback: try to find phone in button with data-item-id="phone"
    if (!phone) {
      const phoneButton = page.locator('button[data-item-id*="phone"]').first();
      await phoneButton.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
      if (await phoneButton.isVisible().catch(() => false)) {
        const phoneText = await phoneButton.textContent();
        if (phoneText) phone = phoneText.trim();
      }
    }
  } catch {}

  // Website: external link that's not maps
  try {
    const webLink = page.locator('a[data-item-id="authority"]').first();
    await webLink.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
    if (await webLink.isVisible().catch(() => false)) {
      website = await webLink.getAttribute('href') || null;
    }
    if (!website) {
      const links = await page.locator('a[href^="http"]').all();
      for (const a of links) {
        const h = await a.getAttribute('href');
        if (h && !h.includes('google.com') && !h.startsWith('tel:')) {
          const text = await a.textContent();
          if (text && /website|web|visit|open/i.test(text)) {
            website = h;
            break;
          }
        }
      }
    }
  } catch {}

  // Images: first few photo links in the panel
  try {
    const imgLinks = await page.locator('a[href*="/maps/place/"] img[src], button[aria-label*="Photo"] img').evaluateAll((els) =>
      els.slice(0, 5).map((el) => (el.getAttribute('src') || el.getAttribute('data-src'))).filter(Boolean)
    );
    imageUrls = Array.isArray(imgLinks) ? imgLinks : [];
  } catch {}

  const { lat, lng } = parseCoordsFromUrl(currentUrl || page.url());
  return {
    address,
    phone,
    website,
    latitude: lat,
    longitude: lng,
    imageUrls: imageUrls.slice(0, 3),
  };
}
