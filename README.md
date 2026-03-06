# pandadoc-qbo-integration v1.9

Repository baseline: `pandadoc-qbo-integration v1.3`

Protofire-branded MVP for an embedded invoice factoring product inside a PandaDoc workflow. The app connects a seller workspace to QuickBooks, imports invoices, generates factoring terms, funds eligible invoices from a managed liquidity pool, credits a demo USDC wallet, simulates repayment, and records yield plus operator fees with an auditable ledger.

## What this MVP proves

- Working capital for invoice sellers
- Yield for capital providers
- Protocol / operator fee capture for the marketplace owner
- A credible path from mock demo mode to live QuickBooks OAuth and real settlement rails

## Core product flow

1. Seller signs in to the workspace
2. Seller connects QuickBooks
3. Outstanding invoices are imported and normalized
4. Eligible invoices show a `Withdraw Capital` action
5. Seller reviews factoring terms
6. Seller accepts terms and funding happens immediately
7. Seller receives demo USDC in the internal wallet ledger
8. Invoice and factoring position move to funded state
9. Operator simulates repayment from the admin console
10. Pool principal returns, pool yield accrues, and protocol fees are credited

## MVP scope

Implemented:

- Next.js 15 + React 19 + TypeScript full-stack app
- PostgreSQL persistence with Prisma schema and migrations
- QuickBooks adapter boundary with `mock` and `oauth` modes
- Seller dashboard, invoice inventory, transaction history
- Capital pool dashboard
- Operator console with repayment controls
- Factoring offer engine with advance rate, pricing, net proceeds, and risk tier
- Funding and repayment orchestration
- Seller / pool / operator wallet ledger
- Pool transaction log
- Audit event trail
- Seeded demo data with eligible, funded, and repaid examples
- Unit and integration coverage for critical business rules

Out of scope for this MVP:

- Real KYC / underwriting
- Collections engine
- Real on-chain contracts
- Multi-pool capital markets
- Secondary markets

## Architecture

### Application layers

- `app/`
  Next.js App Router pages and REST endpoints
- `components/`
  Seller, pool, and operator UI components
- `lib/providers/quickbooks/`
  Real QuickBooks client plus mock adapter data
- `lib/invoices/`
  Invoice sync, normalization, and scheduling
- `lib/factoring/`
  Eligibility, offer calculation, funding, repayment
- `lib/db/`
  Prisma-backed query helpers
- `prisma/`
  Schema, SQL migrations, and seed script

### Business entities

- `users`
- `organizations`
- `accounting_connections`
- `invoices`
- `factoring_offers`
- `factoring_positions`
- `liquidity_pools`
- `pool_transactions`
- `wallet_ledgers`
- `audit_events`

### Demo settlement model

- Seller receives `netProceeds` in demo USDC
- Pool deploys the seller net proceeds amount
- Repayment returns principal to the pool
- Discount amount is booked as pool yield
- Operator fee is booked to the operator wallet ledger

## Repo tree

```text
app/
  (auth)/
  (dashboard)/
    factoring-dashboard/
    invoices/
    transactions/
    capital-pool/
    operator/
    integrations/
  api/
components/
lib/
  auth/
  db/
  factoring/
  invoices/
  providers/
prisma/
  migrations/
  schema.prisma
  seed.ts
mock-data/
tests/
```

## Local setup

### Prerequisites

- Node.js 20.19+
- Docker Desktop or another local Postgres runtime

### 1. Copy the environment file

```bash
cp .env.example .env
```

Important:

- `.env.example` uses Postgres on `localhost:5432`
- if your local machine already uses a different port, update `DATABASE_URL`

### 2. Start Postgres

```bash
docker compose up -d postgres
```

### 3. Install dependencies

```bash
npm install
```

### 4. Apply migrations

```bash
npm run db:deploy
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start the app

```bash
npm run dev
```

### 7. Sign in

- URL: `http://localhost:3000/login`
- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Mock mode

The app runs fully out of the box with:

```env
PANDADOC_MODE=mock
QUICKBOOKS_MODE=mock
SEED_DEMO_DATA=true
```

In mock mode:

- PandaDoc connect creates a demo workspace and document import uses a mock adapter
- QuickBooks connect creates a demo company instead of redirecting to Intuit
- invoice sync reads realistic payloads from `mock-data/quickbooks/outstanding-invoices-response.json`
- the full seller -> pool -> operator flow works without external credentials

## Switching to real PandaDoc later

1. Set `PANDADOC_MODE=oauth`
2. Provide:
   - `PANDADOC_CLIENT_ID`
   - `PANDADOC_CLIENT_SECRET`
   - `PANDADOC_REDIRECT_URI`
   - `PANDADOC_SCOPES`
   - `PANDADOC_AUTH_URL`
   - `PANDADOC_TOKEN_URL`
   - `PANDADOC_API_BASE_URL`
   - `PANDADOC_TEMPLATE_UUID`
3. Reconnect PandaDoc from `/integrations`

## Switching to real QuickBooks later

1. Set `QUICKBOOKS_MODE=oauth`
2. Provide:
   - `QUICKBOOKS_CLIENT_ID`
   - `QUICKBOOKS_CLIENT_SECRET`
   - `QUICKBOOKS_REDIRECT_URI`
   - `QUICKBOOKS_SCOPES`
   - `QUICKBOOKS_ENV`
   - `QUICKBOOKS_AUTH_URL`
   - `QUICKBOOKS_TOKEN_URL`
   - `QUICKBOOKS_MINOR_VERSION`
3. Reconnect QuickBooks from `/integrations`

The domain layer does not change. Only the adapter boundary changes.

## Environment variables

Required for local demo:

- `DATABASE_URL`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `TOKEN_ENCRYPTION_KEY`
- `SEED_DEMO_DATA`
- `PANDADOC_MODE`
- `QUICKBOOKS_MODE`
- `ARENA_STAFI_POOL_NAME`
- `ARENA_STAFI_NETWORK`
- `ARENA_STAFI_OPERATOR_WALLET`
- `ARENA_STAFI_LIQUIDITY_SNAPSHOT`
- `FACTORING_ADVANCE_RATE_BPS`
- `FACTORING_BASE_DISCOUNT_BPS`
- `FACTORING_PARTIAL_PAYMENT_DISCOUNT_BPS`
- `FACTORING_PROTOCOL_FEE_BPS`
- `FACTORING_MIN_INVOICE_AMOUNT`
- `FACTORING_MIN_NET_PROCEEDS`

Optional for extended demo:

- PandaDoc OAuth variables
- Google OAuth variables

## Demo walkthrough

1. Sign in at `/login`
2. Open `/integrations`
3. Click `Connect` for the PandaDoc demo workspace
4. Click `Connect demo company` for QuickBooks
5. Open `/factoring-dashboard`
6. Click `Sync now`
7. Review eligible invoices
8. Click `Withdraw Capital` on an eligible invoice
9. Accept terms and fund the invoice
10. Open `/transactions` to verify the funded position
11. Open `/capital-pool` to inspect deployed capital and pool balances
12. Open `/operator` and simulate repayment for a funded invoice
13. Return to `/capital-pool` and `/transactions` to confirm yield and fee booking

## API surface

Main routes:

- `POST /api/auth/login`
- `POST /api/oauth/pandadoc/connect`
- `POST /api/oauth/quickbooks/connect`
- `POST /api/invoices/sync`
- `POST /api/factoring/transactions`
- `POST /api/factoring/transactions/:transactionId/fund`
- `POST /api/factoring/transactions/:transactionId/repay`
- `POST /api/pandadoc/import-invoice`

Route intent:

- `/api/oauth/pandadoc/connect`
  Connects either the PandaDoc mock adapter or the real OAuth flow
- `/api/oauth/quickbooks/connect`
  Connects either the mock adapter or the real OAuth flow
- `/api/invoices/sync`
  Imports invoices from the configured QuickBooks adapter
- `/api/factoring/transactions`
  Accepts terms, creates a factoring position, reserves pool liquidity, and disburses demo capital
- `/api/factoring/transactions/:id/repay`
  Simulates repayment, books pool yield, and records operator fees

## Tests

Run unit and integration tests:

```bash
npm run test:unit
```

Run build verification:

```bash
npm run build
```

Run Playwright smoke tests after the database is migrated and seeded:

```bash
npm run test:e2e
```

## Current assumptions

- One managed liquidity pool powers the demo
- Demo auth is sufficient for local validation
- PandaDoc can run in mock or OAuth mode without changing the factoring workflow
- Stablecoin settlement is simulated through the internal wallet ledger

## Known limitations

- The checked-in Prisma migration for the marketplace ledger layer was written manually because Prisma migration generation was blocked by local database port inconsistencies in this environment
- Pool accounting is single-currency and single-pool
- Risk tiering is heuristic, not underwritten
- Default handling is a placeholder state only
- Settlement is ledger-based rather than on-chain

## Production hardening next steps

1. Replace mock PandaDoc and QuickBooks modes with tenant-safe live OAuth onboarding
2. Add multi-tenant RBAC for seller, provider, and operator personas
3. Reconcile pool accounting against a real treasury / wallet system
4. Add webhooks or scheduled jobs for invoice payment detection
5. Add stronger observability, retry semantics, and idempotency for funding / repayment events
6. Introduce contract-ready settlement adapters if the product moves on-chain
