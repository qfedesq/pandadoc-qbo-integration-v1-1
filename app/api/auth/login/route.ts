import { loginSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/passwords";
import { prisma } from "@/lib/db/prisma";
import { assertSecureAdminConfiguration } from "@/lib/env";
import { sanitizeInternalRedirectPath } from "@/lib/security/internal-redirect";
import {
  getRequestContext,
  guardApiMutation,
  handleApiError,
  jsonNoStore,
  parseJsonBody,
} from "@/lib/server/http";

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    assertSecureAdminConfiguration();
    await guardApiMutation(request, {
      rateLimit: {
        key: `auth:login:${requestContext.ip}`,
        limit: 10,
        windowMs: 60_000,
      },
    });

    const payload = await parseJsonBody(request, loginSchema);
    const user = await prisma.user.findUnique({
      where: {
        email: payload.email.toLowerCase(),
      },
    });

    if (!user) {
      return jsonNoStore(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const passwordIsValid = await verifyPassword(
      payload.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      return jsonNoStore(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await createSession(user.id);
    const redirectTo = sanitizeInternalRedirectPath(
      payload.redirectTo,
      "/factoring-dashboard",
    );

    return jsonNoStore({
      ok: true,
      redirectTo,
    });
  } catch (error) {
    return handleApiError("auth.login_failed", error, requestContext);
  }
}
