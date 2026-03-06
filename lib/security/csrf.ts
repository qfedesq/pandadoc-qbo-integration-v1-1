import "server-only";

import { timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";

import {
  CSRF_COOKIE_NAME,
  CSRF_FORM_FIELD_NAME,
  CSRF_HEADER_NAME,
} from "@/lib/security/csrf-config";
import { AppError } from "@/lib/utils/errors";

function parseCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const entry of cookies) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function isSameToken(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function getProvidedCsrfToken(request: Request) {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.clone().formData();
    const formToken = formData.get(CSRF_FORM_FIELD_NAME);
    return typeof formToken === "string" ? formToken : null;
  }

  return null;
}

export async function getCsrfToken() {
  const headerStore = await headers();
  const requestToken = headerStore.get(CSRF_HEADER_NAME);
  if (requestToken) {
    return requestToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value ?? "";
}

export async function assertValidCsrfToken(request: Request) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const expectedToken = parseCookieValue(
    request.headers.get("cookie"),
    CSRF_COOKIE_NAME,
  );
  const providedToken = await getProvidedCsrfToken(request);

  if (
    !expectedToken ||
    !providedToken ||
    !isSameToken(expectedToken, providedToken)
  ) {
    throw new AppError("CSRF validation failed.", 403, "INVALID_CSRF");
  }
}
