import "server-only";

import {
  InvoiceStatus,
  Prisma,
  Provider,
  SyncRunStatus,
  SyncTrigger,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getPagination } from "@/lib/pagination";
import { AppError } from "@/lib/utils/errors";

export type ImportedInvoiceUpsertInput = {
  userId: string;
  organizationId?: string | null;
  connectionId: string;
  quickBooksCompanyId?: string | null;
  providerInvoiceId: string;
  docNumber?: string | null;
  totalAmount: Prisma.Decimal | string | number;
  balanceAmount: Prisma.Decimal | string | number;
  currency?: string | null;
  dueDate?: Date | null;
  issueDate?: Date | null;
  txnDate?: Date | null;
  createdTime?: Date | null;
  updatedTime?: Date | null;
  counterpartyName: string;
  counterpartyEmail?: string | null;
  normalizedStatus: InvoiceStatus;
  rawPayload: Prisma.InputJsonObject;
  lastSyncedAt: Date;
};

export async function startSyncRun(input: {
  userId?: string | null;
  organizationId?: string | null;
  connectionId?: string | null;
  provider: Provider;
  trigger: SyncTrigger;
}) {
  if (input.connectionId) {
    const running = await prisma.syncRun.findFirst({
      where: {
        connectionId: input.connectionId,
        provider: input.provider,
        status: SyncRunStatus.RUNNING,
        startedAt: {
          gt: new Date(Date.now() - 30 * 60_000),
        },
      },
      select: {
        id: true,
      },
    });

    if (running) {
      throw new AppError(
        "A sync is already running for this connection.",
        409,
        "SYNC_ALREADY_RUNNING",
      );
    }
  }

  return prisma.syncRun.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      provider: input.provider,
      trigger: input.trigger,
      status: SyncRunStatus.RUNNING,
    },
  });
}

export async function completeSyncRun(
  runId: string,
  data: {
    status: SyncRunStatus;
    fetchedCount: number;
    processedCount: number;
    upsertedCount: number;
    skippedCount: number;
    errorCount: number;
    cursor?: string | null;
    errorMessage?: string | null;
    metrics?: Prisma.InputJsonObject;
  },
) {
  return prisma.syncRun.update({
    where: {
      id: runId,
    },
    data: {
      status: data.status,
      fetchedCount: data.fetchedCount,
      processedCount: data.processedCount,
      upsertedCount: data.upsertedCount,
      skippedCount: data.skippedCount,
      errorCount: data.errorCount,
      cursor: data.cursor,
      errorMessage: data.errorMessage,
      metrics: data.metrics,
      completedAt: new Date(),
    },
  });
}

export async function upsertImportedInvoice(input: ImportedInvoiceUpsertInput) {
  return prisma.importedInvoice.upsert({
    where: {
      connectionId_providerInvoiceId: {
        connectionId: input.connectionId,
        providerInvoiceId: input.providerInvoiceId,
      },
    },
    create: {
      userId: input.userId,
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      quickBooksCompanyId: input.quickBooksCompanyId,
      provider: Provider.QUICKBOOKS,
      providerInvoiceId: input.providerInvoiceId,
      docNumber: input.docNumber,
      totalAmount: input.totalAmount,
      balanceAmount: input.balanceAmount,
      currency: input.currency,
      dueDate: input.dueDate,
      issueDate: input.issueDate,
      txnDate: input.txnDate,
      createdTime: input.createdTime,
      updatedTime: input.updatedTime,
      counterpartyName: input.counterpartyName,
      counterpartyEmail: input.counterpartyEmail,
      normalizedStatus: input.normalizedStatus,
      rawPayload: input.rawPayload,
      lastSyncedAt: input.lastSyncedAt,
    },
    update: {
      organizationId: input.organizationId,
      quickBooksCompanyId: input.quickBooksCompanyId,
      docNumber: input.docNumber,
      totalAmount: input.totalAmount,
      balanceAmount: input.balanceAmount,
      currency: input.currency,
      dueDate: input.dueDate,
      issueDate: input.issueDate,
      txnDate: input.txnDate,
      createdTime: input.createdTime,
      updatedTime: input.updatedTime,
      counterpartyName: input.counterpartyName,
      counterpartyEmail: input.counterpartyEmail,
      normalizedStatus: input.normalizedStatus,
      rawPayload: input.rawPayload,
      lastSyncedAt: input.lastSyncedAt,
    },
  });
}

export async function findExistingImportedInvoices(
  connectionId: string,
  providerInvoiceIds: string[],
) {
  if (providerInvoiceIds.length === 0) {
    return [];
  }

  return prisma.importedInvoice.findMany({
    where: {
      connectionId,
      providerInvoiceId: {
        in: providerInvoiceIds,
      },
    },
    select: {
      id: true,
      providerInvoiceId: true,
      normalizedStatus: true,
    },
  });
}

export function buildImportedInvoiceWhereInput(input: {
  userId: string;
  search?: string;
  status?: InvoiceStatus | "ALL";
  overdueOnly?: boolean;
}): Prisma.ImportedInvoiceWhereInput {
  const filters: Prisma.ImportedInvoiceWhereInput[] = [
    {
      userId: input.userId,
    },
  ];

  if (input.status && input.status !== "ALL") {
    filters.push({
      normalizedStatus: input.status,
    });
  }

  if (input.overdueOnly) {
    filters.push({
      normalizedStatus: InvoiceStatus.OVERDUE,
    });
  }

  if (input.search) {
    filters.push({
      OR: [
        {
          providerInvoiceId: {
            contains: input.search,
            mode: "insensitive",
          },
        },
        {
          counterpartyName: {
            contains: input.search,
            mode: "insensitive",
          },
        },
        {
          docNumber: {
            contains: input.search,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

export async function listImportedInvoicesForUser(input: {
  userId: string;
  search?: string;
  status?: InvoiceStatus | "ALL";
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const pagination = getPagination({
    page: input.page,
    pageSize: input.pageSize,
  });

  return prisma.importedInvoice.findMany({
    where: buildImportedInvoiceWhereInput(input),
    orderBy: [{ dueDate: "asc" }, { lastSyncedAt: "desc" }],
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function countImportedInvoicesForUser(input: {
  userId: string;
  search?: string;
  status?: InvoiceStatus | "ALL";
  overdueOnly?: boolean;
}) {
  return prisma.importedInvoice.count({
    where: buildImportedInvoiceWhereInput(input),
  });
}

export async function getImportedInvoiceForUser(input: {
  userId: string;
  importedInvoiceId: string;
}) {
  return prisma.importedInvoice.findFirst({
    where: {
      id: input.importedInvoiceId,
      userId: input.userId,
    },
    include: {
      documentLinks: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getLatestSyncRun(connectionId: string) {
  return prisma.syncRun.findFirst({
    where: {
      connectionId,
      provider: Provider.QUICKBOOKS,
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}
