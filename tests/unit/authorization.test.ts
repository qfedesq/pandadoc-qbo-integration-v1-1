import { UserRole } from "@prisma/client";

import {
  assertUserHasAnyRole,
  getEffectiveUserRole,
  userHasAnyRole,
} from "@/lib/auth/authorization";
import { env } from "@/lib/env";

describe("authorization helpers", () => {
  it("elevates the configured default admin email to ADMIN", () => {
    expect(
      getEffectiveUserRole({
        email: env.DEFAULT_ADMIN_EMAIL,
        role: UserRole.SELLER,
      }),
    ).toBe(UserRole.ADMIN);
  });

  it("keeps explicit operator roles unchanged", () => {
    expect(
      getEffectiveUserRole({
        email: "operator@example.com",
        role: UserRole.OPERATOR,
      }),
    ).toBe(UserRole.OPERATOR);
  });

  it("rejects access when the role is outside the allowlist", () => {
    expect(
      userHasAnyRole(
        {
          email: "seller@example.com",
          role: UserRole.SELLER,
        },
        [UserRole.ADMIN],
      ),
    ).toBe(false);

    expect(() =>
      assertUserHasAnyRole(
        {
          email: "seller@example.com",
          role: UserRole.SELLER,
        },
        [UserRole.ADMIN],
      ),
    ).toThrow("You do not have access to this resource.");
  });
});
