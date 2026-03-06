import { NextResponse, type NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf-config";

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "pandadoc_qbo_session";

const PRIVATE_ROUTE_PREFIXES = [
  "/factoring-dashboard",
  "/invoices",
  "/transactions",
  "/capital-pool",
  "/operator",
  "/integrations",
];

function isPrivateRoute(pathname: string) {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${
      process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
    }`,
    "connect-src 'self'",
    "worker-src 'self' blob:",
  ];

  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  options?: { privateResponse?: boolean },
) {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");

  if (options?.privateResponse) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    response.headers.set("Vary", "Cookie");
  }

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = isPrivateRoute(pathname);
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const hasCsrfCookie = Boolean(request.cookies.get(CSRF_COOKIE_NAME)?.value);
  const generatedCsrfToken = hasCsrfCookie
    ? null
    : crypto.randomUUID().replace(/-/g, "");

  if (isPrivate && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${search}`);

    const response = applySecurityHeaders(
      NextResponse.redirect(loginUrl, 303),
      {
        privateResponse: true,
      },
    );
    if (generatedCsrfToken) {
      response.cookies.set(CSRF_COOKIE_NAME, generatedCsrfToken, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  if (generatedCsrfToken) {
    requestHeaders.set(CSRF_HEADER_NAME, generatedCsrfToken);
  }

  const response = applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    {
      privateResponse:
        isPrivate || pathname === "/login" || pathname.startsWith("/api/"),
    },
  );

  if (
    request.method === "GET" &&
    !pathname.startsWith("/api/") &&
    generatedCsrfToken
  ) {
    response.cookies.set(CSRF_COOKIE_NAME, generatedCsrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
