import { UserRole } from "@prisma/client";

import { transactionRouteParamsSchema } from "@/lib/factoring/schemas";
import { getOrCreateManagedCapitalSource } from "@/lib/db/factoring";
import { transitionFactoringTransactionForCapitalSource } from "@/lib/factoring/transactions";
import {
  getRequestContext,
  guardApiMutation,
  handleApiError,
  jsonNoStore,
  parseRouteParams,
  requireApiUser,
} from "@/lib/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ transactionId: string }> },
) {
  const requestContext = getRequestContext(request);

  try {
    const user = await requireApiUser({
      roles: [UserRole.OPERATOR, UserRole.ADMIN],
    });
    await guardApiMutation(request, {
      rateLimit: {
        key: `factoring:repay:${user.id}:${requestContext.ip}`,
        limit: 20,
        windowMs: 60_000,
      },
    });

    const params = await parseRouteParams(
      context.params,
      transactionRouteParamsSchema,
    );
    const capitalSource = await getOrCreateManagedCapitalSource();
    const transaction = await transitionFactoringTransactionForCapitalSource({
      userId: user.id,
      capitalSourceId: capitalSource.id,
      transactionId: params.transactionId,
      targetStatus: "REPAID",
    });

    return jsonNoStore({
      ok: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
      },
    });
  } catch (error) {
    return handleApiError(
      "factoring.mark_repaid_failed",
      error,
      requestContext,
    );
  }
}
