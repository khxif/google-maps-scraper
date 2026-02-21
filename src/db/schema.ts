import { pgTable, uuid, text, real, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const stays = pgTable('stays', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  rating: real('rating'),
  totalReviews: integer('total_reviews'),
  address: text('address'),
  phone: text('phone'),
  website: text('website'),
  category: text('category').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  googleMapsUrl: text('google_maps_url').notNull().unique(),
  imageUrls: jsonb('image_urls').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
