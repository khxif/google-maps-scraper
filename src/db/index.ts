import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { stays } from './schema.js';
import { getEnv } from '../config/env.js';
import type { Place } from '../types.js';

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get Drizzle DB instance (singleton).
 * Uses connection string from env.
 */
export function getDb() {
  if (!_db) {
    const url = getEnv('DATABASE_URL');
    if (!url) throw new Error('DATABASE_URL is required');
    const client = postgres(url, { max: 1 });
    _db = drizzle(client);
  }
  return _db;
}

/**
 * Batch insert stays, ignoring duplicates on google_maps_url.
 */
export async function upsertStays(rows: Place[]): Promise<{ processed: number }> {
  if (!rows.length) return { processed: 0 };
  const db = getDb();
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(stays)
      .values(batch)
      .onConflictDoNothing({ target: [stays.googleMapsUrl] });
  }
  return { processed: rows.length };
}

export { stays };
