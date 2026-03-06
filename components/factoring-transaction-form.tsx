"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SettlementMethod } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type SettlementOption = {
  method: SettlementMethod;
  label: string;
  description: string;
  settlementTimeLabel: string;
  helperText: string;
};

export function FactoringTransactionForm({
  importedInvoiceId,
  settlementOptions,
}: {
  importedInvoiceId: string;
  settlementOptions: SettlementOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<SettlementMethod>(
    settlementOptions[0]?.method ?? SettlementMethod.USDC_WALLET,
  );
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedOption =
    settlementOptions.find((option) => option.method === method) ?? settlementOptions[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    const payload = {
      importedInvoiceId,
      settlementMethod: method,
      acceptTerms,
      walletAddress: String(formData.get("walletAddress") ?? ""),
      bankAccountLabel: String(formData.get("bankAccountLabel") ?? ""),
      debitCardLabel: String(formData.get("debitCardLabel") ?? ""),
    };

    startTransition(async () => {
      const response = await fetch("/api/factoring/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(responseBody?.error ?? "Unable to create the factoring transaction.");
        return;
      }

      const responseBody = (await response.json()) as { redirectTo: string };
      router.push(responseBody.redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="settlementMethod">Settlement method</Label>
        <Select
          id="settlementMethod"
          name="settlementMethod"
          value={method}
          onChange={(event) => setMethod(event.target.value as SettlementMethod)}
        >
          {settlementOptions.map((option) => (
            <option key={option.method} value={option.method}>
              {option.label} · {option.settlementTimeLabel}
            </option>
          ))}
        </Select>
        {selectedOption ? (
          <p className="text-sm text-muted-foreground">{selectedOption.description}</p>
        ) : null}
      </div>

      {method === SettlementMethod.USDC_WALLET ? (
        <div className="space-y-2">
          <Label htmlFor="walletAddress">Wallet address</Label>
          <Input
            id="walletAddress"
            name="walletAddress"
            placeholder="0x1234...abcd"
            required
          />
          <p className="text-xs text-muted-foreground">
            {selectedOption?.helperText}
          </p>
        </div>
      ) : null}

      {method === SettlementMethod.ACH ? (
        <div className="space-y-2">
          <Label htmlFor="bankAccountLabel">Bank account label / last 4</Label>
          <Input
            id="bankAccountLabel"
            name="bankAccountLabel"
            placeholder="Operating account 4821"
            required
          />
          <p className="text-xs text-muted-foreground">
            {selectedOption?.helperText}
          </p>
        </div>
      ) : null}

      {method === SettlementMethod.DEBIT_CARD ? (
        <div className="space-y-2">
          <Label htmlFor="debitCardLabel">Debit card last 4</Label>
          <Input
            id="debitCardLabel"
            name="debitCardLabel"
            placeholder="4821"
            required
          />
          <p className="text-xs text-muted-foreground">
            {selectedOption?.helperText}
          </p>
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-[1.25rem] border border-border/70 bg-white/5 p-4 text-sm">
        <input
          checked={acceptTerms}
          className="mt-1 h-4 w-4 rounded border-border bg-transparent"
          onChange={(event) => setAcceptTerms(event.target.checked)}
          type="checkbox"
        />
        <span className="text-muted-foreground">
          I accept the advance rate, fees, repayment amount, and settlement timing
          shown above. Funding will reserve pool liquidity and credit my demo
          wallet immediately in this MVP.
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <Button disabled={isPending || !acceptTerms} type="submit">
        {isPending ? "Funding..." : "Accept terms and fund invoice"}
      </Button>
    </form>
  );
}
