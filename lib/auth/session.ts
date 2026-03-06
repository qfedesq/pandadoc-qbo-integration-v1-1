import { addHours, addMinutes } from "date-fns";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { env, isProduction } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { createOpaqueToken, sha256 } from "@/lib/security/hash";
import { isDatabaseUnavailableError } from "@/lib/utils/errors";

const SESSION_ROTATE_WINDOW_MINUTES = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    priority: "high" as const,
  };
}

export async function createSession(userId: string) {
  const sessionToken = createOpaqueToken();
  const sessionTokenHash = sha256(sessionToken);
  const expiresAt = addHours(new Date(), env.SESSION_TTL_HOURS);

  await prisma.appSession.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(
    env.SESSION_COOKIE_NAME,
    sessionToken,
    buildSessionCookieOptions(expiresAt),
  );

  return {
    sessionToken,
    expiresAt,
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    try {
      await prisma.appSession.deleteMany({
        where: {
          sessionTokenHash: sha256(sessionToken),
        },
      });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }

      logger.warn("auth.session_destroy_unavailable", { error });
    }
  }

  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  let session;

  try {
    session = await prisma.appSession.findFirst({
      where: {
        sessionTokenHash: sha256(sessionToken),
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    logger.warn("auth.session_lookup_unavailable", { error });
    cookieStore.delete(env.SESSION_COOKIE_NAME);
    return null;
  }

  if (!session) {
    cookieStore.delete(env.SESSION_COOKIE_NAME);
    return null;
  }

  if (
    session.expiresAt <= addMinutes(new Date(), SESSION_ROTATE_WINDOW_MINUTES)
  ) {
    const newExpiresAt = addHours(new Date(), env.SESSION_TTL_HOURS);

    try {
      await prisma.appSession.update({
        where: {
          id: session.id,
        },
        data: {
          expiresAt: newExpiresAt,
          lastSeenAt: new Date(),
        },
      });

      cookieStore.set(
        env.SESSION_COOKIE_NAME,
        sessionToken,
        buildSessionCookieOptions(newExpiresAt),
      );
    } catch (error) {
      logger.warn("auth.session_touch_failed", { error });
    }
  } else {
    prisma.appSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch((error) => logger.warn("auth.session_touch_failed", { error }));
  }

  return session.user;
}

export async function cleanupExpiredSessions() {
  return prisma.appSession.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });
}
