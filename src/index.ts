import 'dotenv/config';
import { upsertStays } from './db/index.js';
import { runScraper } from './scraper/scraper.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting Google Maps scraper (Varkala stays)');
  const start = Date.now();

  try {
    const stays = await runScraper();
    logger.info('Scraped', stays.length, 'places');

    if (stays.length === 0) {
      logger.warn('No stays to save');
      return;
    }

    const { processed } = await upsertStays(stays);
    logger.info('Saved to DB:', processed, 'stays (duplicates on google_maps_url ignored)');
  } catch (err) {
    logger.error('Fatal error:', (err as Error).message);
    process.exit(1);
  }

  logger.info('Done in', ((Date.now() - start) / 1000).toFixed(1), 's');
}

main();
