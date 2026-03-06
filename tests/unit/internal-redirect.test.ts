import { sanitizeInternalRedirectPath } from "@/lib/security/internal-redirect";

describe("sanitizeInternalRedirectPath", () => {
  it("accepts a normal internal path", () => {
    expect(sanitizeInternalRedirectPath("/factoring-dashboard", "/login")).toBe(
      "/factoring-dashboard",
    );
  });

  it("rejects external-looking redirects", () => {
    expect(sanitizeInternalRedirectPath("https://evil.example", "/login")).toBe(
      "/login",
    );
    expect(sanitizeInternalRedirectPath("//evil.example", "/login")).toBe(
      "/login",
    );
  });
});
