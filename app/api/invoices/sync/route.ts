import { syncRequestSchema } from "@/lib/invoices/schemas";
import { runConfiguredInvoiceSync } from "@/lib/invoices/scheduled-sync";
import { isAuthorizedSyncRequest } from "@/lib/security/sync-auth";
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
  const cronAuthorized = isAuthorizedSyncRequest(request);

  try {
    const user = cronAuthorized ? null : await requireApiUser();
    await guardApiMutation(request, {
      skipOriginCheck: cronAuthorized,
      skipCsrfCheck: cronAuthorized,
      rateLimit: {
        key: `sync:${user?.id ?? requestContext.ip}`,
        limit: cronAuthorized ? 120 : 20,
        windowMs: 60_000,
      },
    });

    const contentType = request.headers.get("content-type") ?? "";
    const parsedBody = contentType.includes("application/json")
      ? await parseJsonBody(request, syncRequestSchema)
      : {};

    const execution = await runConfiguredInvoiceSync({
      connectionId: parsedBody.connectionId,
      userId: user?.id ?? parsedBody.userId,
      force: parsedBody.force,
      trigger: user ? "USER" : "CRON",
    });

    return jsonNoStore({
      ok: true,
      ...execution,
    });
  } catch (error) {
    return handleApiError(
      "quickbooks.sync_endpoint_failed",
      error,
      requestContext,
    );
  }
}
