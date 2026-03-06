"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-rose-400/30 bg-rose-500/10 p-8 text-rose-50">
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">
        Workspace unavailable
      </p>
      <h2 className="mt-2 text-3xl font-[var(--font-heading)] font-semibold tracking-tight">
        The dashboard could not be loaded.
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-rose-100/90">
        {error.message || "An unexpected server error interrupted the request."}
      </p>
      <Button className="mt-5" onClick={reset} variant="outline">
        Retry
      </Button>
    </div>
  );
}
