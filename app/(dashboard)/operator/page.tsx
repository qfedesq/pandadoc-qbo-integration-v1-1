import {
  FactoringTransactionStatus,
  LedgerOwnerType,
} from "@prisma/client";
import Link from "next/link";

import { FactoringTransactionActions } from "@/components/factoring-transaction-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/require-user";
import {
  getOrCreateManagedCapitalSource,
  getWalletBalance,
  listFactoringEventsForUser,
  listFactoringTransactionsForUser,
} from "@/lib/db/factoring";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function OperatorPage() {
  const user = await requireUser();
  const capitalSource = await getOrCreateManagedCapitalSource();
  const [positions, auditEvents, operatorBalance] = await Promise.all([
    listFactoringTransactionsForUser({
      userId: user.id,
      statuses: [FactoringTransactionStatus.PENDING, FactoringTransactionStatus.FUNDED],
    }),
    listFactoringEventsForUser({
      userId: user.id,
      take: 12,
    }),
    getWalletBalance({
      ownerType: LedgerOwnerType.OPERATOR,
      ownerId: capitalSource.operatorWallet ?? "protofire-operator",
      currency: "USDC",
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Operator console
          </p>
          <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
            Admin and repayment controls
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Simulate repayment, inspect audit history, and confirm that protocol
            fees are accruing correctly for the marketplace operator.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/capital-pool">Pool dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/transactions">All transactions</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Pending operator actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-foreground">{positions.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Operator fee wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(operatorBalance.toString(), "USDC")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Pool protocol fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(
                capitalSource.protocolFeesCollected.toString(),
                "USDC",
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Open positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
              No pending or funded positions require operator action.
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-foreground">
                          {position.transactionReference}
                        </p>
                        <StatusBadge status={position.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Invoice {position.importedInvoice.providerInvoiceId} ·{" "}
                        {position.importedInvoice.counterpartyName} · net proceeds{" "}
                        {formatCurrency(position.netProceeds.toString(), "USDC")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/factoring-dashboard/transactions/${position.id}`}>
                          Open detail
                        </Link>
                      </Button>
                      <FactoringTransactionActions
                        transactionId={position.id}
                        status={position.status}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Recent audit events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{event.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {event.eventType.replace(/_/g, " ")}
                      </div>
                    </TableCell>
                    <TableCell>{event.importedInvoice.providerInvoiceId}</TableCell>
                    <TableCell>
                      {event.factoringTransaction?.transactionReference ?? "—"}
                    </TableCell>
                    <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
