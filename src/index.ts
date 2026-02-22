import 'dotenv/config';
import { upsertStays } from './db/index.js';
import { runScraper } from './scraper/scraper.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting Google Maps scraper (Varkala stays)');
  const start = Date.now();

  try {
    const stays = await runScraper();
    logger.info({ count: stays.length }, 'Scraped places');

    if (stays.length === 0) {
      logger.warn('No stays to save');
      return;
    }

    const { processed } = await upsertStays(stays);
    logger.info({ processed }, 'Saved to DB (duplicates on google_maps_url ignored)');
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Fatal error');
    process.exit(1);
  }

  logger.info({ durationSeconds: ((Date.now() - start) / 1000).toFixed(1) }, 'Scraping completed');
}

main();
