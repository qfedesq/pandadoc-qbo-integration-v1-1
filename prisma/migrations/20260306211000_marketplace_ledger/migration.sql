CREATE TYPE "FactoringLifecycleStatus" AS ENUM (
  'IMPORTED',
  'ELIGIBLE',
  'PENDING_TERMS_ACCEPTANCE',
  'FUNDED',
  'REPAYMENT_PENDING',
  'REPAID',
  'DEFAULTED'
);

CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "PoolTransactionType" AS ENUM (
  'FUNDING_DISBURSED',
  'REPAYMENT_RECEIVED',
  'YIELD_BOOKED',
  'PROTOCOL_FEE_BOOKED'
);
CREATE TYPE "LedgerOwnerType" AS ENUM ('SELLER', 'POOL', 'OPERATOR');
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

ALTER TYPE "FactoringTransactionStatus" ADD VALUE IF NOT EXISTS 'DEFAULTED';
ALTER TYPE "FactoringEventType" ADD VALUE IF NOT EXISTS 'FUNDS_RESERVED';
ALTER TYPE "FactoringEventType" ADD VALUE IF NOT EXISTS 'CAPITAL_DISBURSED';
ALTER TYPE "FactoringEventType" ADD VALUE IF NOT EXISTS 'REPAYMENT_PENDING';
ALTER TYPE "FactoringEventType" ADD VALUE IF NOT EXISTS 'POOL_DISTRIBUTION_BOOKED';

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "AppSession" RENAME TO "app_sessions";
ALTER TABLE "OAuthState" RENAME TO "oauth_states";
ALTER TABLE "AuthLoginState" RENAME TO "auth_login_states";
ALTER TABLE "UserIdentity" RENAME TO "user_identities";
ALTER TABLE "IntegrationConnection" RENAME TO "accounting_connections";
ALTER TABLE "OAuthToken" RENAME TO "oauth_tokens";
ALTER TABLE "QuickBooksCompany" RENAME TO "quickbooks_companies";
ALTER TABLE "ImportedInvoice" RENAME TO "invoices";
ALTER TABLE "WebhookEventLog" RENAME TO "webhook_event_logs";
ALTER TABLE "SyncRun" RENAME TO "sync_runs";
ALTER TABLE "MetricCounter" RENAME TO "metric_counters";
ALTER TABLE "RateLimitBucket" RENAME TO "rate_limit_buckets";
ALTER TABLE "DocumentInvoiceLink" RENAME TO "document_invoice_links";
ALTER TABLE "CapitalSource" RENAME TO "liquidity_pools";
ALTER TABLE "FactoringOffer" RENAME TO "factoring_offers";
ALTER TABLE "FactoringTransaction" RENAME TO "factoring_positions";
ALTER TABLE "FactoringEventLog" RENAME TO "audit_events";

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

ALTER TABLE "users"
  ADD COLUMN "organizationId" TEXT;

ALTER TABLE "accounting_connections"
  ADD COLUMN "organizationId" TEXT;

ALTER TABLE "invoices"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "factoringLifecycleStatus" "FactoringLifecycleStatus" NOT NULL DEFAULT 'IMPORTED',
  ADD COLUMN "fundedAt" TIMESTAMP(3),
  ADD COLUMN "repaidAt" TIMESTAMP(3);

ALTER TABLE "sync_runs"
  ADD COLUMN "organizationId" TEXT;

ALTER TABLE "document_invoice_links"
  ADD COLUMN "organizationId" TEXT;

ALTER TABLE "liquidity_pools"
  ADD COLUMN "totalLiquidity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "availableLiquidity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "deployedLiquidity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "accruedYield" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "protocolFeesCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "targetAdvanceRateBps" INTEGER NOT NULL DEFAULT 9000,
  ADD COLUMN "operatorFeeBps" INTEGER NOT NULL DEFAULT 50;

UPDATE "liquidity_pools"
SET
  "totalLiquidity" = COALESCE("liquiditySnapshot", 0),
  "availableLiquidity" = COALESCE("liquiditySnapshot", 0),
  "deployedLiquidity" = 0,
  "accruedYield" = 0,
  "protocolFeesCollected" = 0
WHERE
  "totalLiquidity" = 0
  AND "availableLiquidity" = 0
  AND "deployedLiquidity" = 0;

ALTER TABLE "factoring_offers"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "advanceRateBps" INTEGER,
  ADD COLUMN "advanceAmount" DECIMAL(18,2),
  ADD COLUMN "operatorFeeBps" INTEGER,
  ADD COLUMN "operatorFeeAmount" DECIMAL(18,2),
  ADD COLUMN "expectedRepaymentAmount" DECIMAL(18,2),
  ADD COLUMN "expectedMaturityDate" TIMESTAMP(3),
  ADD COLUMN "riskTier" "RiskTier";

UPDATE "factoring_offers"
SET
  "advanceRateBps" = 9000,
  "advanceAmount" = COALESCE("netProceeds" + "discountAmount", "grossAmount"),
  "operatorFeeBps" = 50,
  "operatorFeeAmount" = 0,
  "expectedRepaymentAmount" = COALESCE("netProceeds" + "discountAmount", "grossAmount"),
  "riskTier" = 'MEDIUM';

ALTER TABLE "factoring_offers"
  ALTER COLUMN "advanceRateBps" SET NOT NULL,
  ALTER COLUMN "advanceAmount" SET NOT NULL,
  ALTER COLUMN "operatorFeeBps" SET NOT NULL,
  ALTER COLUMN "operatorFeeAmount" SET NOT NULL,
  ALTER COLUMN "expectedRepaymentAmount" SET NOT NULL,
  ALTER COLUMN "riskTier" SET NOT NULL;

ALTER TABLE "factoring_positions"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "advanceRateBps" INTEGER,
  ADD COLUMN "advanceAmount" DECIMAL(18,2),
  ADD COLUMN "principalAmount" DECIMAL(18,2),
  ADD COLUMN "operatorFeeBps" INTEGER,
  ADD COLUMN "operatorFeeAmount" DECIMAL(18,2),
  ADD COLUMN "poolYieldAmount" DECIMAL(18,2),
  ADD COLUMN "expectedRepaymentAmount" DECIMAL(18,2),
  ADD COLUMN "maturityDate" TIMESTAMP(3),
  ADD COLUMN "riskTier" "RiskTier",
  ADD COLUMN "reservedAt" TIMESTAMP(3);

UPDATE "factoring_positions"
SET
  "advanceRateBps" = 9000,
  "advanceAmount" = COALESCE("netProceeds" + "discountAmount", "grossAmount"),
  "principalAmount" = "netProceeds",
  "operatorFeeBps" = 50,
  "operatorFeeAmount" = 0,
  "poolYieldAmount" = "discountAmount",
  "expectedRepaymentAmount" = COALESCE("netProceeds" + "discountAmount", "grossAmount"),
  "riskTier" = 'MEDIUM',
  "reservedAt" = "termsAcceptedAt";

ALTER TABLE "factoring_positions"
  ALTER COLUMN "advanceRateBps" SET NOT NULL,
  ALTER COLUMN "advanceAmount" SET NOT NULL,
  ALTER COLUMN "principalAmount" SET NOT NULL,
  ALTER COLUMN "operatorFeeBps" SET NOT NULL,
  ALTER COLUMN "operatorFeeAmount" SET NOT NULL,
  ALTER COLUMN "poolYieldAmount" SET NOT NULL,
  ALTER COLUMN "expectedRepaymentAmount" SET NOT NULL,
  ALTER COLUMN "riskTier" SET NOT NULL;

ALTER TABLE "audit_events"
  ADD COLUMN "organizationId" TEXT;

CREATE TABLE "pool_transactions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "capitalSourceId" TEXT NOT NULL,
  "factoringTransactionId" TEXT,
  "transactionType" "PoolTransactionType" NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "principalAmount" DECIMAL(18,2) NOT NULL,
  "yieldAmount" DECIMAL(18,2) NOT NULL,
  "feeAmount" DECIMAL(18,2) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pool_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_ledgers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "capitalSourceId" TEXT,
  "factoringTransactionId" TEXT,
  "ownerType" "LedgerOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "balanceAfter" DECIMAL(18,2) NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "accounting_connections_organizationId_provider_status_idx"
  ON "accounting_connections"("organizationId", "provider", "status");
CREATE INDEX "invoices_userId_factoringLifecycleStatus_idx"
  ON "invoices"("userId", "factoringLifecycleStatus");
CREATE INDEX "pool_transactions_capitalSourceId_transactionType_createdAt_idx"
  ON "pool_transactions"("capitalSourceId", "transactionType", "createdAt");
CREATE INDEX "wallet_ledgers_ownerType_ownerId_createdAt_idx"
  ON "wallet_ledgers"("ownerType", "ownerId", "createdAt");
CREATE INDEX "wallet_ledgers_capitalSourceId_createdAt_idx"
  ON "wallet_ledgers"("capitalSourceId", "createdAt");

ALTER TABLE "users"
  ADD CONSTRAINT "users_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_connections"
  ADD CONSTRAINT "accounting_connections_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sync_runs"
  ADD CONSTRAINT "sync_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_invoice_links"
  ADD CONSTRAINT "document_invoice_links_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factoring_offers"
  ADD CONSTRAINT "factoring_offers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factoring_positions"
  ADD CONSTRAINT "factoring_positions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pool_transactions"
  ADD CONSTRAINT "pool_transactions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pool_transactions"
  ADD CONSTRAINT "pool_transactions_capitalSourceId_fkey"
  FOREIGN KEY ("capitalSourceId") REFERENCES "liquidity_pools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pool_transactions"
  ADD CONSTRAINT "pool_transactions_factoringTransactionId_fkey"
  FOREIGN KEY ("factoringTransactionId") REFERENCES "factoring_positions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_ledgers"
  ADD CONSTRAINT "wallet_ledgers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_ledgers"
  ADD CONSTRAINT "wallet_ledgers_capitalSourceId_fkey"
  FOREIGN KEY ("capitalSourceId") REFERENCES "liquidity_pools"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_ledgers"
  ADD CONSTRAINT "wallet_ledgers_factoringTransactionId_fkey"
  FOREIGN KEY ("factoringTransactionId") REFERENCES "factoring_positions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
