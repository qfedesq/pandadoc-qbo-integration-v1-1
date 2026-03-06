import { Provider } from "@prisma/client";
import Link from "next/link";

import { InvoiceFilters } from "@/components/invoice-filters";
import { InvoiceTable } from "@/components/invoice-table";
import { QueryPagination } from "@/components/query-pagination";
import { SyncButton } from "@/components/sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import {
  countEligibleFactoringInvoicesForUser,
  countFactoringInvoicesForUser,
  listFactoringInvoicesForUser,
} from "@/lib/db/factoring";
import { findUserConnection } from "@/lib/db/integrations";
import { hasPandaDocImportConfig } from "@/lib/env";
import { invoiceListSearchParamsSchema } from "@/lib/invoices/schemas";
import { getProviderOauthConfigurationMessage } from "@/lib/providers/configuration";
import { getQuickBooksConnectionDisplayName } from "@/lib/providers/quickbooks/mock";
import { parseSearchParams } from "@/lib/server/http";
import { formatDateTime } from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoicesPage({ searchParams }: Props) {
  const user = await requireUser();
  const query = parseSearchParams(
    (await searchParams) ?? {},
    invoiceListSearchParamsSchema,
  );
  const [quickBooksConnection, pandaDocConnection] = await Promise.all([
    findUserConnection(user.id, Provider.QUICKBOOKS),
    findUserConnection(user.id, Provider.PANDADOC),
  ]);
  const [invoices, totalInvoices, eligibleInvoicesCount] = await Promise.all([
    listFactoringInvoicesForUser({
      userId: user.id,
      search: query.q,
      status: query.status,
      overdueOnly: query.overdue,
      page: query.page,
    }),
    countFactoringInvoicesForUser({
      userId: user.id,
      search: query.q,
      status: query.status,
      overdueOnly: query.overdue,
    }),
    countEligibleFactoringInvoicesForUser(user.id),
  ]);
  const quickBooksAccountName =
    getQuickBooksConnectionDisplayName(quickBooksConnection);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Seller workspace
          </p>
          <h1 className="text-4xl font-[var(--font-heading)] font-semibold tracking-tight">
            Invoice inventory
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Review imported QuickBooks receivables, confirm eligibility, and
            launch a working-capital withdrawal from each invoice row.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/factoring-dashboard">Back to seller dashboard</Link>
          </Button>
          <SyncButton
            disabled={quickBooksConnection?.status !== "CONNECTED"}
            payload={
              quickBooksConnection
                ? { connectionId: quickBooksConnection.id, force: true }
                : undefined
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>QuickBooks company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">
              {quickBooksAccountName ?? "Not connected"}
            </div>
            <p>Last sync: {formatDateTime(quickBooksConnection?.lastSyncAt)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Imported invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-4xl font-semibold text-foreground">
              {totalInvoices}
            </div>
            <p>
              {eligibleInvoicesCount} invoices are immediately eligible for
              withdrawal across the workspace.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>PandaDoc import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">
              {pandaDocConnection?.status === "CONNECTED"
                ? "Connected"
                : "Optional for demo"}
            </div>
            <p>
              {hasPandaDocImportConfig()
                ? "Ready to turn an invoice into a PandaDoc document."
                : getProviderOauthConfigurationMessage(Provider.PANDADOC)}
            </p>
          </CardContent>
        </Card>
      </div>

      <InvoiceFilters
        overdueOnly={query.overdue}
        search={query.q}
        status={query.status}
      />

      <InvoiceTable
        invoices={invoices}
        pandaDocConnected={pandaDocConnection?.status === "CONNECTED"}
        pandaDocImportEnabled={hasPandaDocImportConfig()}
      />

      <QueryPagination
        pathname="/invoices"
        page={query.page}
        pageSize={20}
        totalItems={totalInvoices}
        searchParams={{
          q: query.q,
          status: query.status,
          overdue: query.overdue,
        }}
        label="invoices"
      />
    </div>
  );
}
