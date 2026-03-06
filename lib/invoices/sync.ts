import { Provider, SyncRunStatus, SyncTrigger } from "@prisma/client";

import {
  getConnectionWithSecrets,
  markConnectionError,
  markConnectionSynced,
} from "@/lib/db/integrations";
import {
  completeSyncRun,
  findExistingImportedInvoices,
  startSyncRun,
  upsertImportedInvoice,
} from "@/lib/db/invoices";
import { logger } from "@/lib/logging/logger";
import { incrementMetric } from "@/lib/observability/metrics";
import { isQuickBooksMockMode } from "@/lib/env";
import { fetchQuickBooksInvoices } from "@/lib/providers/quickbooks/client";
import { getMockQuickBooksCompanyInfo, getMockQuickBooksInvoices } from "@/lib/providers/quickbooks/mock";
import { getQuickBooksAccessContext } from "@/lib/providers/quickbooks/tokens";
import { AppError, getErrorMessage } from "@/lib/utils/errors";

import { isOutstandingInvoice, mapQuickBooksInvoice } from "./map";

type SyncDeps = {
  now?: () => Date;
  getAccessContext: typeof getQuickBooksAccessContext;
  fetchInvoices: typeof fetchQuickBooksInvoices;
  startRun: typeof startSyncRun;
  completeRun: typeof completeSyncRun;
  findExistingInvoices: typeof findExistingImportedInvoices;
  upsertInvoice: typeof upsertImportedInvoice;
  markSynced: typeof markConnectionSynced;
  markConnectionError: typeof markConnectionError;
};

export type SyncSummary = {
  runId: string;
  fetchedCount: number;
  processedCount: number;
  upsertedCount: number;
  skippedCount: number;
  errorCount: number;
};

export async function syncQuickBooksOutstandingInvoices(
  deps: SyncDeps,
  input: {
    connectionId: string;
    trigger: SyncTrigger;
  },
): Promise<SyncSummary> {
  const now = deps.now?.() ?? new Date();
  const accessContext = await deps.getAccessContext(input.connectionId);
  const run = await deps.startRun({
    userId: accessContext.connection.userId,
    organizationId: accessContext.connection.organizationId,
    connectionId: accessContext.connection.id,
    provider: Provider.QUICKBOOKS,
    trigger: input.trigger,
  });

  let fetchedCount = 0;
  let processedCount = 0;
  let upsertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const isIncremental = Boolean(accessContext.connection.lastSyncAt);
    const invoices = await deps.fetchInvoices({
      accessToken: accessContext.accessToken,
      realmId: accessContext.realmId,
      updatedAfter: accessContext.connection.lastSyncAt ?? undefined,
      outstandingOnly: !isIncremental,
    });

    fetchedCount = invoices.length;

    const existingInvoices = await deps.findExistingInvoices(
      accessContext.connection.id,
      invoices.map((invoice) => invoice.Id),
    );
    const existingIds = new Set(existingInvoices.map((invoice) => invoice.providerInvoiceId));
    const processedInvoiceIds = new Set<string>();

    for (const invoice of invoices) {
      try {
        const mapped = mapQuickBooksInvoice(invoice, now);

        if (processedInvoiceIds.has(mapped.providerInvoiceId)) {
          skippedCount += 1;
          continue;
        }

        processedInvoiceIds.add(mapped.providerInvoiceId);
        const outstanding = isOutstandingInvoice(invoice);
        const existsLocally = existingIds.has(mapped.providerInvoiceId);

        if (!outstanding && !existsLocally) {
          skippedCount += 1;
          continue;
        }

        await deps.upsertInvoice({
          userId: accessContext.connection.userId,
          organizationId: accessContext.connection.organizationId,
          connectionId: accessContext.connection.id,
          quickBooksCompanyId: accessContext.company.id,
          providerInvoiceId: mapped.providerInvoiceId,
          docNumber: mapped.docNumber,
          totalAmount: mapped.totalAmount,
          balanceAmount: mapped.balanceAmount,
          currency: mapped.currency,
          dueDate: mapped.dueDate,
          issueDate: mapped.issueDate,
          txnDate: mapped.txnDate,
          createdTime: mapped.createdTime,
          updatedTime: mapped.updatedTime,
          counterpartyName: mapped.counterpartyName,
          counterpartyEmail: mapped.counterpartyEmail,
          normalizedStatus: mapped.normalizedStatus,
          rawPayload: mapped.rawPayload,
          lastSyncedAt: now,
        });

        processedCount += 1;
        upsertedCount += 1;
      } catch (error) {
        errorCount += 1;
        logger.warn("quickbooks.invoice_sync_item_failed", {
          connectionId: input.connectionId,
          invoiceId: invoice.Id,
          error,
        });
      }
    }

    await deps.markSynced(accessContext.connection.id, now);

    await deps.completeRun(run.id, {
      status: SyncRunStatus.SUCCESS,
      fetchedCount,
      processedCount,
      upsertedCount,
      skippedCount,
      errorCount,
      cursor: accessContext.connection.lastSyncAt?.toISOString() ?? null,
      metrics: {
        realmId: accessContext.realmId,
        incremental: isIncremental,
      },
    });

    await incrementMetric("invoice_sync_success", "quickbooks");

    return {
      runId: run.id,
      fetchedCount,
      processedCount,
      upsertedCount,
      skippedCount,
      errorCount,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await deps.markConnectionError(accessContext.connection.id, message);
    await deps.completeRun(run.id, {
      status: SyncRunStatus.FAILED,
      fetchedCount,
      processedCount,
      upsertedCount,
      skippedCount,
      errorCount,
      errorMessage: message,
      cursor: accessContext.connection.lastSyncAt?.toISOString() ?? null,
      metrics: {
        realmId: accessContext.realmId,
      },
    });
    await incrementMetric("invoice_sync_error", "quickbooks");
    logger.error("quickbooks.invoice_sync_failed", {
      connectionId: input.connectionId,
      error,
    });
    throw new AppError(message, 500, "QUICKBOOKS_SYNC_FAILED");
  }
}

export async function syncQuickBooksOutstandingInvoicesForConnection(
  connectionId: string,
  trigger: SyncTrigger = "SYSTEM",
) {
  const connection = await getConnectionWithSecrets(connectionId);

  if (!connection) {
    throw new AppError("QuickBooks connection not found.", 404, "CONNECTION_NOT_FOUND");
  }

  const connectionMode =
    typeof connection.metadata === "object" &&
    connection.metadata !== null &&
    "mode" in connection.metadata
      ? String((connection.metadata as Record<string, unknown>).mode)
      : null;

  if (isQuickBooksMockMode() || connectionMode === "mock") {
    const company = connection.quickBooksCompany;
    const mockCompany = getMockQuickBooksCompanyInfo();

    if (!company) {
      throw new AppError(
        "Mock QuickBooks company is not initialized for this connection.",
        409,
        "MOCK_QUICKBOOKS_NOT_INITIALIZED",
      );
    }

    return syncQuickBooksOutstandingInvoices(
      {
        getAccessContext: async () => ({
          accessToken: "mock",
          realmId: mockCompany.realmId,
          company,
          connection,
        }),
        fetchInvoices: async () => getMockQuickBooksInvoices(),
        startRun: startSyncRun,
        completeRun: completeSyncRun,
        findExistingInvoices: findExistingImportedInvoices,
        upsertInvoice: upsertImportedInvoice,
        markSynced: markConnectionSynced,
        markConnectionError,
      },
      {
        connectionId,
        trigger,
      },
    );
  }

  return syncQuickBooksOutstandingInvoices(
    {
      getAccessContext: getQuickBooksAccessContext,
      fetchInvoices: fetchQuickBooksInvoices,
      startRun: startSyncRun,
      completeRun: completeSyncRun,
      findExistingInvoices: findExistingImportedInvoices,
      upsertInvoice: upsertImportedInvoice,
      markSynced: markConnectionSynced,
      markConnectionError,
    },
    {
      connectionId,
      trigger,
    },
  );
}
