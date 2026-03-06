import { Provider } from "@prisma/client";
import { z } from "zod";

import {
  disconnectConnection,
  findUserConnection,
} from "@/lib/db/integrations";
import { logger } from "@/lib/logging/logger";
import { revokeQuickBooksToken } from "@/lib/providers/quickbooks/oauth";
import { decryptSecret } from "@/lib/security/encryption";
import {
  getRequestContext,
  guardApiMutation,
  parseRouteParams,
  redirectNoStore,
  requireApiUser,
} from "@/lib/server/http";
import { getPublicError } from "@/lib/utils/errors";

const providerSchema = z.enum(["pandadoc", "quickbooks"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const requestContext = getRequestContext(request);

  try {
    const user = await requireApiUser();
    await guardApiMutation(request);

    const { provider } = await parseRouteParams(
      context.params,
      z.object({ provider: providerSchema }),
    );
    const normalizedProvider =
      provider === "pandadoc" ? Provider.PANDADOC : Provider.QUICKBOOKS;

    const connection = await findUserConnection(user.id, normalizedProvider);

    if (normalizedProvider === Provider.QUICKBOOKS && connection?.token) {
      try {
        await revokeQuickBooksToken(
          decryptSecret(connection.token.refreshTokenEncrypted),
        );
      } catch (error) {
        logger.warn("quickbooks.revoke_failed", {
          connectionId: connection.id,
          error,
        });
      }
    }

    await disconnectConnection(user.id, normalizedProvider);

    return redirectNoStore(
      new URL("/integrations?notice=Connection%20removed", request.url),
      303,
    );
  } catch (error) {
    logger.error("integrations.disconnect_failed", {
      ...requestContext,
      error,
    });
    const publicError = getPublicError(error);
    return redirectNoStore(
      new URL(
        `/integrations?error=${encodeURIComponent(publicError.message)}`,
        request.url,
      ),
      303,
    );
  }
}
