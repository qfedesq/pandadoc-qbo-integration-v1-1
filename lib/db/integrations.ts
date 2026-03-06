import { addMinutes, addSeconds } from "date-fns";
import { Prisma, Provider } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getInvoiceSyncDueThreshold } from "@/lib/invoices/schedule";
import { encryptSecret } from "@/lib/security/encryption";
import { createOpaqueToken } from "@/lib/security/hash";

const connectionInclude = {
  token: true,
  quickBooksCompany: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.IntegrationConnectionInclude;

export type ConnectionWithSecrets = Prisma.IntegrationConnectionGetPayload<{
  include: typeof connectionInclude;
}>;

export type OAuthStateClaimResult =
  | {
      status: "claimed";
      state: {
        id: string;
        userId: string;
        provider: Provider;
        redirectTo: string | null;
      };
    }
  | { status: "missing" }
  | { status: "consumed" }
  | { status: "expired" };

export async function createOAuthState(input: {
  userId: string;
  provider: Provider;
  redirectTo?: string;
}) {
  const state = createOpaqueToken(24);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.oAuthState.deleteMany({
      where: {
        userId: input.userId,
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

    return tx.oAuthState.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        state,
        redirectTo: input.redirectTo,
        expiresAt: addMinutes(now, 10),
      },
    });
  });
}

export async function claimOAuthState(
  provider: Provider,
  state: string,
  now = new Date(),
): Promise<OAuthStateClaimResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.oAuthState.findFirst({
      where: {
        provider,
        state,
      },
      select: {
        id: true,
        userId: true,
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

    const updated = await tx.oAuthState.updateMany({
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
      const fresh = await tx.oAuthState.findUnique({
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
        userId: existing.userId,
        provider: existing.provider,
        redirectTo: existing.redirectTo,
      },
    };
  });
}

function parseScopeList(scope?: string | null) {
  if (!scope) {
    return [];
  }

  return scope
    .split(/[,\s+]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function upsertPandaDocConnection(input: {
  userId: string;
  accountId: string;
  displayName: string;
  accountName: string;
  metadata: Prisma.InputJsonObject;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    refreshTokenExpiresInSeconds?: number;
    tokenType: string;
    scope?: string;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        organizationId: true,
      },
    });
    const connection = await tx.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: Provider.PANDADOC,
        },
      },
      create: {
        userId: input.userId,
        organizationId: user?.organizationId,
        provider: Provider.PANDADOC,
        status: "CONNECTED",
        displayName: input.displayName,
        externalAccountId: input.accountId,
        externalAccountName: input.accountName,
        scopes: parseScopeList(input.tokens.scope),
        metadata: input.metadata,
      },
      update: {
        organizationId: user?.organizationId,
        status: "CONNECTED",
        displayName: input.displayName,
        externalAccountId: input.accountId,
        externalAccountName: input.accountName,
        scopes: parseScopeList(input.tokens.scope),
        metadata: input.metadata,
        lastError: null,
      },
    });

    await tx.oAuthToken.upsert({
      where: {
        connectionId: connection.id,
      },
      create: {
        connectionId: connection.id,
        accessTokenEncrypted: encryptSecret(input.tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(input.tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(
          new Date(),
          input.tokens.expiresInSeconds,
        ),
        refreshTokenExpiresAt: input.tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), input.tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: input.tokens.tokenType,
        scope: input.tokens.scope,
      },
      update: {
        accessTokenEncrypted: encryptSecret(input.tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(input.tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(
          new Date(),
          input.tokens.expiresInSeconds,
        ),
        refreshTokenExpiresAt: input.tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), input.tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: input.tokens.tokenType,
        scope: input.tokens.scope,
      },
    });

    return connection;
  });
}

export async function upsertQuickBooksConnection(input: {
  userId: string;
  realmId: string;
  companyName?: string | null;
  country?: string | null;
  currency?: string | null;
  metadata: Prisma.InputJsonObject;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    refreshTokenExpiresInSeconds?: number;
    tokenType: string;
    scope?: string;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        organizationId: true,
      },
    });
    const existingConnection = await tx.integrationConnection.findUnique({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: Provider.QUICKBOOKS,
        },
      },
      select: {
        id: true,
        externalAccountId: true,
      },
    });
    const companyChanged =
      existingConnection?.externalAccountId !== undefined &&
      existingConnection.externalAccountId !== null &&
      existingConnection.externalAccountId !== input.realmId;

    const connection = await tx.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: Provider.QUICKBOOKS,
        },
      },
      create: {
        userId: input.userId,
        organizationId: user?.organizationId,
        provider: Provider.QUICKBOOKS,
        status: "CONNECTED",
        displayName: input.companyName ?? `QuickBooks ${input.realmId}`,
        externalAccountId: input.realmId,
        externalAccountName: input.companyName ?? input.realmId,
        scopes: parseScopeList(input.tokens.scope),
        metadata: input.metadata,
      },
      update: {
        organizationId: user?.organizationId,
        status: "CONNECTED",
        displayName: input.companyName ?? `QuickBooks ${input.realmId}`,
        externalAccountId: input.realmId,
        externalAccountName: input.companyName ?? input.realmId,
        scopes: parseScopeList(input.tokens.scope),
        metadata: input.metadata,
        lastError: null,
        lastSyncAt: companyChanged ? null : undefined,
      },
    });

    if (companyChanged) {
      await tx.importedInvoice.deleteMany({
        where: {
          connectionId: connection.id,
        },
      });
    }

    await tx.oAuthToken.upsert({
      where: {
        connectionId: connection.id,
      },
      create: {
        connectionId: connection.id,
        accessTokenEncrypted: encryptSecret(input.tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(input.tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(
          new Date(),
          input.tokens.expiresInSeconds,
        ),
        refreshTokenExpiresAt: input.tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), input.tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: input.tokens.tokenType,
        scope: input.tokens.scope,
      },
      update: {
        accessTokenEncrypted: encryptSecret(input.tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(input.tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(
          new Date(),
          input.tokens.expiresInSeconds,
        ),
        refreshTokenExpiresAt: input.tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), input.tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: input.tokens.tokenType,
        scope: input.tokens.scope,
      },
    });

    await tx.quickBooksCompany.upsert({
      where: {
        connectionId: connection.id,
      },
      create: {
        connectionId: connection.id,
        realmId: input.realmId,
        companyName: input.companyName,
        country: input.country,
        currency: input.currency,
        metadata: input.metadata,
      },
      update: {
        realmId: input.realmId,
        companyName: input.companyName,
        country: input.country,
        currency: input.currency,
        metadata: input.metadata,
      },
    });

    return connection;
  });
}

export async function getUserConnections(userId: string) {
  return prisma.integrationConnection.findMany({
    where: {
      userId,
    },
    orderBy: {
      provider: "asc",
    },
    include: {
      quickBooksCompany: true,
    },
  });
}

export async function findUserConnection(userId: string, provider: Provider) {
  return prisma.integrationConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    include: {
      quickBooksCompany: true,
      token: true,
    },
  });
}

export async function getConnectionWithSecrets(connectionId: string) {
  return prisma.integrationConnection.findUnique({
    where: {
      id: connectionId,
    },
    include: connectionInclude,
  });
}

export async function getQuickBooksConnectionsForSync(filter?: {
  connectionId?: string;
  userId?: string;
  dueOnly?: boolean;
  now?: Date;
  intervalMinutes?: number;
}) {
  const dueThreshold = filter?.dueOnly
    ? getInvoiceSyncDueThreshold(
        filter.now ?? new Date(),
        filter.intervalMinutes,
      )
    : null;

  return prisma.integrationConnection.findMany({
    where: {
      provider: Provider.QUICKBOOKS,
      status: "CONNECTED",
      ...(filter?.connectionId ? { id: filter.connectionId } : {}),
      ...(filter?.userId ? { userId: filter.userId } : {}),
      ...(dueThreshold
        ? {
            OR: [
              {
                lastSyncAt: null,
              },
              {
                lastSyncAt: {
                  lte: dueThreshold,
                },
              },
            ],
          }
        : {}),
    },
    include: connectionInclude,
  });
}

export async function updateConnectionToken(
  connectionId: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    refreshTokenExpiresInSeconds?: number;
    tokenType: string;
    scope?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.integrationConnection.update({
      where: {
        id: connectionId,
      },
      data: {
        status: "CONNECTED",
        lastError: null,
        scopes: parseScopeList(tokens.scope),
      },
    });

    return tx.oAuthToken.upsert({
      where: {
        connectionId,
      },
      create: {
        connectionId,
        accessTokenEncrypted: encryptSecret(tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(new Date(), tokens.expiresInSeconds),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
      },
      update: {
        accessTokenEncrypted: encryptSecret(tokens.accessToken),
        refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
        accessTokenExpiresAt: addSeconds(new Date(), tokens.expiresInSeconds),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresInSeconds
          ? addSeconds(new Date(), tokens.refreshTokenExpiresInSeconds)
          : null,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
      },
    });
  });
}

export async function markConnectionError(connectionId: string, message: string) {
  return prisma.integrationConnection.update({
    where: {
      id: connectionId,
    },
    data: {
      status: "ERROR",
      lastError: message,
    },
  });
}

export async function markConnectionSynced(connectionId: string, syncedAt: Date) {
  return prisma.integrationConnection.update({
    where: {
      id: connectionId,
    },
    data: {
      lastSyncAt: syncedAt,
      lastError: null,
      status: "CONNECTED",
    },
  });
}

export async function disconnectConnection(userId: string, provider: Provider) {
  return prisma.$transaction(async (tx) => {
    const connection = await tx.integrationConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!connection) {
      return null;
    }

    await tx.integrationConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: "DISCONNECTED",
        lastError: null,
      },
    });

    await tx.oAuthToken.deleteMany({
      where: {
        connectionId: connection.id,
      },
    });

    return connection;
  });
}
