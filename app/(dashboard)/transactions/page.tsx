import { FactoringTransactionStatus } from "@prisma/client";
import Link from "next/link";

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
import { listFactoringTransactionsForUser } from "@/lib/db/factoring";
import { formatAdvanceRate } from "@/lib/factoring/offers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

function formatSettlementMethod(value: string) {
  return value.replace(/_/g, " ");
}

export default async function TransactionsPage() {
  const user = await requireUser();
  const transactions = await listFactoringTransactionsForUser({
    userId: user.id,
  });
  const activeStatuses = [
    FactoringTransactionStatus.PENDING,
    FactoringTransactionStatus.FUNDED,
  ] as const;

  const activeCount = transactions.filter((transaction) =>
    activeStatuses.includes(transaction.status as (typeof activeStatuses)[number]),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Seller workspace
          </p>
          <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
            Transaction history
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Monitor every factoring position from funding through repayment, with
            the exact terms, timing, and wallet movements preserved.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/factoring-dashboard">Back to seller dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Total positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-foreground">
              {transactions.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Active positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-foreground">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Total disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(
                transactions
                  .reduce((sum, transaction) => sum + Number(transaction.netProceeds), 0)
                  .toFixed(2),
                "USDC",
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Factoring positions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
              No factoring positions exist yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Net proceeds</TableHead>
                    <TableHead>Expected repayment</TableHead>
                    <TableHead>Maturity</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium text-foreground">
                        <div>{transaction.transactionReference}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(transaction.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{transaction.importedInvoice.providerInvoiceId}</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.importedInvoice.counterpartyName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={transaction.status} />
                      </TableCell>
                      <TableCell>
                        <div>{formatAdvanceRate(transaction.advanceRateBps)}</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.riskTier}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          transaction.netProceeds.toString(),
                          transaction.settlementCurrency,
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          transaction.expectedRepaymentAmount.toString(),
                          transaction.settlementCurrency,
                        )}
                      </TableCell>
                      <TableCell>{formatDate(transaction.maturityDate)}</TableCell>
                      <TableCell>
                        <div>{formatSettlementMethod(transaction.settlementMethod)}</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.settlementDestinationMasked}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/factoring-dashboard/transactions/${transaction.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
