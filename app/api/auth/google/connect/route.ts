import { NextResponse } from "next/server";
import { AuthIdentityProvider } from "@prisma/client";

import { createAuthLoginState } from "@/lib/db/auth";
import { logger } from "@/lib/logging/logger";
import { buildGoogleAuthorizationUrl } from "@/lib/providers/google/oauth";
import { sanitizeInternalRedirectPath } from "@/lib/security/internal-redirect";
import { getRequestContext, guardApiMutation } from "@/lib/server/http";
import { getPublicError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    await guardApiMutation(request, {
      rateLimit: {
        key: `auth:google:connect:${requestContext.ip}`,
        limit: 20,
        windowMs: 60_000,
      },
    });

    const formData = await request.formData();
    const redirectTo = sanitizeInternalRedirectPath(
      formData.get("redirectTo"),
      "/factoring-dashboard",
    );

    const authState = await createAuthLoginState({
      provider: AuthIdentityProvider.GOOGLE,
      redirectTo,
    });

    return NextResponse.redirect(
      buildGoogleAuthorizationUrl(authState.state),
      303,
    );
  } catch (error) {
    logger.error("google.connect_failed", { ...requestContext, error });
    const publicError = getPublicError(error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(publicError.message)}`,
        request.url,
      ),
      303,
    );
  }
}
