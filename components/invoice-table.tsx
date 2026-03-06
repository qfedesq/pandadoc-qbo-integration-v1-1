import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { WithdrawCapitalButton } from "@/components/withdraw-capital-button";
import { ImportToPandaDocButton } from "@/components/import-to-pandadoc-button";
import { PandaDocStatusBadge } from "@/components/pandadoc-status-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { evaluateFactoringEligibility } from "@/lib/factoring/eligibility";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type FactoringInvoiceRow = Prisma.ImportedInvoiceGetPayload<{
  include: {
    documentLinks: true;
    factoringOffer: true;
    factoringTransactions: {
      include: {
        capitalSource: true;
      };
    };
  };
}>;

export function InvoiceTable({
  invoices,
  pandaDocConnected = false,
  pandaDocImportEnabled = false,
}: {
  invoices: FactoringInvoiceRow[];
  pandaDocConnected?: boolean;
  pandaDocImportEnabled?: boolean;
}) {
  if (invoices.length === 0) {
    return (
      <div className="protofire-panel rounded-[1.5rem] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No invoices match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/70 protofire-panel shadow-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Factoring</TableHead>
            <TableHead>PandaDoc</TableHead>
            <TableHead>Last synced</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const link = invoice.documentLinks[0] ?? null;
            const latestTransaction = invoice.factoringTransactions[0] ?? null;
            const eligibility = evaluateFactoringEligibility({
              balanceAmount: invoice.balanceAmount,
              dueDate: invoice.dueDate,
              normalizedStatus: invoice.normalizedStatus,
              transactions: invoice.factoringTransactions,
            });
            const disabledReason = !pandaDocConnected
              ? "Connect PandaDoc first."
              : !pandaDocImportEnabled
                ? "Configure the PandaDoc import template first."
                : !invoice.counterpartyEmail
                  ? "QuickBooks invoice has no payer email."
                  : null;

            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{invoice.providerInvoiceId}</div>
                  <div className="text-xs text-muted-foreground">{invoice.docNumber ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div>{invoice.counterpartyName}</div>
                  <div className="text-xs text-muted-foreground">
                    {invoice.counterpartyEmail ?? "No payer email"}
                  </div>
                </TableCell>
                <TableCell>
                  {formatCurrency(invoice.balanceAmount.toString(), invoice.currency ?? "USD")}
                </TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell>
                  <StatusBadge status={invoice.normalizedStatus} />
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <StatusBadge status={invoice.factoringLifecycleStatus} />
                    {latestTransaction ? (
                      <>
                        <StatusBadge status={latestTransaction.status} />
                        <div className="max-w-56 text-xs text-muted-foreground">
                          {latestTransaction.transactionReference}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Net{" "}
                          {formatCurrency(
                            latestTransaction.netProceeds.toString(),
                            latestTransaction.settlementCurrency,
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Repays{" "}
                          {formatCurrency(
                            latestTransaction.expectedRepaymentAmount.toString(),
                            latestTransaction.settlementCurrency,
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <StatusBadge status={eligibility.status} />
                        <div className="text-xs text-muted-foreground">
                          {invoice.factoringOffer
                            ? `Indicative net ${formatCurrency(
                                invoice.factoringOffer.netProceeds.toString(),
                                invoice.factoringOffer.settlementCurrency,
                              )}`
                            : "No terms generated yet"}
                        </div>
                        {invoice.factoringOffer ? (
                          <div className="text-xs text-muted-foreground">
                            Advance {(invoice.factoringOffer.advanceRateBps / 100).toFixed(2)}%
                          </div>
                        ) : null}
                        {eligibility.reason ? (
                          <div className="max-w-56 text-xs text-muted-foreground">
                            {eligibility.reason}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Discount{" "}
                            {invoice.factoringOffer
                              ? `${(invoice.factoringOffer.discountRateBps / 100).toFixed(2)}%`
                              : "TBD"}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <PandaDocStatusBadge status={link?.pandadocDocumentStatus} />
                    {link?.documentName ? (
                      <div className="max-w-48 text-xs text-muted-foreground">
                        {link.documentName}
                      </div>
                    ) : null}
                    {link?.lastError ? (
                      <div className="max-w-56 text-xs text-rose-700">{link.lastError}</div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(invoice.lastSyncedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2">
                    {latestTransaction ? (
                      <Link
                        className="inline-flex h-10 items-center justify-center rounded-full border border-white/14 bg-white/5 px-5 text-sm font-semibold transition-all duration-300 hover:border-white/24 hover:bg-white/10"
                        href={`/factoring-dashboard/transactions/${latestTransaction.id}`}
                      >
                        View transaction
                      </Link>
                    ) : (
                      <WithdrawCapitalButton
                        href={
                          eligibility.eligible
                            ? `/factoring-dashboard/invoices/${invoice.id}/withdraw`
                            : undefined
                        }
                        disabledReason={eligibility.reason}
                      />
                    )}
                    <ImportToPandaDocButton
                      importedInvoiceId={invoice.id}
                      documentStatus={link?.pandadocDocumentStatus}
                      disabledReason={disabledReason}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
