"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf-config";

export function getBrowserCsrfToken() {
  if (typeof document === "undefined") {
    return "";
  }

  const cookies = document.cookie.split(";");

  for (const entry of cookies) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === CSRF_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return "";
}

export function buildCsrfHeaders(headers?: HeadersInit) {
  const token = getBrowserCsrfToken();
  const nextHeaders = new Headers(headers);

  if (token) {
    nextHeaders.set(CSRF_HEADER_NAME, token);
  }

  return nextHeaders;
}
