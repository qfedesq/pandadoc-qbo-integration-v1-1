import { FactoringTransactionStatus } from "@prisma/client";
import Link from "next/link";

import { QueryPagination } from "@/components/query-pagination";
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
  countFactoringTransactionsForUser,
  listFactoringTransactionsForUser,
  sumFactoringNetProceedsForUser,
} from "@/lib/db/factoring";
import { formatAdvanceRate } from "@/lib/factoring/offers";
import { transactionListSearchParamsSchema } from "@/lib/factoring/schemas";
import { parseSearchParams } from "@/lib/server/http";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatSettlementMethod(value: string) {
  return value.replace(/_/g, " ");
}

export default async function TransactionsPage({ searchParams }: Props) {
  const user = await requireUser();
  const query = parseSearchParams(
    (await searchParams) ?? {},
    transactionListSearchParamsSchema,
  );
  const activeStatuses = [
    FactoringTransactionStatus.PENDING,
    FactoringTransactionStatus.FUNDED,
  ];
  const [transactions, totalTransactions, activeCount, totalCapitalReceived] =
    await Promise.all([
      listFactoringTransactionsForUser({
        userId: user.id,
        page: query.page,
      }),
      countFactoringTransactionsForUser({
        userId: user.id,
      }),
      countFactoringTransactionsForUser({
        userId: user.id,
        statuses: activeStatuses,
      }),
      sumFactoringNetProceedsForUser(user.id),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Seller view
          </p>
          <h1 className="text-4xl font-[var(--font-heading)] font-semibold tracking-tight">
            Transaction history
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Monitor every capital advance from withdrawal through repayment,
            with the exact terms, timing, and settlement details preserved.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/factoring-dashboard">Back to seller dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Total advances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-foreground">
              {totalTransactions}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Active advances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-foreground">
              {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Capital received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(totalCapitalReceived.toString(), "USDC")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Capital advances</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
              No capital advances exist yet.
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
                        <div>
                          {transaction.importedInvoice.providerInvoiceId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.importedInvoice.counterpartyName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={transaction.status} />
                      </TableCell>
                      <TableCell>
                        <div>
                          {formatAdvanceRate(transaction.advanceRateBps)}
                        </div>
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
                      <TableCell>
                        {formatDate(transaction.maturityDate)}
                      </TableCell>
                      <TableCell>
                        <div>
                          {formatSettlementMethod(transaction.settlementMethod)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.settlementDestinationMasked}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/factoring-dashboard/transactions/${transaction.id}`}
                          >
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

      <QueryPagination
        pathname="/transactions"
        page={query.page}
        pageSize={20}
        totalItems={totalTransactions}
        searchParams={{}}
        label="transactions"
      />
    </div>
  );
}
