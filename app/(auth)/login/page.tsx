import { redirect } from "next/navigation";

import { AppBrand } from "@/components/app-brand";
import { LoginForm } from "@/components/forms/login-form";
import { NoticeBanner } from "@/components/notice-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasGoogleOauthConfig } from "@/lib/env";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getCsrfToken } from "@/lib/security/csrf";
import { sanitizeInternalRedirectPath } from "@/lib/security/internal-redirect";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const [user, csrfToken] = await Promise.all([
    getCurrentSessionUser(),
    getCsrfToken(),
  ]);
  const query = (await searchParams) ?? {};
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const redirectTo = sanitizeInternalRedirectPath(
    Array.isArray(query.redirectTo) ? query.redirectTo[0] : query.redirectTo,
    "/factoring-dashboard",
  );

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="protofire-hero border-white/12 relative overflow-hidden border">
          <div className="protofire-wave absolute inset-0 opacity-40" />
          <CardContent className="relative flex h-full flex-col justify-between gap-10 p-8">
            <div className="space-y-5">
              <AppBrand className="w-fit" />
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Secure access
                </p>
                <h1 className="text-4xl font-[var(--font-heading)] font-semibold tracking-tight text-white md:text-5xl">
                  Turn invoice workflows into working capital inside PandaDoc.
                </h1>
                <p className="max-w-xl text-sm text-slate-300">
                  Sign in to connect PandaDoc and QuickBooks, import invoices,
                  and walk through the seller, capital provider, and operator
                  flows in one demo workspace.
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <div className="border-white/12 bg-white/6 rounded-[1.25rem] border p-4">
                Secure sign-in
              </div>
              <div className="border-white/12 bg-white/6 rounded-[1.25rem] border p-4">
                Invoice sync
              </div>
              <div className="border-white/12 bg-white/6 rounded-[1.25rem] border p-4">
                Withdraw capital
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Sign in
            </p>
            <CardTitle>Access the working capital demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <NoticeBanner error={error} notice={notice} />
            <LoginForm
              csrfToken={csrfToken}
              googleEnabled={hasGoogleOauthConfig()}
              redirectTo={redirectTo}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
