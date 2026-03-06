import {
  FactoringTransactionStatus,
  InvoiceStatus,
  LedgerOwnerType,
  Provider,
} from "@prisma/client";
import Link from "next/link";

import { FactoringConnectionCard } from "@/components/factoring-connection-card";
import { InvoiceFilters } from "@/components/invoice-filters";
import { FactoringSetupGuide } from "@/components/factoring-setup-guide";
import { InvoiceTable } from "@/components/invoice-table";
import { RecentFactoringTransactions } from "@/components/recent-factoring-transactions";
import { SyncButton } from "@/components/sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import {
  countFactoringTransactionsByStatus,
  getOrCreateManagedCapitalSource,
  getWalletBalance,
  listFactoringInvoicesForUser,
  listRecentFactoringTransactionsForUser,
} from "@/lib/db/factoring";
import { findUserConnection } from "@/lib/db/integrations";
import { getLatestSyncRun } from "@/lib/db/invoices";
import { hasPandaDocImportConfig } from "@/lib/env";
import { evaluateFactoringEligibility } from "@/lib/factoring/eligibility";
import {
  getInvoiceSyncConfiguration,
  getNextInvoiceSyncAt,
} from "@/lib/invoices/schedule";
import {
  getProviderOauthConfigurationMessage,
  isProviderOauthConfigured,
} from "@/lib/providers/configuration";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type SearchParams = {
  q?: string;
  status?: string;
  overdue?: string;
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

function isInvoiceStatus(value?: string): value is InvoiceStatus {
  return Boolean(value && Object.values(InvoiceStatus).includes(value as InvoiceStatus));
}

export default async function FactoringDashboardPage({ searchParams }: Props) {
  const user = await requireUser();
  const query = (await searchParams) ?? {};
  const [pandaDocConnection, quickBooksConnection] = await Promise.all([
    findUserConnection(user.id, Provider.PANDADOC),
    findUserConnection(user.id, Provider.QUICKBOOKS),
  ]);
  const [
    invoices,
    recentTransactions,
    activeTransactionsCount,
    capitalSource,
    sellerWalletBalance,
  ] =
    await Promise.all([
      listFactoringInvoicesForUser({
        userId: user.id,
        search: query.q,
        status: isInvoiceStatus(query.status) ? query.status : "ALL",
        overdueOnly: query.overdue === "true",
      }),
      listRecentFactoringTransactionsForUser(user.id, 6),
      countFactoringTransactionsByStatus({
        userId: user.id,
        statuses: [
          FactoringTransactionStatus.PENDING,
          FactoringTransactionStatus.FUNDED,
        ],
      }),
      getOrCreateManagedCapitalSource(),
      getWalletBalance({
        ownerType: LedgerOwnerType.SELLER,
        ownerId: user.id,
        currency: "USDC",
      }),
    ]);
  const latestSync = quickBooksConnection
    ? await getLatestSyncRun(quickBooksConnection.id)
    : null;
  const syncConfig = getInvoiceSyncConfiguration();
  const quickBooksConnected = quickBooksConnection?.status === "CONNECTED";
  const pandaDocConnected = pandaDocConnection?.status === "CONNECTED";
  const pandaDocImportEnabled = hasPandaDocImportConfig();
  const pandaDocConfigured = isProviderOauthConfigured(Provider.PANDADOC);
  const quickBooksConfigured = isProviderOauthConfigured(Provider.QUICKBOOKS);
  const nextScheduledSyncAt =
    quickBooksConnection && quickBooksConnected
      ? getNextInvoiceSyncAt(quickBooksConnection.lastSyncAt)
      : null;
  const eligibleInvoicesCount = invoices.filter((invoice) =>
    evaluateFactoringEligibility({
      balanceAmount: invoice.balanceAmount,
      dueDate: invoice.dueDate,
      normalizedStatus: invoice.normalizedStatus,
      transactions: invoice.factoringTransactions,
    }).eligible,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            PandaDoc factoring
          </p>
          <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
            PandaDoc Factoring Dashboard
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Embedded invoice factoring for PandaDoc. Connect QuickBooks, import
            outstanding receivables, withdraw capital from the managed Arena
            StaFi-ready pool, and track each transaction from pending to repaid.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/integrations">Manage integrations</Link>
          </Button>
          <SyncButton
            disabled={!quickBooksConnected}
            payload={
              quickBooksConnection
                ? { connectionId: quickBooksConnection.id, force: true }
                : undefined
            }
          />
        </div>
      </div>

      <FactoringSetupGuide
        pandaDocConnection={pandaDocConnection}
        quickBooksConnection={quickBooksConnection}
        pandaDocConfigured={pandaDocConfigured}
        quickBooksConfigured={quickBooksConfigured}
        providerMessages={{
          pandaDoc: getProviderOauthConfigurationMessage(Provider.PANDADOC),
          quickBooks: getProviderOauthConfigurationMessage(Provider.QUICKBOOKS),
        }}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <FactoringConnectionCard
          provider={Provider.PANDADOC}
          label="PandaDoc account"
          description="Workspace identity used for future document and webhook-driven factoring workflows."
          connection={pandaDocConnection}
          metadataLabel="Workspace / account ID"
          metadataValue={pandaDocConnection?.externalAccountId ?? "—"}
          providerConfigured={pandaDocConfigured}
          configurationMessage={getProviderOauthConfigurationMessage(Provider.PANDADOC)}
        />
        <FactoringConnectionCard
          provider={Provider.QUICKBOOKS}
          label="QuickBooks company"
          description="Source company for invoice import, outstanding balance checks, and payment-state refresh."
          connection={quickBooksConnection}
          metadataLabel="Realm ID"
          metadataValue={quickBooksConnection?.externalAccountId ?? "—"}
          providerConfigured={quickBooksConfigured}
          configurationMessage={getProviderOauthConfigurationMessage(Provider.QUICKBOOKS)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Eligible invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-4xl font-semibold text-foreground">
              {eligibleInvoicesCount}
            </div>
            <p>
              Open or partially paid invoices with positive balance and a valid due
              date can enter the Tier 1 managed pool.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Seller wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(sellerWalletBalance.toString(), "USDC")}
            </div>
            <p>
              Demo balance credited whenever capital is disbursed against an
              invoice.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Active positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-4xl font-semibold text-foreground">
              {activeTransactionsCount}
            </div>
            <p>
              Funded positions stay visible here until repayment is simulated or
              the position defaults.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Pool available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(capitalSource.availableLiquidity.toString(), "USDC")}
            </div>
            <p>Deployable liquidity remaining in the managed capital pool.</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Accrued yield</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(capitalSource.accruedYield.toString(), "USDC")}
            </div>
            <p>Yield already realized by the pool across repaid positions.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Sync operations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
              Periodic sync
            </span>
            <span className="mt-1 block font-medium text-foreground">
              {syncConfig.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
              Interval
            </span>
            <span className="mt-1 block font-medium text-foreground">
              Every {syncConfig.intervalMinutes} minute(s)
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
              Last sync
            </span>
            <span className="mt-1 block font-medium text-foreground">
              {formatDateTime(quickBooksConnection?.lastSyncAt)}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
              Next scheduled sync
            </span>
            <span className="mt-1 block font-medium text-foreground">
              {quickBooksConnected
                ? formatDateTime(nextScheduledSyncAt)
                : "Connect QuickBooks first"}
            </span>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
              Latest run
            </span>
            <span className="mt-1 block font-medium text-foreground">
              {latestSync
                ? `${latestSync.status} at ${formatDateTime(latestSync.startedAt)}`
                : "No sync runs recorded yet"}
            </span>
          </div>
        </CardContent>
      </Card>

      <InvoiceFilters
        overdueOnly={query.overdue === "true"}
        search={query.q}
        status={query.status}
      />

      <InvoiceTable
        invoices={invoices}
        pandaDocConnected={pandaDocConnected}
        pandaDocImportEnabled={pandaDocImportEnabled}
      />

      <RecentFactoringTransactions transactions={recentTransactions} />
    </div>
  );
}
