import { InvoiceStatus, Provider } from "@prisma/client";
import Link from "next/link";

import { FactoringConnectionCard } from "@/components/factoring-connection-card";
import { InvoiceFilters } from "@/components/invoice-filters";
import { FactoringSetupGuide } from "@/components/factoring-setup-guide";
import { InvoiceTable } from "@/components/invoice-table";
import { SyncButton } from "@/components/sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { listInvoicesWithDocumentLinksForUser } from "@/lib/db/document-links";
import { findUserConnection } from "@/lib/db/integrations";
import { getLatestSyncRun } from "@/lib/db/invoices";
import { hasPandaDocImportConfig } from "@/lib/env";
import {
  getInvoiceSyncConfiguration,
  getNextInvoiceSyncAt,
} from "@/lib/invoices/schedule";
import {
  getProviderOauthConfigurationMessage,
  isProviderOauthConfigured,
} from "@/lib/providers/configuration";
import { formatDateTime } from "@/lib/utils";

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
  const invoices = await listInvoicesWithDocumentLinksForUser({
    userId: user.id,
    search: query.q,
    status: isInvoiceStatus(query.status) ? query.status : "ALL",
    overdueOnly: query.overdue === "true",
  });
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
            Imported QuickBooks outstanding invoices are normalized here for PandaDoc-side factoring and future document workflows.
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
    </div>
  );
}
