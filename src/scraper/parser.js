/**
 * Parse a single place from Google Maps DOM.
 * Selectors are based on common Maps structure; they may need updates if Google changes the UI.
 */

/**
 * Safe text from selector, or default.
 * @param {import('playwright').Locator} parent
 * @param {string} selector
 * @param {string} [defaultVal]
 * @returns {Promise<string|null>}
 */
async function textOr(parent, selector, defaultVal = null) {
  try {
    const el = parent.locator(selector).first();
    const visible = await el.isVisible().catch(() => false);
    if (!visible) return defaultVal;
    const t = await el.textContent();
    return (t && t.trim()) || defaultVal;
  } catch {
    return defaultVal;
  }
}

/**
 * Safe href from selector.
 * @param {import('playwright').Locator} parent
 * @param {string} selector
 * @returns {Promise<string|null>}
 */
async function hrefOr(parent, selector) {
  try {
    const el = parent.locator(selector).first();
    const visible = await el.isVisible().catch(() => false);
    if (!visible) return null;
    const h = await el.getAttribute('href');
    return (h && h.trim()) || null;
  } catch {
    return null;
  }
}

/**
 * Parse rating number from text like "4.2" or "4.2 · 120 reviews".
 * @param {string} s
 * @returns {number|null}
 */
function parseRating(s) {
  if (!s) return null;
  const m = s.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Parse total review count from text like "120 reviews" or "4.2 · 120 reviews".
 * @param {string} s
 * @returns {number|null}
 */
function parseReviewCount(s) {
  if (!s) return null;
  const m = s.match(/(\d[\d,]*)\s*reviews?/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

/**
 * Extract place ID or coords from Google Maps URL.
 * @param {string} url
 * @returns {{ lat: number|null, lng: number|null }}
 */
function parseCoordsFromUrl(url) {
  if (!url) return { lat: null, lng: null };
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return { lat: null, lng: null };
}

/**
 * Parse a place card in the results list (minimal info from list item).
 * @param {import('playwright').Locator} card - Card element (e.g. a link or its container)
 * @returns {Promise<{ name: string|null, rating: number|null, totalReviews: number|null, googleMapsUrl: string|null }>}
 */
export async function parsePlaceCard(card) {
  const link = card.locator('a[href*="/maps/place/"]').first();
  const href = await link.getAttribute('href').catch(() => null);
  const fullUrl = href ? (href.startsWith('http') ? href : `https://www.google.com${href}`) : null;
  const name = await textOr(link, '[role="heading"], h1, .fontHeadlineSmall, .qBF1Pd');
  const ratingText = await textOr(
    card,
    '[aria-label*="stars"], [aria-label*="rating"], .ZkP5Je, span[aria-hidden="true"]'
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
 * @param {import('playwright').Page} page
 * @param {string} [currentUrl] - Current place URL for coords fallback
 * @returns {Promise<{ address: string|null, phone: string|null, website: string|null, latitude: number|null, longitude: number|null, imageUrls: string[] }>}
 */
export async function parseDetailPanel(page, currentUrl = '') {
  const panel = page.locator('[role="main"]').first();
  let address = null;
  let phone = null;
  let website = null;
  let imageUrls = [];

  // Address: often in a button with address or data-item-id
  try {
    const addrButton = page.locator('button[data-item-id="address"], a[data-item-id="address"], [data-tooltip="Copy address"]').first();
    if (await addrButton.isVisible().catch(() => false)) {
      address = await addrButton.getAttribute('aria-label') || await addrButton.textContent();
      if (address) address = address.replace(/^Copy address\s*/i, '').trim();
    }
    if (!address) {
      address = await textOr(panel, '[data-item-id="address"]');
    }
  } catch {}

  // Phone: link with tel:
  try {
    const telLink = page.locator('a[href^="tel:"]').first();
    if (await telLink.isVisible().catch(() => false)) {
      const href = await telLink.getAttribute('href');
      phone = href ? href.replace(/^tel:/, '').trim() : null;
    }
  } catch {}

  // Website: external link that's not maps
  try {
    const webLink = page.locator('a[data-item-id="authority"]').first();
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
