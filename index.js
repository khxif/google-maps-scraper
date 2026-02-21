#!/usr/bin/env node
import 'dotenv/config';
import { runScraper } from './src/scraper/scraper.js';
import { upsertStays } from './src/db/index.js';
import { logger } from './src/utils/logger.js';

async function main() {
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
    logger.error('Fatal error:', err.message);
    process.exit(1);
  }

  logger.info('Done in', ((Date.now() - start) / 1000).toFixed(1), 's');
}

main();
