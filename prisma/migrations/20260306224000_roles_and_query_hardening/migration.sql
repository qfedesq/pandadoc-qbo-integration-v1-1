-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SELLER', 'OPERATOR', 'ADMIN');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'SELLER';

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "invoices_user_id_due_date_last_synced_at_idx"
ON "invoices"("userId", "dueDate", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "factoring_positions_user_id_created_at_idx"
ON "factoring_positions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_user_id_event_type_created_at_idx"
ON "audit_events"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "pool_transactions_capital_source_id_created_at_idx"
ON "pool_transactions"("capitalSourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "factoring_positions_one_active_per_invoice_idx"
ON "factoring_positions"("importedInvoiceId")
WHERE "status" IN ('PENDING', 'FUNDED');
