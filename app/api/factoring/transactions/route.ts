import { createFactoringTransactionSchema } from "@/lib/factoring/schemas";
import { createFactoringTransactionForUser } from "@/lib/factoring/transactions";
import {
  getRequestContext,
  guardApiMutation,
  handleApiError,
  jsonNoStore,
  parseJsonBody,
  requireApiUser,
} from "@/lib/server/http";

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    const user = await requireApiUser();
    await guardApiMutation(request, {
      rateLimit: {
        key: `factoring:create:${user.id}:${requestContext.ip}`,
        limit: 20,
        windowMs: 60_000,
      },
    });

    const payload = await parseJsonBody(request, createFactoringTransactionSchema);
    const result = await createFactoringTransactionForUser({
      userId: user.id,
      importedInvoiceId: payload.importedInvoiceId,
      settlementMethod: payload.settlementMethod,
      acceptTerms: payload.acceptTerms,
      walletAddress: payload.walletAddress,
      bankAccountLabel: payload.bankAccountLabel,
      debitCardLabel: payload.debitCardLabel,
    });

    return jsonNoStore({
      ok: true,
      created: result.created,
      redirectTo: `/factoring-dashboard/transactions/${result.transaction.id}`,
      transaction: {
        id: result.transaction.id,
        transactionReference: result.transaction.transactionReference,
        status: result.transaction.status,
      },
    });
  } catch (error) {
    return handleApiError("factoring.create_transaction_failed", error, requestContext);
  }
}
