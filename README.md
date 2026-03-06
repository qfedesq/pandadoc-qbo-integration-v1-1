# pandadoc-qbo-integration

![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![TypeScript Strict](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Prisma + Postgres](https://img.shields.io/badge/Prisma-Postgres-2D3748)
![Playwright Smoke Tested](https://img.shields.io/badge/Playwright-smoke--tested-45BA63)
![Demo Ready](https://img.shields.io/badge/Status-demo--ready-0F766E)

Production-ready foundation for connecting PandaDoc and QuickBooks Online, importing outstanding QuickBooks invoices, and preparing future cross-system workflows.

## Demo summary

This repository demonstrates a complete PandaDoc + QuickBooks Online integration workflow:

- connect PandaDoc with OAuth 2.0
- connect QuickBooks Online with OAuth 2.0
- import outstanding QuickBooks invoices into an internal normalized model
- review them in a dedicated PandaDoc Factoring Dashboard
- push a selected invoice into PandaDoc as a document created from template
- keep PandaDoc document state updated through webhooks

Primary demo route:

- `/factoring-dashboard`

Primary demo actions:

- connect both integrations in `/integrations`
- sync invoices from QuickBooks
- filter and inspect imported invoices
- click `Import to PandaDoc` for an invoice with payer email

## Demo flow

For a reviewer or stakeholder demo, the shortest path is:

1. Sign in at `/login`
2. Open `/integrations` and verify PandaDoc and QuickBooks connection status
3. Open `/factoring-dashboard`
4. Click `Sync now` to refresh outstanding invoices from QuickBooks
5. Filter by status, search by invoice id or counterparty, and inspect last sync timestamps
6. Import an invoice to PandaDoc from the dashboard and verify the PandaDoc document status badge updates after webhook delivery

## Architecture overview

- `app/`: Next.js 15 App Router UI and HTTP route handlers.
- `components/`: dashboard UI, filters, tables, and shadcn-style primitives.
- `lib/auth/`: internal app authentication with a database-backed session cookie.
- `lib/db/`: Prisma client plus persistence helpers for connections, sync runs, and imported invoices.
- `lib/providers/pandadoc/`: PandaDoc OAuth, current-member lookup, token refresh, and webhook support.
- `lib/providers/quickbooks/`: QuickBooks OAuth, company lookup, token refresh, and invoice query adapter.
- `lib/invoices/`: normalization, mapping, and sync orchestration.
- `lib/jobs/`: queue abstraction. The default implementation is inline, but the interface is ready for a real queue.
- `lib/webhooks/`: PandaDoc webhook validation and persistence.
- `lib/security/`: request-origin validation, encrypted secret handling, hashing, and database-backed rate limiting.
- `prisma/`: schema, SQL migration, and seed script.
- `tests/`: unit, integration, and Playwright smoke coverage.
- `mock-data/`: sample provider payloads for local development and debugging.

## What the app does today

- Authenticates a local admin user to protect the dashboard and server routes.
- Connects PandaDoc with OAuth 2.0 and persists tokens server-side.
- Connects QuickBooks Online with OAuth 2.0, persists tokens, and stores the QuickBooks realm/company.
- Refreshes provider access tokens before API calls when needed.
- Imports QuickBooks invoices into a normalized internal model.
- Exposes a dedicated PandaDoc Factoring Dashboard at `/factoring-dashboard`.
- Imports an individual QuickBooks invoice into PandaDoc from the dashboard using a PandaDoc template.
- Links imported invoices with PandaDoc document ids and keeps document state updated from webhooks.
- Filters invoices by status, overdue only, or search text.
- Exposes a secure `/api/invoices/sync` endpoint plus a scheduled-sync orchestration layer for manual sync or cron-driven refresh.
- Receives PandaDoc webhooks, validates the configured signature when available, and stores payloads idempotently.

## Tech stack

- Next.js 15 App Router
- TypeScript with strict mode
- Prisma
- PostgreSQL
- Tailwind CSS
- shadcn-style UI components
- Zod
- Vitest
- Playwright
- Docker and Docker Compose

## Runtime requirements

- Node.js 20.19+ for local development and production builds
- PostgreSQL 16+

## Setup

1. Copy the environment template.

```bash
cp .env.example .env
```

2. Start PostgreSQL.

```bash
docker compose up -d postgres
```

3. Install dependencies.

```bash
npm install
```

4. Apply the migration and seed the database.

```bash
npm run db:deploy
npm run db:seed
```

5. Start the app.

```bash
npm run dev
```

6. Sign in at [http://localhost:3000/login](http://localhost:3000/login) with:

- Email: `DEFAULT_ADMIN_EMAIL`
- Password: `DEFAULT_ADMIN_PASSWORD`

If `SEED_DEMO_DATA=true`, the seed script also creates connected demo integrations and sample imported invoices so the UI and Playwright smoke test have a populated baseline.

## Environment variables

Required for the live app:

- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `INTERNAL_SYNC_SECRET` or `CRON_SECRET`
- `OUTBOUND_HTTP_TIMEOUT_MS`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `INVOICE_SYNC_ENABLED`
- `INVOICE_SYNC_INTERVAL_MINUTES`

PandaDoc OAuth:

- `PANDADOC_CLIENT_ID`
- `PANDADOC_CLIENT_SECRET`
- `PANDADOC_REDIRECT_URI`
- `PANDADOC_SCOPES`
- `PANDADOC_AUTH_URL`
- `PANDADOC_TOKEN_URL`
- `PANDADOC_API_BASE_URL`
- `PANDADOC_TEMPLATE_UUID`
- `PANDADOC_RECIPIENT_ROLE`
- `PANDADOC_DOCUMENT_NAME_PREFIX`
- `PANDADOC_SEND_ON_IMPORT`
- `PANDADOC_WEBHOOK_SHARED_SECRET`

QuickBooks OAuth:

- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_REDIRECT_URI`
- `QUICKBOOKS_SCOPES`
- `QUICKBOOKS_ENV`
- `QUICKBOOKS_AUTH_URL`
- `QUICKBOOKS_TOKEN_URL`
- `QUICKBOOKS_MINOR_VERSION`

## PandaDoc OAuth configuration

Use your PandaDoc OAuth app settings to register the callback URL:

- Local: `http://localhost:3000/api/oauth/pandadoc/callback`

The connect flow is:

1. Logged-in user submits a same-origin `POST` to `/api/oauth/pandadoc/connect`
2. Server creates a short-lived OAuth state record
3. User is redirected to PandaDoc authorization
4. PandaDoc redirects back to `/api/oauth/pandadoc/callback`
5. The app atomically claims the OAuth state, exchanges the code, fetches the current PandaDoc member, encrypts tokens, and persists the connection

## PandaDoc invoice import configuration

The phase 2 invoice-to-PandaDoc flow is template based.

Required PandaDoc env vars:

- `PANDADOC_TEMPLATE_UUID`: template used to create the PandaDoc document
- `PANDADOC_RECIPIENT_ROLE`: recipient role expected by the template, for example `Client`
- `PANDADOC_DOCUMENT_NAME_PREFIX`: prefix used when naming generated documents
- `PANDADOC_SEND_ON_IMPORT`: if `true`, the app sends the document automatically once PandaDoc reports the draft is ready

Template token contract sent by the app:

- `Invoice.ID`
- `Invoice.Number`
- `Invoice.Amount`
- `Invoice.Balance`
- `Invoice.Currency`
- `Invoice.DueDate`
- `Customer.Name`
- `Customer.Email`

The importer requires a payer email on the QuickBooks invoice. It is sourced from `BillEmail.Address` when QuickBooks provides it. If the invoice has no payer email, the dashboard keeps the `Import to PandaDoc` action disabled and explains why.

## QuickBooks OAuth configuration

Use your Intuit app settings to register the callback URL:

- Local: `http://localhost:3000/api/oauth/quickbooks/callback`

The connect flow is:

1. Logged-in user submits a same-origin `POST` to `/api/oauth/quickbooks/connect`
2. Server creates a short-lived OAuth state record
3. User is redirected to Intuit authorization
4. Intuit redirects back to `/api/oauth/quickbooks/callback` with `realmId`
5. The app atomically claims the OAuth state, exchanges the code, looks up company info, encrypts tokens, and persists the company connection

If the connected QuickBooks `realmId` changes, previously imported invoices tied to the old company are deleted and `lastSyncAt` is reset so stale invoice data cannot leak across companies.

## Invoice sync behavior

Dashboard:

- Sign-in now redirects to `/factoring-dashboard`.
- The dashboard shows PandaDoc and QuickBooks connection health, last sync timestamps, the next scheduled sync time, filters, and the normalized invoice table.
- Each invoice row shows PandaDoc import status and exposes `Import to PandaDoc` when the invoice has a payer email and PandaDoc import is configured.

Manual sync:

- Trigger from the factoring dashboard using the `Sync now` button.

Cron or background sync:

- Send `POST /api/invoices/sync`
- Include `Authorization: Bearer <INTERNAL_SYNC_SECRET>`
- Optional JSON body:

```json
{
  "connectionId": "optional-connection-id",
  "userId": "optional-user-id",
  "force": false
}
```

Design notes:

- Local development uses the inline `SyncQueue` implementation in [lib/jobs/sync-queue.ts](/Users/qfedesq/Desktop/PandaDoc/lib/jobs/sync-queue.ts).
- The queue interface is intentionally narrow so BullMQ, SQS, Sidekiq-style workers, or a hosted job runner can replace it later without touching the UI or route handlers.
- The sync endpoint prevents overlapping runs for the same connection by rejecting a second in-flight sync with `409`.
- Scheduled syncs are controlled globally with `INVOICE_SYNC_ENABLED` and `INVOICE_SYNC_INTERVAL_MINUTES`.
- Scheduled runs sync only QuickBooks connections whose `lastSyncAt` is older than the configured interval, or which have never synced.
- User-triggered sync always forces an immediate refresh for the selected connection.
- The route returns the effective `dueOnly` mode and interval so cron orchestration can be observed easily.

Example cron trigger:

```bash
curl -X POST \
  -H "Authorization: Bearer $INTERNAL_SYNC_SECRET" \
  http://localhost:3000/api/invoices/sync
```

Production wiring examples:

- Vercel Cron -> `POST /api/invoices/sync`
- GitHub Actions schedule -> `curl` the internal route with the shared secret
- ECS/Fly/Render cron worker -> invoke the same route or call the shared sync service directly

## How invoice status is derived

The QuickBooks adapter does not trust UI-only status labels. Instead the internal status is derived from the raw invoice fields:

- `PAID`: `balance <= 0`
- `PARTIALLY_PAID`: `balance > 0 && balance < total_amount`
- `OVERDUE`: `balance > 0 && due_date < today`
- `OPEN`: `balance > 0 && due_date >= today`, or due date is missing

`PARTIALLY_PAID` currently takes precedence over `OVERDUE` and `OPEN` because it carries stronger payment-state information. This is covered by tests and documented in the mapper.

## Sync safety and incremental behavior

- First sync requests outstanding invoices only.
- Incremental sync requests invoices updated since the last sync, even if they are no longer outstanding.
- If an already-imported invoice becomes paid, the app updates the local record to `PAID` instead of leaving stale outstanding data behind.
- Imported invoices are upserted by `(connectionId, providerInvoiceId)` for idempotency.
- Status and overdue filters now compose as true `AND` constraints instead of one silently overwriting the other.
- Scheduled sync eligibility is based on the configured interval instead of “sync every time the cron fires”, so repeated scheduler invocations stay safe and cheap.

## Security notes

- Provider tokens are encrypted at rest with AES-256-GCM before they are stored in PostgreSQL.
- Tokens are never exposed to client components.
- App sessions use an opaque cookie with a hashed session token stored in the database.
- OAuth state is stored server-side and expired after 10 minutes.
- Login, OAuth, sync, and webhook routes use database-backed rate limiting with in-memory fallback only if the database is unavailable.
- Session-bound mutation routes validate `Origin` or `Referer` against `APP_BASE_URL` to reduce CSRF risk.
- Outbound provider HTTP calls use bounded request timeouts through `OUTBOUND_HTTP_TIMEOUT_MS`.
- Structured logs redact token-, secret-, cookie-, and password-like keys.
- Production runtime blocks insecure defaults when sensitive features are used, including the default admin password, cron secret, and token encryption key.

## Webhooks

The PandaDoc webhook endpoint is:

- `POST /api/webhooks/pandadoc`

Behavior:

- Persists the raw payload and headers to `WebhookEventLog`
- Computes a payload hash and de-duplicates repeated deliveries safely under concurrent webhook retries
- Validates the webhook signature as an HMAC-SHA256 of the raw request body if `PANDADOC_WEBHOOK_SHARED_SECRET` is set
- Processes document events to update `DocumentInvoiceLink`
- If `PANDADOC_SEND_ON_IMPORT=true`, the webhook processor automatically sends imported documents once PandaDoc emits `document_state_changed` with `document.draft`

Supported phase 2 behavior:

- `Import to PandaDoc` creates a document from the configured template
- The app stores the PandaDoc document id in `DocumentInvoiceLink`
- Webhooks update PandaDoc document status in the factoring dashboard
- Auto-send is idempotent and guarded by `sentAt` on the document link

For local testing, example payloads are in:

- [mock-data/quickbooks/outstanding-invoices-response.json](/Users/qfedesq/Desktop/PandaDoc/mock-data/quickbooks/outstanding-invoices-response.json)
- [mock-data/pandadoc/webhook-event.json](/Users/qfedesq/Desktop/PandaDoc/mock-data/pandadoc/webhook-event.json)

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:deploy`
- `npm run db:seed`

## Tests

Unit and integration:

```bash
npm run test:unit
```

Playwright smoke:

```bash
npm run test:e2e
```

The Playwright suite expects the database to be migrated and seeded first.

## Future-ready extension points

- `DocumentInvoiceLink` is already in the schema to link PandaDoc documents with imported invoices.
- QuickBooks invoices are normalized into a stable internal record so PandaDoc document generation can be layered on later.
- Sync runs and metric counters provide an audit trail for adding retries, dead-letter queues, and alerting.
- PandaDoc webhook events are stored even before full downstream business processing exists.
- The provider adapters are isolated so future features like “push payment state back into PandaDoc” or richer PandaDoc Payments orchestration can be added without route-handler rewrites.
