import { notFound } from "next/navigation";
import Link from "next/link";

import { FactoringTransactionForm } from "@/components/factoring-transaction-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { ensureFactoringOfferForUser } from "@/lib/factoring/transactions";
import { formatAdvanceRate, formatDiscountRate } from "@/lib/factoring/offers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { AppError } from "@/lib/utils/errors";

type Props = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export default async function WithdrawCapitalPage({ params }: Props) {
  const user = await requireUser();
  const { invoiceId } = await params;

  let result: Awaited<ReturnType<typeof ensureFactoringOfferForUser>>;

  try {
    result = await ensureFactoringOfferForUser({
      userId: user.id,
      importedInvoiceId: invoiceId,
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  const { invoice, capitalSource, calculated } = result;
  const activeTransaction =
    invoice.factoringTransactions.find(
      (transaction) =>
        transaction.status === "PENDING" || transaction.status === "FUNDED",
    ) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Withdraw capital
          </p>
          <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight">
            Invoice {invoice.providerInvoiceId}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Review the indicative terms, choose a settlement method, and confirm
            the Tier 1 factoring transaction.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/factoring-dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Invoice snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Counterparty
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {invoice.counterpartyName}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Invoice status
              </span>
              <span className="mt-1 block">
                <StatusBadge status={invoice.normalizedStatus} />
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Outstanding balance
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatCurrency(invoice.balanceAmount.toString(), invoice.currency ?? "USD")}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]">
                Due date
              </span>
              <span className="mt-1 block font-medium text-foreground">
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Managed pool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">{capitalSource.name}</div>
            <p>
              Network: {capitalSource.network} · Settlement currency:{" "}
              {capitalSource.currency}
            </p>
            <p>
              Operator wallet: {capitalSource.operatorWallet ?? "Not configured"}
            </p>
            <p>
              Liquidity snapshot: {capitalSource.liquiditySnapshot?.toString() ?? "0"}{" "}
              {capitalSource.currency}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Indicative terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Available now
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatCurrency(calculated.netProceeds, calculated.settlementCurrency)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Advance rate
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatAdvanceRate(calculated.advanceRateBps)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Risk tier
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {calculated.riskTier}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Advance amount
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(calculated.advanceAmount, calculated.settlementCurrency)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Discount fee
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatDiscountRate(calculated.discountRateBps)} ·{" "}
                  {formatCurrency(calculated.discountAmount, calculated.settlementCurrency)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Protocol fee
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(calculated.operatorFeeAmount, calculated.settlementCurrency)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Expected repayment
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(
                    calculated.expectedRepaymentAmount,
                    calculated.settlementCurrency,
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Settlement window
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {calculated.settlementTimeSummary}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Expected maturity
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatDate(calculated.expectedMaturityDate)}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Estimated term
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {calculated.expectedTermDays ?? "—"} days
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {calculated.settlementOptions.map((option) => (
                <div
                  key={option.method}
                  className="rounded-[1.25rem] border border-border/70 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <StatusBadge status="ELIGIBLE" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {option.settlementTimeLabel}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-panel">
          <CardHeader>
            <CardTitle>Confirm transaction</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTransaction ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This invoice already has an active factoring position in the pool.
                </p>
                <Button asChild>
                  <Link href={`/factoring-dashboard/transactions/${activeTransaction.id}`}>
                    View transaction
                  </Link>
                </Button>
              </div>
            ) : !calculated.eligibility.eligible ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <StatusBadge status={calculated.eligibility.status} />
                <p>{calculated.eligibility.reason}</p>
                <Button asChild variant="outline">
                  <Link href="/factoring-dashboard">Return to dashboard</Link>
                </Button>
              </div>
            ) : (
              <FactoringTransactionForm
                importedInvoiceId={invoice.id}
                settlementOptions={calculated.settlementOptions}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-panel">
        <CardHeader>
          <CardTitle>Offer notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {calculated.termsSnapshot.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <p>
            Offer refreshed at {formatDateTime(result.offer.generatedAt)} from the demo
            managed pool.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
