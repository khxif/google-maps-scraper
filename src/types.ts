/**
 * Shared TypeScript types for the Google Maps scraper
 */

/**
 * Place data scraped from Google Maps
 */
export interface Place {
  name: string;
  rating: number | null;
  totalReviews: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  imageUrls: string[];
}

/**
 * Minimal place card info from the search results list
 */
export interface PlaceCard {
  name: string | null;
  rating: number | null;
  totalReviews: number | null;
  googleMapsUrl: string | null;
}

/**
 * Detailed place info from the detail panel
 */
export interface PlaceDetails {
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
  lat: number | null;
  lng: number | null;
}

/**
 * Search query with category
 */
export interface SearchQuery {
  q: string;
  category: string;
}

/**
 * Browser launch options
 */
export interface BrowserOptions {
  proxy?: string;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialMs?: number;
  maxMs?: number;
  shouldRetry?: (err: Error) => boolean;
}
