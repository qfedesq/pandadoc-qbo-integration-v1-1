export function sanitizeInternalRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/",
) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
