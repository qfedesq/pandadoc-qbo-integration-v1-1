import { destroyCurrentSession } from "@/lib/auth/session";
import {
  getRequestContext,
  guardApiMutation,
  handleApiError,
  redirectNoStore,
} from "@/lib/server/http";

export async function POST(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    await guardApiMutation(request);
    await destroyCurrentSession();
    return redirectNoStore(new URL("/login", request.url), 303);
  } catch (error) {
    return handleApiError("auth.logout_failed", error, requestContext);
  }
}
