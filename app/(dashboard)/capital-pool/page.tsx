import {
  FactoringTransactionStatus,
  LedgerOwnerType,
  UserRole,
} from "@prisma/client";
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
import { requireUserRole } from "@/lib/auth/require-user";
import {
  getOrCreateManagedCapitalSource,
  getWalletBalance,
  listFactoringTransactionsForCapitalSource,
  listPoolTransactions,
} from "@/lib/db/factoring";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function CapitalPoolPage() {
  await requireUserRole([UserRole.OPERATOR, UserRole.ADMIN]);
  const capitalSource = await getOrCreateManagedCapitalSource();
  const [
    activePositions,
    poolTransactions,
    poolWalletBalance,
    operatorBalance,
  ] = await Promise.all([
    listFactoringTransactionsForCapitalSource({
      capitalSourceId: capitalSource.id,
      statuses: [FactoringTransactionStatus.FUNDED],
      take: 20,
    }),
    listPoolTransactions({
      capitalSourceId: capitalSource.id,
      take: 12,
    }),
    getWalletBalance({
      ownerType: LedgerOwnerType.POOL,
      ownerId: capitalSource.id,
      currency: "USDC",
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
            Capital provider view
          </p>
          <h1 className="text-4xl font-[var(--font-heading)] font-semibold tracking-tight">
            Capital pool dashboard
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Monitor deployed capital, realized yield, and platform fees for the
            managed liquidity pool that powers invoice advances.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/operator">Open operator console</Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Total pool balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(capitalSource.totalLiquidity.toString(), "USDC")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Available liquidity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(
                capitalSource.availableLiquidity.toString(),
                "USDC",
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Deployed capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(
                capitalSource.deployedLiquidity.toString(),
                "USDC",
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Accrued yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatCurrency(capitalSource.accruedYield.toString(), "USDC")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Platform fees</CardTitle>
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
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Wallet balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              Pool wallet:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(poolWalletBalance.toString(), "USDC")}
              </span>
            </div>
            <div>
              Operator:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(operatorBalance.toString(), "USDC")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Active funded invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {activePositions.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
              No funded invoices are currently drawing from the pool.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Net deployed</TableHead>
                    <TableHead>Expected repayment</TableHead>
                    <TableHead>Maturity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePositions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium text-foreground">
                        {position.importedInvoice.providerInvoiceId}
                      </TableCell>
                      <TableCell>
                        {position.importedInvoice.counterpartyName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={position.status} />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          position.netProceeds.toString(),
                          "USDC",
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          position.expectedRepaymentAmount.toString(),
                          "USDC",
                        )}
                      </TableCell>
                      <TableCell>{formatDate(position.maturityDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Pool transaction log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Yield</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Linked position</TableHead>
                  <TableHead>Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolTransactions.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.transactionType.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.amount.toString(), "USDC")}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.principalAmount.toString(), "USDC")}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.yieldAmount.toString(), "USDC")}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.feeAmount.toString(), "USDC")}
                    </TableCell>
                    <TableCell>
                      {entry.factoringTransaction?.transactionReference ?? "—"}
                    </TableCell>
                    <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
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
