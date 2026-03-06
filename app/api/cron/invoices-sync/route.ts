import { cronSyncQuerySchema } from "@/lib/invoices/schemas";
import { runConfiguredInvoiceSync } from "@/lib/invoices/scheduled-sync";
import { isAuthorizedSyncRequest } from "@/lib/security/sync-auth";
import {
  getRequestContext,
  handleApiError,
  jsonNoStore,
  parseSearchParams,
} from "@/lib/server/http";

export async function GET(request: Request) {
  const requestContext = getRequestContext(request);

  if (!isAuthorizedSyncRequest(request, "vercel-cron")) {
    return jsonNoStore({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const query = parseSearchParams(
      new URL(request.url).searchParams,
      cronSyncQuerySchema,
    );
    const execution = await runConfiguredInvoiceSync({
      connectionId: query.connectionId,
      force: query.force,
      trigger: "CRON",
      userId: query.userId,
    });

    return jsonNoStore({
      ok: true,
      source: "vercel-cron",
      ...execution,
    });
  } catch (error) {
    return handleApiError("quickbooks.vercel_cron_sync_failed", error, requestContext);
  }
}
