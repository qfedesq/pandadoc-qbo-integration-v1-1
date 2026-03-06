import { NextResponse } from "next/server";
import { Provider } from "@prisma/client";

import { getCurrentSessionUser } from "@/lib/auth/session";
import {
  createOAuthState,
  upsertPandaDocConnection,
} from "@/lib/db/integrations";
import { isPandaDocMockMode } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { getMockPandaDocMember } from "@/lib/providers/pandadoc/mock";
import { buildPandaDocAuthorizationUrl } from "@/lib/providers/pandadoc/oauth";
import { sanitizeInternalRedirectPath } from "@/lib/security/internal-redirect";
import { getRequestContext, guardApiMutation } from "@/lib/server/http";
import { getPublicError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await guardApiMutation(request, {
      rateLimit: {
        key: `oauth:connect:pandadoc:${requestContext.ip}`,
        limit: 20,
        windowMs: 60_000,
      },
    });

    const formData = await request.formData();
    const redirectTo = sanitizeInternalRedirectPath(
      formData.get("redirectTo"),
      "/integrations",
    );

    if (isPandaDocMockMode()) {
      const member = getMockPandaDocMember();
      await upsertPandaDocConnection({
        userId: user.id,
        accountId:
          member.user_id ?? member.membership_id ?? member.id ?? "pd_user_demo",
        displayName: [member.first_name, member.last_name]
          .filter(Boolean)
          .join(" "),
        accountName:
          member.workspace_name ?? member.email ?? "PandaDoc Demo Workspace",
        metadata: {
          mode: "mock",
          provider: "pandadoc-demo-adapter",
          email: member.email ?? null,
          workspaceId: member.workspace_id ?? null,
          workspaceName: member.workspace_name ?? null,
          connectedAt: new Date().toISOString(),
        },
        tokens: {
          accessToken: "pandadoc-mock-access-token",
          refreshToken: "pandadoc-mock-refresh-token",
          expiresInSeconds: 60 * 60 * 24 * 365,
          refreshTokenExpiresInSeconds: 60 * 60 * 24 * 365,
          tokenType: "Bearer",
          scope: "read write",
        },
      });

      return NextResponse.redirect(
        new URL(
          `${redirectTo}?notice=${encodeURIComponent("Connected PandaDoc demo workspace.")}`,
          request.url,
        ),
        303,
      );
    }

    const oauthState = await createOAuthState({
      userId: user.id,
      provider: Provider.PANDADOC,
      redirectTo,
    });

    return NextResponse.redirect(
      buildPandaDocAuthorizationUrl(oauthState.state),
      303,
    );
  } catch (error) {
    logger.error("pandadoc.connect_failed", { ...requestContext, error });
    const publicError = getPublicError(error);
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent(publicError.message)}`,
        request.url,
      ),
      303,
    );
  }
}
