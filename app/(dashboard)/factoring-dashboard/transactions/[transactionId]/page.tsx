import { notFound } from "next/navigation";
import Link from "next/link";

import { FactoringTransactionActions } from "@/components/factoring-transaction-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getFactoringTransactionForUser } from "@/lib/db/factoring";
import { formatAdvanceRate, formatDiscountRate } from "@/lib/factoring/offers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type Props = {
  params: Promise<{
    transactionId: string;
  }>;
};

function formatSettlementMethod(value: string) {
  return value.replace(/_/g, " ");
}

export default async function FactoringTransactionPage({ params }: Props) {
  const user = await requireUser();
  const { transactionId } = await params;

  const transaction = await getFactoringTransactionForUser({
    userId: user.id,
    transactionId,
  });

  if (!transaction) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Factoring transaction
          </p>
          <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
            {transaction.transactionReference}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Track settlement and repayment for the invoice as it moves through the
            Tier 1 managed pool.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/factoring-dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="border-border/70 shadow-panel xl:col-span-1">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <StatusBadge status={transaction.status} />
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                On-chain execution
              </span>
              <span className="mt-2 block">
                <StatusBadge status={transaction.onChainExecutionStatus} />
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel xl:col-span-1">
          <CardHeader>
            <CardTitle>Settlement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {formatSettlementMethod(transaction.settlementMethod)}
            </p>
            <p>{transaction.settlementDestinationMasked}</p>
            <p>{transaction.settlementTimeLabel}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel xl:col-span-1">
          <CardHeader>
            <CardTitle>Economics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Invoice balance:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(
                  transaction.grossAmount.toString(),
                  transaction.invoiceCurrency ?? "USD",
                )}
              </span>
            </p>
            <p>
              Advance rate:{" "}
              <span className="font-medium text-foreground">
                {formatAdvanceRate(transaction.advanceRateBps)}
              </span>
            </p>
            <p>
              Advance amount:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(
                  transaction.advanceAmount.toString(),
                  transaction.settlementCurrency,
                )}
              </span>
            </p>
            <p>
              Discount fee:{" "}
              <span className="font-medium text-foreground">
                {formatDiscountRate(transaction.discountRateBps)} ·{" "}
                {formatCurrency(
                  transaction.discountAmount.toString(),
                  transaction.settlementCurrency,
                )}
              </span>
            </p>
            <p>
              Protocol fee:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(
                  transaction.operatorFeeAmount.toString(),
                  transaction.settlementCurrency,
                )}
              </span>
            </p>
            <p>
              Net proceeds:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(
                  transaction.netProceeds.toString(),
                  transaction.settlementCurrency,
                )}
              </span>
            </p>
            <p>
              Expected repayment:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(
                  transaction.expectedRepaymentAmount.toString(),
                  transaction.settlementCurrency,
                )}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel xl:col-span-1">
          <CardHeader>
            <CardTitle>Capital source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{transaction.capitalSource.name}</p>
            <p>{transaction.capitalSource.network}</p>
            <p>
              Operator wallet: {transaction.operatorWallet ?? "Not available"}
            </p>
            <p>
              Settlement ref: {transaction.arenaSettlementReference ?? "Not issued"}
            </p>
            <p>Risk tier: {transaction.riskTier}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Invoice context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Invoice ID
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {transaction.importedInvoice.providerInvoiceId}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Counterparty
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {transaction.importedInvoice.counterpartyName}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Maturity
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatDate(transaction.maturityDate ?? transaction.importedInvoice.dueDate)}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Terms accepted
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatDateTime(transaction.termsAcceptedAt)}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Funded at
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatDateTime(transaction.fundedAt)}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Repaid at
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatDateTime(transaction.repaidAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Demo operator actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Tier 1 uses simulated Arena StaFi execution. Use the demo controls
              below to advance the transaction lifecycle for review purposes.
            </p>
            <FactoringTransactionActions
              transactionId={transaction.id}
              status={transaction.status}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Ledger movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transaction.walletLedgers.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border p-4 text-sm text-muted-foreground">
                No wallet ledger entries have been booked yet.
              </div>
            ) : (
              transaction.walletLedgers.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {entry.description}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {entry.ownerType.replace(/_/g, " ")} · {entry.entryType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {entry.direction === "CREDIT" ? "+" : "-"}
                        {formatCurrency(entry.amount.toString(), entry.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance after {formatCurrency(entry.balanceAfter.toString(), entry.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transaction.events.map((event) => (
              <div
                key={event.id}
                className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{event.message}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {event.eventType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </div>
                </div>
                {(event.statusFrom || event.statusTo) ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {event.statusFrom ? <StatusBadge status={event.statusFrom} /> : null}
                    {event.statusTo ? <StatusBadge status={event.statusTo} /> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
