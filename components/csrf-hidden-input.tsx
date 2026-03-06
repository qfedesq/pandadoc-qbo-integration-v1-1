import { CSRF_FORM_FIELD_NAME } from "@/lib/security/csrf-config";
import { getCsrfToken } from "@/lib/security/csrf";

export async function CsrfHiddenInput() {
  const csrfToken = await getCsrfToken();

  return <input type="hidden" name={CSRF_FORM_FIELD_NAME} value={csrfToken} />;
}
