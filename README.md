# Google Maps Scraper – Varkala Stays

Production-ready Node.js (plain JavaScript) scraper for stays (resorts, homestays, hotels) in Varkala, Kerala. Uses **Playwright** and stores results in **Neon PostgreSQL** via **Drizzle ORM**.

## Features

- Scrapes Google Maps for: resorts, homestays, hotels in Varkala
- Saves: name, rating, total reviews, address, phone, website, category, lat/lng, Google Maps URL, image URLs
- **Anti-blocking**: headful browser, random delays, user-agent rotation, stealth hints, sequential scraping, retry with exponential backoff
- **Infinite scroll**: scrolls the results list until no new places load; deduplicates by name + address
- **Database**: Drizzle ORM + Neon Postgres, batch insert with conflict ignore on `google_maps_url`
- Optional: proxy support, rate limiter

## Requirements

- **Node.js** >= 18
- **Neon** PostgreSQL database
- **Playwright** browsers (installed via `npx playwright install`)

## Setup

### 1. Clone and install

```bash
cd maps-scraper
npm install
```

### 2. Install Playwright browsers (required for scraping)

```bash
npx playwright install chromium
```

### 3. Environment

Copy the example env and set your Neon connection string:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Get `DATABASE_URL` from [Neon Console](https://console.neon.tech) → your project → Connection string.

Optional:

- `PROXY_URL` – HTTP/HTTPS proxy (e.g. `http://user:pass@host:port`)
- `DELAY_MIN_MS` / `DELAY_MAX_MS` – Random delay range in ms (default 2000–5000)

### 4. Database schema (Drizzle)

Push schema to your Neon database (creates/updates tables):

```bash
npm run db:push
```

Or use migrations:

```bash
npm run db:generate   # generate migration files in ./drizzle
npm run db:migrate   # run migrations
```

Drizzle config is in `drizzle.config.js`; schema is in `src/db/schema.js`.

## Run locally

```bash
node index.js
```

Or:

```bash
npm start
```

This will:

1. Open a **headful** Chromium window (required for anti-blocking)
2. Search Google Maps for “resorts in Varkala”, “homestays in Varkala”, “hotels in Varkala”
3. Scroll each search result list to the end and collect place URLs
4. Open each place, extract details, and deduplicate
5. Batch-insert into the `stays` table (duplicates on `google_maps_url` are ignored)
6. Log progress and final counts

Logs look like:

- `Starting Google Maps scraper (Varkala stays)`
- `Searching: resorts in Varkala`
- `Scraped 120 places`
- `Saved to DB: 120 stays (duplicates on google_maps_url ignored)`
- `Done in 1234.5 s`

## Project structure

```
/src
  /config
    env.js          # env vars
    index.js
  /db
    index.js        # Drizzle client, upsertStays()
    schema.js       # stays table
  /scraper
    browser.js      # launch Playwright (headful, UA rotation, proxy)
    parser.js       # parse place cards and detail panel
    scraper.js      # search, scroll, scrape one-by-one, dedupe
  /utils
    delay.js        # random/fixed delay
    logger.js       # simple logger
    retry.js        # retry with exponential backoff
    rateLimit.js    # optional rate limiter
index.js            # CLI entry: run scraper → save to DB
drizzle.config.js
package.json
.env.example
```

## Error handling

- **Page load**: retry with exponential backoff (configurable in `retry.js`)
- **Single place**: on failure, log and skip; scraper continues
- **DB**: batch insert with `onConflictDoNothing` on `google_maps_url`; duplicate rows are skipped

## Resume capability (bonus)

The scraper does not persist progress by default. To add resume:

- Save the list of `google_maps_url` already in the DB (or from a previous run) and skip those when iterating in `scraper.js`, or
- Run periodically; duplicates are ignored on insert, so re-runs are safe.

## Example `.env`

```env
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
# PROXY_URL=
# DELAY_MIN_MS=2000
# DELAY_MAX_MS=5000
```

## Drizzle migration commands (reference)

| Command            | Effect                          |
|--------------------|---------------------------------|
| `npm run db:generate` | Generate SQL migrations in `./drizzle` |
| `npm run db:migrate`  | Run pending migrations         |
| `npm run db:push`     | Push schema to DB (no migration files) |
| `npm run db:studio`   | Open Drizzle Studio UI         |

## License

MIT
