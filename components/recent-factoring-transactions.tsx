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
import type { FactoringTransactionWithRelations } from "@/lib/db/factoring";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function formatSettlementMethod(value: string) {
  return value.replace(/_/g, " ");
}

export function RecentFactoringTransactions({
  transactions,
}: {
  transactions: FactoringTransactionWithRelations[];
}) {
  return (
    <Card className="border-border/70 shadow-panel">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Recent factoring positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track each funded invoice from seller disbursement to pool repayment.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
            No factoring transactions yet. Withdraw capital on an eligible invoice to
            create the first one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Settlement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Net proceeds</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium text-foreground">
                      {transaction.transactionReference}
                    </TableCell>
                    <TableCell>
                      <div>{transaction.importedInvoice.providerInvoiceId}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.importedInvoice.counterpartyName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{formatSettlementMethod(transaction.settlementMethod)}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.settlementDestinationMasked}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={transaction.status} />
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        transaction.netProceeds.toString(),
                        transaction.settlementCurrency,
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
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
  );
}
