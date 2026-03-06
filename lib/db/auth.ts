import "server-only";

import { addMinutes } from "date-fns";
import { AuthIdentityProvider, Prisma } from "@prisma/client";

import { createUnavailablePasswordHash } from "@/lib/auth/passwords";
import { prisma } from "@/lib/db/prisma";
import { createOpaqueToken } from "@/lib/security/hash";
import { toPrismaInputJsonObject } from "@/lib/utils/prisma-json";

function buildOrganizationSlug(email: string) {
  const localPart = email.split("@")[0] ?? "demo";
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `org-${normalized}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function ensureOrganizationForEmail(
  tx: Prisma.TransactionClient,
  email: string,
) {
  const slug = buildOrganizationSlug(email);

  return tx.organization.upsert({
    where: {
      slug,
    },
    update: {
      name: `${slug.replace(/^org-/, "").replace(/-/g, " ")} workspace`,
    },
    create: {
      slug,
      name: `${slug.replace(/^org-/, "").replace(/-/g, " ")} workspace`,
    },
  });
}

export type AuthLoginStateClaimResult =
  | {
      status: "claimed";
      state: {
        id: string;
        provider: AuthIdentityProvider;
        redirectTo: string | null;
      };
    }
  | { status: "missing" }
  | { status: "consumed" }
  | { status: "expired" };

export async function createAuthLoginState(input: {
  provider: AuthIdentityProvider;
  redirectTo?: string;
}) {
  const state = createOpaqueToken(24);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.authLoginState.deleteMany({
      where: {
        provider: input.provider,
        OR: [
          {
            expiresAt: {
              lte: now,
            },
          },
          {
            consumedAt: {
              not: null,
            },
          },
        ],
      },
    });

    return tx.authLoginState.create({
      data: {
        provider: input.provider,
        state,
        redirectTo: input.redirectTo,
        expiresAt: addMinutes(now, 10),
      },
    });
  });
}

export async function claimAuthLoginState(
  provider: AuthIdentityProvider,
  state: string,
  now = new Date(),
): Promise<AuthLoginStateClaimResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.authLoginState.findFirst({
      where: {
        provider,
        state,
      },
      select: {
        id: true,
        provider: true,
        redirectTo: true,
        expiresAt: true,
        consumedAt: true,
      },
    });

    if (!existing) {
      return { status: "missing" };
    }

    if (existing.consumedAt) {
      return { status: "consumed" };
    }

    if (existing.expiresAt <= now) {
      return { status: "expired" };
    }

    const updated = await tx.authLoginState.updateMany({
      where: {
        id: existing.id,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (updated.count !== 1) {
      const fresh = await tx.authLoginState.findUnique({
        where: {
          id: existing.id,
        },
        select: {
          consumedAt: true,
          expiresAt: true,
        },
      });

      if (fresh?.consumedAt) {
        return { status: "consumed" };
      }

      if (fresh && fresh.expiresAt <= now) {
        return { status: "expired" };
      }

      return { status: "missing" };
    }

    return {
      status: "claimed",
      state: {
        id: existing.id,
        provider: existing.provider,
        redirectTo: existing.redirectTo,
      },
    };
  });
}

export async function upsertGoogleUserIdentity(input: {
  providerUserId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile: Record<string, unknown>;
}) {
  const normalizedEmail = input.email.toLowerCase();

  return prisma.$transaction(async (tx) => {
    const organization = await ensureOrganizationForEmail(tx, normalizedEmail);
    const existingIdentity = await tx.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthIdentityProvider.GOOGLE,
          providerUserId: input.providerUserId,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existingIdentity) {
      const user = await tx.user.update({
        where: {
          id: existingIdentity.userId,
        },
        data: {
          email: normalizedEmail,
          name: input.displayName ?? undefined,
          organizationId: organization.id,
        },
      });

      await tx.userIdentity.update({
        where: {
          id: existingIdentity.id,
        },
        data: {
          email: normalizedEmail,
          displayName: input.displayName ?? null,
          avatarUrl: input.avatarUrl ?? null,
          profile: toPrismaInputJsonObject(input.profile),
        },
      });

      return user;
    }

    const placeholderPasswordHash = await createUnavailablePasswordHash();
    const user = await tx.user.upsert({
      where: {
        email: normalizedEmail,
      },
      update: {
        name: input.displayName ?? undefined,
        organizationId: organization.id,
      },
      create: {
        email: normalizedEmail,
        name: input.displayName ?? null,
        passwordHash: placeholderPasswordHash,
        organizationId: organization.id,
      },
    });

    await tx.userIdentity.create({
      data: {
        userId: user.id,
        provider: AuthIdentityProvider.GOOGLE,
        providerUserId: input.providerUserId,
        email: normalizedEmail,
        displayName: input.displayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        profile: toPrismaInputJsonObject(input.profile),
      },
    });

    return user;
  });
}
