# Roast My Landing

Roast My Landing audits a landing page and returns a compact overview with three practical tips: one for marketing, one for SEO, and one for performance.

Server runs real Lighthouse. OpenAI writes final roast. Postgres stores durable artifacts. If dependency is missing, scan fails explicitly.

## Quickstart

`.env` is already populated for local dev. Just run:

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

Then open http://localhost:3000.

## What Is Real And What Is Not

- Real:
  - server-side Lighthouse
  - two profiles on every scan: mobile + desktop
  - persisted scan rows in Postgres
  - persisted event log in Postgres
  - live terminal events over Socket.IO with HTTP recovery
  - explicit provider source and failure reason in UI and API
- Not real:
  - no synthetic `66/100`
  - no silent OpenAI fallback prose
  - no silent Lighthouse fallback data
  - no raw JSON streamed as user-facing terminal output

## Architecture Overview

- Next app at `/`
- `POST /api/scans`
- `GET /api/scans/:scanId`
- `GET /api/scans/:scanId/artifacts`
- `POST /api/scans/:scanId/cancel`
- Redis holds transient checkpoint state
- Postgres holds durable `scan_runs` + `scan_events`

Scan flow:

1. Validate URL and normalize to site root.
2. Build route map from homepage.
3. Crawl homepage plus bounded child routes.
4. Run Lighthouse twice on server: mobile and desktop.
5. Persist raw artifacts and summaries.
6. Build site summary and Lighthouse interpretation locally.
7. Stream final roast from OpenAI.
8. Persist final payload and terminal event log.

## Local Stack With Docker Compose

`.env` is already configured for the Docker Compose services below. If you want to customize values, copy `.env.example` and edit it.

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

Services:

- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## `.env` Setup

Start from `.env.example`.

Required for truthful scans:

- `POSTGRES_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- Chrome or Chromium installed locally, or `CHROME_PATH` set

Helpful commands:

```bash
cp .env.example .env
pnpm db:migrate
```

## Drizzle Migration Flow

Generate migration from schema:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:migrate
```

Schema source:

- `src/server/storage/postgres/schema.ts`

Migration output:

- `drizzle/`

## How Lighthouse Works

Lighthouse runs on server where app process is running, not in browser on user device.

- Local dev: Lighthouse runs on your machine.
- VPS deploy: Lighthouse runs on VPS.
- Mobile and desktop are emulation profiles.
- Every scan runs both profiles.
- Phone user and desktop user see same underlying audit result for same scan.
- Only UI layout changes between phone and desktop.

If local provider selected:

- app looks for `CHROME_PATH` first
- then system Chrome/Chromium installs
- if none found, scan fails explicitly

## How Lighthouse Works On VPS

Install Chrome or Chromium on host. Headless mode is used.

Typical requirement:

- Ubuntu/Debian package for Chromium or Google Chrome
- enough shared memory and sandbox permissions for headless browser

If VPS lacks browser binary, scan fails with terminal line similar to:

```text
SCAN FAILED · Chrome/Chromium not found
```

## Inspect Postgres Data

List latest scan rows:

```bash
psql "$POSTGRES_URL" -c 'select id,status,quality_score,lighthouse_source,openai_source,created_at from scan_runs order by created_at desc limit 20;'
```

List terminal events for one run:

```bash
psql "$POSTGRES_URL" -c "select seq,event_type,stage,message from scan_events where scan_id = '<scan-id>' order by seq;"
```

## Inspect Redis Data

Redis stores transient checkpoint state only.

```bash
redis-cli -u "$REDIS_URL" keys 'slc:*'
```

## Verify OpenAI Is Live

Run scan and inspect one of:

- notebook provider badge shows `openai live`
- `GET /api/scans/:scanId` returns `providerStatus.openai.source = "live"`
- `scan_runs.openai_source = 'live'`

If `OPENAI_API_KEY` missing or request fails, scan ends explicitly. No prose fallback.

## Troubleshooting

### `POSTGRES_URL missing`

- set `POSTGRES_URL`
- start Docker Compose stack
- run `pnpm db:migrate`

### `Chrome/Chromium not found`

- install Chrome or Chromium
- or set `CHROME_PATH`
- rerun scan

### `OPENAI_API_KEY missing`

- add valid key to `.env`
- restart app

### PageSpeed alternate provider fails

- set `LIGHTHOUSE_PROVIDER=pagespeed`
- optionally add `PAGESPEED_API_KEY`
- if request still fails, scan fails explicitly and stores reason

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm test:unit`
- `pnpm test:api`
- `pnpm test:e2e`
- `pnpm test:storybook`
- `pnpm test`

## API Notes

`GET /api/scans/:scanId` returns:

- combined score
- mobile score
- desktop score
- provider status
- failure reason
- persisted run id

`GET /api/scans/:scanId/artifacts` returns:

- run summary
- raw mobile Lighthouse artifact
- raw desktop Lighthouse artifact
- site-understanding JSON
- final payload JSON
- event log
