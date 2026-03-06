import "server-only";

import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";

import { assertUserHasAnyRole } from "@/lib/auth/authorization";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { assertValidCsrfToken } from "@/lib/security/csrf";
import { logger } from "@/lib/logging/logger";
import { assertValidAppRequestOrigin } from "@/lib/security/origin";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";
import { AppError, getPublicError } from "@/lib/utils/errors";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
} as const;

type SearchParamRecord = Record<string, string | string[] | undefined>;

function toFlatRecord(source: SearchParamRecord | URLSearchParams) {
  if (source instanceof URLSearchParams) {
    return Object.fromEntries(source.entries());
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export function getPrivateResponseHeaders(headers?: HeadersInit) {
  return {
    ...PRIVATE_RESPONSE_HEADERS,
    ...headers,
  };
}

export function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: getPrivateResponseHeaders(init?.headers),
  });
}

export function redirectNoStore(url: URL | string, status = 303) {
  const response = NextResponse.redirect(url, status);
  Object.entries(PRIVATE_RESPONSE_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
  options?: {
    maxBytes?: number;
    allowEmpty?: boolean;
  },
): Promise<z.infer<TSchema>> {
  const maxBytes = options?.maxBytes ?? 16_384;
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new AppError(
      "Expected a JSON request body.",
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }

  const rawBody = await request.text();
  const bodyBytes = Buffer.byteLength(rawBody, "utf8");

  if (bodyBytes > maxBytes) {
    throw new AppError(
      "Request payload is too large.",
      413,
      "PAYLOAD_TOO_LARGE",
    );
  }

  if (!rawBody.trim()) {
    if (options?.allowEmpty) {
      return schema.parse({});
    }

    throw new AppError(
      "Request payload is required.",
      400,
      "EMPTY_REQUEST_BODY",
    );
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new AppError("Invalid JSON payload.", 400, "INVALID_JSON");
  }

  return schema.parse(parsedBody);
}

export async function parseRouteParams<TSchema extends ZodTypeAny>(
  params: Promise<Record<string, string>>,
  schema: TSchema,
) {
  return schema.parse(await params);
}

export function parseSearchParams<TSchema extends ZodTypeAny>(
  searchParams: SearchParamRecord | URLSearchParams,
  schema: TSchema,
) {
  return schema.parse(toFlatRecord(searchParams));
}

export async function requireApiUser(options?: {
  roles?: readonly UserRole[];
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    throw new AppError("Unauthorized.", 401, "UNAUTHORIZED");
  }

  if (options?.roles?.length) {
    assertUserHasAnyRole(user, options.roles);
  }

  return user;
}

export async function guardApiMutation(
  request: Request,
  input?: {
    rateLimit?:
      | {
          key: string;
          limit: number;
          windowMs: number;
        }
      | undefined;
    skipOriginCheck?: boolean;
    skipCsrfCheck?: boolean;
  },
) {
  if (!input?.skipOriginCheck) {
    assertValidAppRequestOrigin(request);
  }

  if (!input?.skipCsrfCheck) {
    await assertValidCsrfToken(request);
  }

  if (!input?.rateLimit) {
    return;
  }

  const rateLimit = await enforceRateLimit(input.rateLimit);

  if (!rateLimit.allowed) {
    throw new AppError("Rate limit reached.", 429, "RATE_LIMITED");
  }
}

export function getRequestContext(request: Request) {
  return {
    ip: getRequestIp(request),
    requestId:
      request.headers.get("x-request-id") ??
      request.headers.get("x-vercel-id") ??
      "unknown",
  };
}

export function handleApiError(
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  logger.error(event, { ...context, error });
  const publicError = getPublicError(error);
  return jsonNoStore(
    { error: publicError.message, code: publicError.code },
    { status: publicError.statusCode },
  );
}
