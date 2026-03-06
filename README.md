# PandaDoc Working Capital Demo v1.10

Production-style MVP for an embedded invoice factoring product inside a PandaDoc workflow. The application connects PandaDoc and QuickBooks, imports receivables, calculates factoring offers, funds eligible invoices from a managed capital pool, credits a demo USDC ledger, simulates repayment, and records pool yield plus platform fees with a full audit trail.

## Why this exists

The demo is designed to support a first commercial conversation with PandaDoc:

- keep working capital inside the PandaDoc workflow
- turn outstanding QuickBooks invoices into immediate liquidity
- show monetization for the platform operator
- show yield for capital providers
- prove the concept without requiring live banking or on-chain settlement

## What the product does

### Seller flow

1. Sign in to the PandaDoc working capital workspace
2. Connect QuickBooks and optionally PandaDoc
3. Sync outstanding invoices
4. Review eligible invoices in the seller dashboard
5. Open an offer and click `Withdraw Capital`
6. Accept terms and receive demo USDC in the internal ledger
7. Track the position through funding and repayment

### Operator flow

1. Open the operator console
2. Review open positions funded by the managed pool
3. Simulate repayment on funded positions
4. Confirm pool principal return, yield accrual, and platform fee booking

### Capital pool flow

1. View total liquidity, deployed capital, accrued yield, and platform fees
2. Inspect funded invoices drawing from the pool
3. Review pool transaction history and wallet balances

## Architecture

### Stack

- Next.js 15 App Router
- React 19
- TypeScript with strict mode
- PostgreSQL
- Prisma ORM
- Zod validation
- Vitest + Playwright test scaffolding

### Architectural shape

- `app/`
  App Router pages and route handlers
- `components/`
  UI primitives and feature components
- `lib/auth/`
  session handling, RBAC helpers, login validation
- `lib/db/`
  Prisma-backed data access and query boundaries
- `lib/factoring/`
  eligibility, pricing, funding, repayment, marketplace logic
- `lib/invoices/`
  sync orchestration, normalization, scheduling
- `lib/providers/`
  PandaDoc, QuickBooks, and Google integration adapters
- `lib/server/`
  route-handler helpers for auth, rate limiting, response shaping, and validation
- `prisma/`
  schema, migrations, and seed script
- `tests/`
  unit and integration coverage for critical flows

### Product surfaces

- Public:
  - `/`
  - `/login`
- Seller:
  - `/factoring-dashboard`
  - `/invoices`
  - `/transactions`
  - `/integrations`
- Operator / internal:
  - `/operator`
  - `/capital-pool`

### Domain boundaries

- UI renders server-shaped data, not raw mutation payloads
- route handlers validate every request boundary with Zod
- business logic lives in domain services, not in pages
- persistence helpers live under `lib/db`
- external systems are isolated behind provider adapters

## Data model

Core entities:

- `organizations`
- `users`
- `app_sessions`
- `accounting_connections`
- `oauth_tokens`
- `invoices`
- `factoring_offers`
- `factoring_positions`
- `liquidity_pools`
- `pool_transactions`
- `wallet_ledgers`
- `audit_events`
- `sync_runs`
- `document_invoice_links`

Important integrity rules:

- one active factoring position per invoice enforced at the database level via a partial unique index
- foreign keys across invoices, offers, positions, pool transactions, and ledgers
- query-facing indexes for invoices, transactions, audit events, and pool activity
- explicit role model: `SELLER`, `OPERATOR`, `ADMIN`

## Security posture

Implemented:

- server-side session cookies with rotation and expiry refresh
- session cookie invalidation when expired sessions are observed
- role-aware RBAC helpers for seller vs operator/admin surfaces
- middleware-based protection for private routes
- security headers via middleware:
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- `Cache-Control: private, no-store` on private surfaces
- origin checks on mutating application routes
- double-submit cookie CSRF protection on browser-originated mutations
- rate limiting on login, sync, webhook, and mutation endpoints
- strict JSON/form boundary validation with Zod
- bounded request sizes for JSON bodies and PandaDoc webhooks
- safe internal redirect sanitization
- safe public error shaping without leaking stack traces
- server-only imports on server modules to reduce accidental client bundling

Not yet production-complete:

- deeper session binding and enterprise-grade anti-replay controls beyond the current CSRF layer
- SSO / enterprise identity management
- per-organization authorization policies beyond role + route boundary
- secret rotation automation
- audit log export to external SIEM

## Performance posture

Implemented:

- server-first rendering for dashboard pages
- pagination for invoice and transaction listings
- bounded pool, ledger, and audit queries
- reduced accidental overfetch on the main dashboards
- operator and pool dashboards now query by capital source instead of the logged-in seller
- retryable serializable transactions for critical funding state changes
- duplicate active-position protection under concurrent funding attempts
- limited client islands for interactive controls only

Still intentionally simple:

- no Redis cache
- no async job worker beyond synchronous demo flows
- no background reconciliation pipeline

## Mock mode vs real integrations

The application runs fully in local demo mode with no third-party credentials.

### Mock mode

Use:

```env
PANDADOC_MODE=mock
QUICKBOOKS_MODE=mock
SEED_DEMO_DATA=true
```

Behavior:

- PandaDoc connect creates a demo workspace
- QuickBooks connect creates a demo company
- invoice sync imports realistic mock invoices
- the full seller -> funding -> repayment flow works end to end

### QuickBooks OAuth later

Switch to:

```env
QUICKBOOKS_MODE=oauth
```

Then provide:

- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_REDIRECT_URI`
- `QUICKBOOKS_SCOPES`
- `QUICKBOOKS_ENV`
- `QUICKBOOKS_AUTH_URL`
- `QUICKBOOKS_TOKEN_URL`
- `QUICKBOOKS_MINOR_VERSION`

### PandaDoc OAuth later

Switch to:

```env
PANDADOC_MODE=oauth
```

Then provide:

- `PANDADOC_CLIENT_ID`
- `PANDADOC_CLIENT_SECRET`
- `PANDADOC_REDIRECT_URI`
- `PANDADOC_SCOPES`
- `PANDADOC_AUTH_URL`
- `PANDADOC_TOKEN_URL`
- `PANDADOC_API_BASE_URL`
- `PANDADOC_TEMPLATE_UUID`
- `PANDADOC_WEBHOOK_SHARED_SECRET`

## Local setup

### Prerequisites

- Node.js `20.19+`
- Docker or a local PostgreSQL instance

### Install and run

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

### Demo login

- URL: `http://localhost:3000/login`
- Email: value of `DEFAULT_ADMIN_EMAIL`
- Password: value of `DEFAULT_ADMIN_PASSWORD`

## Environment variables

Minimum local demo variables:

- `APP_BASE_URL`
- `DATABASE_URL`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `INTERNAL_SYNC_SECRET`
- `PANDADOC_MODE`
- `QUICKBOOKS_MODE`
- `SEED_DEMO_DATA`
- `FACTORING_ADVANCE_RATE_BPS`
- `FACTORING_BASE_DISCOUNT_BPS`
- `FACTORING_PROTOCOL_FEE_BPS`
- `ARENA_STAFI_POOL_NAME`
- `ARENA_STAFI_NETWORK`
- `ARENA_STAFI_OPERATOR_WALLET`
- `ARENA_STAFI_LIQUIDITY_SNAPSHOT`

See `.env.example` for the full list.

## Database and migrations

Commands:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

Important migration additions in this iteration:

- user roles
- query indexes for invoices, transactions, audit events, and pool activity
- partial unique index to prevent multiple active positions on the same invoice

## API surface

Primary internal API routes:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/google/connect`
- `POST /api/oauth/quickbooks/connect`
- `POST /api/oauth/pandadoc/connect`
- `POST /api/invoices/sync`
- `GET /api/cron/invoices-sync`
- `POST /api/factoring/transactions`
- `POST /api/factoring/transactions/:transactionId/fund`
- `POST /api/factoring/transactions/:transactionId/repay`
- `POST /api/pandadoc/import-invoice`
- `POST /api/webhooks/pandadoc`

Conventions:

- request bodies validated with Zod
- mutating routes enforce origin checks and rate limits
- API responses on private surfaces are `no-store`
- errors are normalized to safe public messages

## Demo notes

- Seller and operator surfaces are intentionally separate
- operator and capital pool views are role-gated
- the current seeded admin user can access all views
- the talk track for first customer meetings lives in `docs/pandadoc-demo-script.md`

## Testing

Run:

```bash
npm run test:unit
npm run build
```

Optional:

```bash
npm run test:e2e
```

Covered paths:

- eligibility rules
- offer calculation
- factoring transaction creation
- duplicate transaction protection
- OAuth callback flows
- QuickBooks sync flows
- PandaDoc import and webhook processing
- redirect sanitization
- authorization helpers

## Known limitations

- settlement remains an internal ledger simulation, not a real USDC rail
- no real treasury, banking, or chain reconciliation
- underwriting is heuristic and intentionally simple
- operator/admin authorization is role-based but not yet backed by full enterprise IAM
- no secondary markets, collections engine, or legal servicing workflow
- middleware uses a practical CSP compatible with Next.js, not a nonce-based hardened CSP

## Recommended roadmap to production

1. Replace demo settlement with a real treasury and wallet orchestration layer.
2. Add stronger session binding, permission policies, and organization-scoped authz.
3. Introduce background jobs for invoice sync, repayment reconciliation, and webhook retries.
4. Expand RBAC from route-level roles to organization-scoped permissions.
5. Add real observability sinks for logs, metrics, traces, and security audit events.
6. Add reconciliation reports and finance-facing exports.

## Commercial demo script

See `docs/pandadoc-demo-script.md` for the recommended first-meeting walkthrough.
