import "server-only";

import { redirect } from "next/navigation";

import { assertUserHasAnyRole, type AuthorizedRole } from "@/lib/auth/authorization";
import { getCurrentSessionUser } from "@/lib/auth/session";

export async function requireUser() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireUserRole(
  roles: readonly AuthorizedRole[],
  redirectTo = "/factoring-dashboard",
) {
  const user = await requireUser();
  try {
    assertUserHasAnyRole(user, roles);
  } catch {
    redirect(redirectTo);
  }

  return user;
}
