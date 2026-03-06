import {
  InvoiceStatus,
  RiskTier,
  SettlementMethod,
  type CapitalSource,
} from "@prisma/client";

import { env } from "@/lib/env";
import { evaluateFactoringEligibility } from "@/lib/factoring/eligibility";
import { formatCurrency, toDateOnly } from "@/lib/utils";

type Decimalish = number | string | { toString(): string };

export type OfferInvoiceInput = {
  importedInvoiceId: string;
  providerInvoiceId: string;
  docNumber?: string | null;
  counterpartyName: string;
  normalizedStatus: InvoiceStatus;
  balanceAmount: Decimalish;
  totalAmount: Decimalish;
  currency?: string | null;
  dueDate?: Date | null;
  issueDate?: Date | null;
  transactions?: Array<{
    status: import("@prisma/client").FactoringTransactionStatus;
  }>;
};

export type SettlementMethodOption = {
  method: SettlementMethod;
  label: string;
  description: string;
  settlementTimeLabel: string;
  helperText: string;
};

export type CalculatedFactoringOffer = {
  eligibility: ReturnType<typeof evaluateFactoringEligibility>;
  riskTier: RiskTier;
  grossAmount: number;
  advanceRateBps: number;
  advanceAmount: number;
  discountRateBps: number;
  discountAmount: number;
  operatorFeeBps: number;
  operatorFeeAmount: number;
  poolYieldAmount: number;
  netProceeds: number;
  expectedRepaymentAmount: number;
  expectedMaturityDate: Date | null;
  expectedTermDays: number | null;
  settlementCurrency: string;
  settlementTimeSummary: string;
  settlementOptions: SettlementMethodOption[];
  termsSnapshot: {
    invoice: {
      importedInvoiceId: string;
      providerInvoiceId: string;
      docNumber: string | null;
      counterpartyName: string;
      dueDate: string | null;
      issueDate: string | null;
      invoiceStatus: InvoiceStatus;
    };
    economics: {
      grossAmount: number;
      advanceRateBps: number;
      advanceAmount: number;
      discountRateBps: number;
      discountAmount: number;
      operatorFeeBps: number;
      operatorFeeAmount: number;
      netProceeds: number;
      expectedRepaymentAmount: number;
      settlementCurrency: string;
    };
    risk: {
      tier: RiskTier;
      expectedTermDays: number | null;
      expectedMaturityDate: string | null;
    };
    capitalSource: {
      id: string;
      key: string;
      name: string;
      network: string;
      currency: string;
      availableLiquidity: number;
    };
    settlementOptions: SettlementMethodOption[];
    notes: string[];
  };
};

const settlementMethodDetails: Record<SettlementMethod, SettlementMethodOption> = {
  USDC_WALLET: {
    method: SettlementMethod.USDC_WALLET,
    label: "USDC wallet",
    description: "Receive settlement to the in-app demo wallet or any USDC-compatible address.",
    settlementTimeLabel: "Within minutes",
    helperText: "Provide the wallet address that should receive USDC for the demo flow.",
  },
  ACH: {
    method: SettlementMethod.ACH,
    label: "ACH",
    description: "Use the operator-managed off-ramp for same-day ACH settlement.",
    settlementTimeLabel: "Same business day",
    helperText: "Provide a bank account label or the last four digits for confirmation.",
  },
  DEBIT_CARD: {
    method: SettlementMethod.DEBIT_CARD,
    label: "Debit card",
    description: "Route settlement to a card rail managed by the operator wallet.",
    settlementTimeLabel: "Within 30 minutes",
    helperText: "Provide the last four digits of the debit card for the demo flow.",
  },
};

function toNumber(value: Decimalish) {
  const numeric = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getExpectedTermDays(dueDate: Date | null | undefined, now: Date) {
  if (!dueDate) {
    return null;
  }

  const dueDateOnly = toDateOnly(dueDate);
  const nowDateOnly = toDateOnly(now);

  return Math.max(
    Math.ceil((dueDateOnly.getTime() - nowDateOnly.getTime()) / 86_400_000),
    0,
  );
}

function getRiskTier(input: OfferInvoiceInput, now: Date): RiskTier {
  const grossAmount = toNumber(input.balanceAmount);
  const expectedTermDays = getExpectedTermDays(input.dueDate, now);

  if (
    input.normalizedStatus === InvoiceStatus.PARTIALLY_PAID ||
    (expectedTermDays !== null && expectedTermDays <= 10)
  ) {
    return RiskTier.HIGH;
  }

  if (
    grossAmount >= 7_500 ||
    (expectedTermDays !== null && expectedTermDays <= 30)
  ) {
    return RiskTier.MEDIUM;
  }

  return RiskTier.LOW;
}

function getDiscountRateBps(input: OfferInvoiceInput, now: Date) {
  let basisPoints =
    input.normalizedStatus === InvoiceStatus.PARTIALLY_PAID
      ? env.FACTORING_PARTIAL_PAYMENT_DISCOUNT_BPS
      : env.FACTORING_BASE_DISCOUNT_BPS;

  const expectedTermDays = getExpectedTermDays(input.dueDate, now);

  if (expectedTermDays !== null) {
    if (expectedTermDays <= 14) {
      basisPoints -= 50;
    } else if (expectedTermDays >= 45) {
      basisPoints += 75;
    }
  }

  return Math.min(Math.max(basisPoints, 200), 900);
}

function getAdvanceRateBps(
  capitalSource: Pick<CapitalSource, "targetAdvanceRateBps">,
  riskTier: RiskTier,
) {
  const baseRate = capitalSource.targetAdvanceRateBps || env.FACTORING_ADVANCE_RATE_BPS;
  const riskAdjustmentBps =
    riskTier === RiskTier.HIGH ? 500 : riskTier === RiskTier.MEDIUM ? 250 : 0;

  return Math.min(Math.max(baseRate - riskAdjustmentBps, 8_500), 9_500);
}

export function getSettlementMethodOptions() {
  return Object.values(settlementMethodDetails);
}

export function getSettlementMethodDetail(method: SettlementMethod) {
  return settlementMethodDetails[method];
}

export function formatDiscountRate(discountRateBps: number) {
  return `${(discountRateBps / 100).toFixed(2)}%`;
}

export function formatAdvanceRate(advanceRateBps: number) {
  return `${(advanceRateBps / 100).toFixed(2)}%`;
}

export function calculateFactoringOffer(
  input: OfferInvoiceInput,
  capitalSource: Pick<
    CapitalSource,
    | "id"
    | "key"
    | "name"
    | "network"
    | "currency"
    | "availableLiquidity"
    | "targetAdvanceRateBps"
    | "operatorFeeBps"
  >,
  now = new Date(),
): CalculatedFactoringOffer {
  const eligibility = evaluateFactoringEligibility(input);
  const grossAmount = roundCurrency(toNumber(input.balanceAmount));
  const riskTier = getRiskTier(input, now);
  const advanceRateBps = getAdvanceRateBps(capitalSource, riskTier);
  const advanceAmount = roundCurrency(grossAmount * (advanceRateBps / 10_000));
  const discountRateBps = getDiscountRateBps(input, now);
  const discountAmount = roundCurrency(advanceAmount * (discountRateBps / 10_000));
  const operatorFeeBps = capitalSource.operatorFeeBps;
  const operatorFeeAmount = roundCurrency(
    advanceAmount * (operatorFeeBps / 10_000),
  );
  const netProceeds = roundCurrency(
    Math.max(advanceAmount - discountAmount - operatorFeeAmount, 0),
  );
  const expectedRepaymentAmount = roundCurrency(advanceAmount);
  const expectedMaturityDate = input.dueDate ?? null;
  const expectedTermDays = getExpectedTermDays(expectedMaturityDate, now);
  const settlementOptions = getSettlementMethodOptions();
  const settlementTimeSummary = settlementOptions
    .map((option) => `${option.label}: ${option.settlementTimeLabel}`)
    .join(" / ");

  let finalEligibility = eligibility;

  if (grossAmount < env.FACTORING_MIN_INVOICE_AMOUNT) {
    finalEligibility = {
      ...eligibility,
      eligible: false,
      reason: `Invoice amount falls below the minimum ${formatCurrency(
        env.FACTORING_MIN_INVOICE_AMOUNT,
        input.currency ?? "USD",
      )} threshold for the managed pool.`,
    };
  } else if (netProceeds < env.FACTORING_MIN_NET_PROCEEDS) {
    finalEligibility = {
      ...eligibility,
      eligible: false,
      reason:
        "Net proceeds fall below the minimum threshold for the managed pool.",
    };
  } else if (Number(capitalSource.availableLiquidity.toString()) < netProceeds) {
    finalEligibility = {
      ...eligibility,
      eligible: false,
      reason: "The pool does not have enough available liquidity for this advance.",
    };
  }

  return {
    eligibility: finalEligibility,
    riskTier,
    grossAmount,
    advanceRateBps,
    advanceAmount,
    discountRateBps,
    discountAmount,
    operatorFeeBps,
    operatorFeeAmount,
    poolYieldAmount: discountAmount,
    netProceeds,
    expectedRepaymentAmount,
    expectedMaturityDate,
    expectedTermDays,
    settlementCurrency: capitalSource.currency,
    settlementTimeSummary,
    settlementOptions,
    termsSnapshot: {
      invoice: {
        importedInvoiceId: input.importedInvoiceId,
        providerInvoiceId: input.providerInvoiceId,
        docNumber: input.docNumber ?? null,
        counterpartyName: input.counterpartyName,
        dueDate: input.dueDate?.toISOString() ?? null,
        issueDate: input.issueDate?.toISOString() ?? null,
        invoiceStatus: input.normalizedStatus,
      },
      economics: {
        grossAmount,
        advanceRateBps,
        advanceAmount,
        discountRateBps,
        discountAmount,
        operatorFeeBps,
        operatorFeeAmount,
        netProceeds,
        expectedRepaymentAmount,
        settlementCurrency: capitalSource.currency,
      },
      risk: {
        tier: riskTier,
        expectedTermDays,
        expectedMaturityDate: expectedMaturityDate?.toISOString() ?? null,
      },
      capitalSource: {
        id: capitalSource.id,
        key: capitalSource.key,
        name: capitalSource.name,
        network: capitalSource.network,
        currency: capitalSource.currency,
        availableLiquidity: Number(capitalSource.availableLiquidity.toString()),
      },
      settlementOptions,
      notes: [
        `${formatCurrency(grossAmount, input.currency ?? "USD")} eligible invoice balance under evaluation.`,
        `Advance rate: ${formatAdvanceRate(advanceRateBps)} with ${formatDiscountRate(
          discountRateBps,
        )} discount pricing.`,
        `Protocol fee: ${formatDiscountRate(operatorFeeBps)}. Pool risk tier: ${riskTier}.`,
      ],
    },
  };
}
