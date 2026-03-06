import { z } from "zod";

import { assertServerRuntime } from "@/lib/security/server-runtime";

assertServerRuntime("lib/env");

const defaultTokenKey =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const defaultCronSecret = "replace-with-a-long-random-string";
const defaultAdminPassword = "ChangeMe123!";
const placeholderValuePattern = /^(replace-me-|placeholder)/i;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/pandadoc_qbo?schema=public"),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default(defaultAdminPassword),
  SEED_DEMO_DATA: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true")
    .default(false),
  SESSION_COOKIE_NAME: z.string().min(1).default("pandadoc_qbo_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  OUTBOUND_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  INVOICE_SYNC_ENABLED: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) =>
      value === undefined ? true : value === true || value === "true",
    )
    .default(true),
  INVOICE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  QUICKBOOKS_MODE: z.enum(["mock", "oauth"]).default("mock"),
  FACTORING_BASE_DISCOUNT_BPS: z.coerce.number().int().positive().default(450),
  FACTORING_PARTIAL_PAYMENT_DISCOUNT_BPS: z.coerce
    .number()
    .int()
    .positive()
    .default(325),
  FACTORING_ADVANCE_RATE_BPS: z.coerce.number().int().positive().default(9000),
  FACTORING_PROTOCOL_FEE_BPS: z.coerce.number().int().nonnegative().default(50),
  FACTORING_MIN_INVOICE_AMOUNT: z.coerce.number().positive().default(500),
  FACTORING_MIN_NET_PROCEEDS: z.coerce.number().positive().default(250),
  ARENA_STAFI_POOL_NAME: z
    .string()
    .min(1)
    .default("Protofire Arena StaFi Managed Pool"),
  ARENA_STAFI_NETWORK: z.string().min(1).default("Arena StaFi"),
  ARENA_STAFI_OPERATOR_WALLET: z
    .string()
    .min(1)
    .default("0xProtofireOperatorWalletDemo"),
  ARENA_STAFI_LIQUIDITY_SNAPSHOT: z.coerce.number().positive().default(500000),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .default(defaultTokenKey),
  INTERNAL_SYNC_SECRET: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(16).default(defaultCronSecret),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/auth/google/callback"),
  GOOGLE_SCOPES: z.string().default("openid email profile"),
  GOOGLE_AUTH_URL: z
    .string()
    .url()
    .default("https://accounts.google.com/o/oauth2/v2/auth"),
  GOOGLE_TOKEN_URL: z
    .string()
    .url()
    .default("https://oauth2.googleapis.com/token"),
  GOOGLE_USERINFO_URL: z
    .string()
    .url()
    .default("https://openidconnect.googleapis.com/v1/userinfo"),
  GOOGLE_ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default("gmail.com,googlemail.com"),
  PANDADOC_CLIENT_ID: z.string().optional().default(""),
  PANDADOC_CLIENT_SECRET: z.string().optional().default(""),
  PANDADOC_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/oauth/pandadoc/callback"),
  PANDADOC_SCOPES: z.string().default("read+write"),
  PANDADOC_AUTH_URL: z
    .string()
    .url()
    .default("https://app.pandadoc.com/oauth2/authorize"),
  PANDADOC_TOKEN_URL: z
    .string()
    .url()
    .default("https://api.pandadoc.com/oauth2/access_token"),
  PANDADOC_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.pandadoc.com"),
  PANDADOC_TEMPLATE_UUID: z.string().optional().default(""),
  PANDADOC_RECIPIENT_ROLE: z.string().min(1).default("Client"),
  PANDADOC_DOCUMENT_NAME_PREFIX: z.string().min(1).default("Invoice"),
  PANDADOC_SEND_ON_IMPORT: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true")
    .default(false),
  PANDADOC_WEBHOOK_SHARED_SECRET: z.string().optional().default(""),
  QUICKBOOKS_CLIENT_ID: z.string().optional().default(""),
  QUICKBOOKS_CLIENT_SECRET: z.string().optional().default(""),
  QUICKBOOKS_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/oauth/quickbooks/callback"),
  QUICKBOOKS_SCOPES: z.string().default("com.intuit.quickbooks.accounting"),
  QUICKBOOKS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  QUICKBOOKS_AUTH_URL: z
    .string()
    .url()
    .default("https://appcenter.intuit.com/connect/oauth2"),
  QUICKBOOKS_TOKEN_URL: z
    .string()
    .url()
    .default("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"),
  QUICKBOOKS_MINOR_VERSION: z.coerce.number().int().positive().default(75),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  INTERNAL_SYNC_SECRET: parsedEnv.INTERNAL_SYNC_SECRET ?? parsedEnv.CRON_SECRET,
};

function isConfiguredValue(value?: string | null) {
  return Boolean(value && !placeholderValuePattern.test(value.trim()));
}

export const isProduction = env.NODE_ENV === "production";

export function hasGoogleOauthConfig() {
  return Boolean(
    isConfiguredValue(env.GOOGLE_CLIENT_ID) &&
      isConfiguredValue(env.GOOGLE_CLIENT_SECRET),
  );
}

export function getGoogleAllowedEmailDomains() {
  return env.GOOGLE_ALLOWED_EMAIL_DOMAINS.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function hasPandaDocOauthConfig() {
  return Boolean(
    isConfiguredValue(env.PANDADOC_CLIENT_ID) &&
      isConfiguredValue(env.PANDADOC_CLIENT_SECRET),
  );
}

export function hasPandaDocImportConfig() {
  return Boolean(
    hasPandaDocOauthConfig() && isConfiguredValue(env.PANDADOC_TEMPLATE_UUID),
  );
}

export function hasQuickBooksOauthConfig() {
  return Boolean(
    isConfiguredValue(env.QUICKBOOKS_CLIENT_ID) &&
      isConfiguredValue(env.QUICKBOOKS_CLIENT_SECRET),
  );
}

export function isQuickBooksMockMode() {
  return env.QUICKBOOKS_MODE === "mock";
}

export function assertSecureTokenEncryptionConfiguration() {
  if (env.NODE_ENV === "production" && env.TOKEN_ENCRYPTION_KEY === defaultTokenKey) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be explicitly set in production.",
    );
  }
}

function isDefaultSyncSecret(secret: string | undefined) {
  return !secret || secret === defaultCronSecret;
}

export function assertSecureCronConfiguration(options?: {
  requireVercelCronSecret?: boolean;
}) {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const hasSecureInternalSecret = !isDefaultSyncSecret(env.INTERNAL_SYNC_SECRET);
  const hasSecureCronSecret = !isDefaultSyncSecret(env.CRON_SECRET);

  if (options?.requireVercelCronSecret && !hasSecureCronSecret) {
    throw new Error("CRON_SECRET must be explicitly set in production.");
  }

  if (!hasSecureInternalSecret && !hasSecureCronSecret) {
    throw new Error(
      "INTERNAL_SYNC_SECRET or CRON_SECRET must be explicitly set in production.",
    );
  }
}

export function assertSecureAdminConfiguration() {
  if (
    env.NODE_ENV === "production" &&
    env.DEFAULT_ADMIN_PASSWORD === defaultAdminPassword
  ) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be rotated in production.");
  }
}
