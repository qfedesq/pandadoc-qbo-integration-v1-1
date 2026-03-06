import "server-only";

import { UserRole } from "@prisma/client";

import { env } from "@/lib/env";
import { AppError } from "@/lib/utils/errors";

import type { SessionUser } from "./session";

export type AuthorizedRole = UserRole;

function isDefaultAdminEmail(email: string) {
  return email.toLowerCase() === env.DEFAULT_ADMIN_EMAIL.toLowerCase();
}

export function getEffectiveUserRole(
  user: Pick<SessionUser, "email" | "role">,
): UserRole {
  if (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) {
    return user.role;
  }

  if (isDefaultAdminEmail(user.email)) {
    return UserRole.ADMIN;
  }

  return user.role;
}

export function userHasAnyRole(
  user: Pick<SessionUser, "email" | "role">,
  roles: readonly AuthorizedRole[],
) {
  return roles.includes(getEffectiveUserRole(user));
}

export function assertUserHasAnyRole(
  user: Pick<SessionUser, "email" | "role">,
  roles: readonly AuthorizedRole[],
  message = "You do not have access to this resource.",
) {
  if (!userHasAnyRole(user, roles)) {
    throw new AppError(message, 403, "FORBIDDEN");
  }
}
