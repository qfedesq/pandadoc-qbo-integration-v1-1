"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FactoringTransactionStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buildCsrfHeaders } from "@/lib/security/csrf-client";

export function FactoringTransactionActions({
  transactionId,
  status,
}: {
  transactionId: string;
  status: FactoringTransactionStatus;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: "fund" | "repay") {
    setMessage(null);

    startTransition(async () => {
      let response: Response;

      try {
        response = await fetch(
          `/api/factoring/transactions/${transactionId}/${action}`,
          {
            method: "POST",
            headers: buildCsrfHeaders(),
          },
        );
      } catch {
        setMessage("Unable to reach the server. Try again.");
        return;
      }

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessage(responseBody?.error ?? "Unable to update the transaction.");
        return;
      }

      setMessage(
        action === "fund"
          ? "Transaction marked as funded."
          : "Transaction marked as repaid.",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status === FactoringTransactionStatus.PENDING ? (
          <Button
            disabled={isPending}
            onClick={() => handleAction("fund")}
            type="button"
          >
            {isPending ? "Updating..." : "Mark funded"}
          </Button>
        ) : null}
        {status === FactoringTransactionStatus.FUNDED ? (
          <Button
            disabled={isPending}
            onClick={() => handleAction("repay")}
            type="button"
          >
            {isPending ? "Updating..." : "Mark repaid"}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
