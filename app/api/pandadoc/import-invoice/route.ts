import { z } from "zod";

import { importInvoiceToPandaDocForUser } from "@/lib/pandadoc/import-invoice";
import {
  getRequestContext,
  guardApiMutation,
  handleApiError,
  jsonNoStore,
  parseJsonBody,
  requireApiUser,
} from "@/lib/server/http";
import { internalIdSchema } from "@/lib/validation/common";

const importRequestSchema = z
  .object({
    importedInvoiceId: internalIdSchema,
    sendImmediately: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    const user = await requireApiUser();
    await guardApiMutation(request, {
      rateLimit: {
        key: `pandadoc:import:${user.id}:${requestContext.ip}`,
        limit: 30,
        windowMs: 60_000,
      },
    });

    const payload = await parseJsonBody(request, importRequestSchema);
    const result = await importInvoiceToPandaDocForUser({
      userId: user.id,
      importedInvoiceId: payload.importedInvoiceId,
      sendImmediately: payload.sendImmediately,
    });

    return jsonNoStore({
      ok: true,
      created: result.created,
      sendRequested: result.sendRequested,
      sendInitiated: result.sendInitiated,
      link: {
        id: result.link.id,
        pandadocDocumentId: result.link.pandadocDocumentId,
        pandadocDocumentStatus: result.link.pandadocDocumentStatus,
        documentName: result.link.documentName,
        sentAt: result.link.sentAt,
        lastError: result.link.lastError,
      },
    });
  } catch (error) {
    return handleApiError("pandadoc.import_invoice_failed", error, requestContext);
  }
}
