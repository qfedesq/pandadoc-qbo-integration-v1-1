"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildCsrfHeaders } from "@/lib/security/csrf-client";

export function SyncButton({
  disabled = false,
  payload,
}: {
  disabled?: boolean;
  payload?: {
    connectionId?: string;
    force?: boolean;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);

    startTransition(async () => {
      const hasPayload =
        Boolean(payload?.connectionId) || typeof payload?.force === "boolean";
      const response = await fetch("/api/invoices/sync", {
        method: "POST",
        headers: hasPayload
          ? buildCsrfHeaders({ "Content-Type": "application/json" })
          : buildCsrfHeaders(),
        body: hasPayload ? JSON.stringify(payload) : undefined,
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessage(errorPayload?.error ?? "Sync failed.");
        return;
      }

      const successPayload = (await response.json()) as {
        results: Array<{ processedCount: number }>;
      };
      const processed = successPayload.results.reduce(
        (sum, result) => sum + result.processedCount,
        0,
      );

      setMessage(`Sync completed. ${processed} invoice(s) processed.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={isPending || disabled}>
        <RefreshCcw className="h-4 w-4" />
        {isPending ? "Syncing..." : "Sync now"}
      </Button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
