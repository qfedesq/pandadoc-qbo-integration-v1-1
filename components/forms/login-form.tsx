"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to sign in.");
        return;
      }

      const payload = (await response.json()) as { redirectTo: string };
      router.push(payload.redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <>
        {googleEnabled ? (
          <form action="/api/auth/google/connect" method="post">
            <Button className="w-full" type="submit" variant="outline">
              <Chrome className="h-4 w-4" />
              Continue with Google
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" type="button" variant="outline" disabled>
              <Chrome className="h-4 w-4" />
              Continue with Google
            </Button>
            <p className="text-xs text-muted-foreground">
              Google sign-in appears here once this deployment has valid
              `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` values.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>Or use email and password</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="admin@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>
        {error ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
