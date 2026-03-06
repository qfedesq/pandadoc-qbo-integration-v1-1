import { InvoiceStatus } from "@prisma/client";

import {
  calculateFactoringOffer,
  formatDiscountRate,
  getSettlementMethodOptions,
} from "@/lib/factoring/offers";

const capitalSource = {
  id: "capital_source_1",
  key: "arena-stafi-managed-pool",
  name: "Protofire Arena StaFi Managed Pool",
  network: "Arena StaFi",
  currency: "USDC",
  availableLiquidity: "500000.00" as never,
  targetAdvanceRateBps: 9000,
  operatorFeeBps: 50,
};

describe("calculateFactoringOffer", () => {
  it("produces indicative terms for an eligible invoice", () => {
    const offer = calculateFactoringOffer(
      {
        importedInvoiceId: "invoice_1",
        providerInvoiceId: "9001",
        docNumber: "INV-9001",
        counterpartyName: "Acme Holdings",
        normalizedStatus: InvoiceStatus.OPEN,
        balanceAmount: "1250.00",
        totalAmount: "1250.00",
        currency: "USD",
        dueDate: new Date("2026-03-20T00:00:00.000Z"),
        issueDate: new Date("2026-03-01T00:00:00.000Z"),
        transactions: [],
      },
      capitalSource,
      new Date("2026-03-06T12:00:00.000Z"),
    );

    expect(offer.eligibility.eligible).toBe(true);
    expect(offer.advanceRateBps).toBe(8750);
    expect(offer.discountRateBps).toBe(400);
    expect(offer.discountAmount).toBe(43.75);
    expect(offer.operatorFeeAmount).toBe(5.47);
    expect(offer.netProceeds).toBe(1044.53);
    expect(offer.expectedRepaymentAmount).toBe(1093.75);
    expect(offer.settlementOptions).toHaveLength(3);
    expect(offer.termsSnapshot.capitalSource.key).toBe("arena-stafi-managed-pool");
  });

  it("adjusts the discount rate for partially paid invoices", () => {
    const offer = calculateFactoringOffer(
      {
        importedInvoiceId: "invoice_2",
        providerInvoiceId: "9003",
        docNumber: "INV-9003",
        counterpartyName: "Globex Corporation",
        normalizedStatus: InvoiceStatus.PARTIALLY_PAID,
        balanceAmount: "600.00",
        totalAmount: "2400.00",
        currency: "USD",
        dueDate: new Date("2026-03-15T00:00:00.000Z"),
        issueDate: new Date("2026-02-27T00:00:00.000Z"),
        transactions: [],
      },
      capitalSource,
      new Date("2026-03-06T12:00:00.000Z"),
    );

    expect(offer.discountRateBps).toBe(275);
    expect(offer.riskTier).toBe("HIGH");
    expect(formatDiscountRate(offer.discountRateBps)).toBe("2.75%");
  });

  it("marks very small invoices as ineligible when net proceeds fall below threshold", () => {
    const offer = calculateFactoringOffer(
      {
        importedInvoiceId: "invoice_3",
        providerInvoiceId: "9004",
        docNumber: "INV-9004",
        counterpartyName: "SmallCo",
        normalizedStatus: InvoiceStatus.OPEN,
        balanceAmount: "120.00",
        totalAmount: "120.00",
        currency: "USD",
        dueDate: new Date("2026-03-12T00:00:00.000Z"),
        issueDate: new Date("2026-03-05T00:00:00.000Z"),
        transactions: [],
      },
      capitalSource,
      new Date("2026-03-06T12:00:00.000Z"),
    );

    expect(offer.eligibility.eligible).toBe(false);
    expect(offer.eligibility.reason).toContain("minimum");
  });

  it("exposes all settlement methods for the confirmation flow", () => {
    expect(getSettlementMethodOptions().map((option) => option.method)).toEqual([
      "USDC_WALLET",
      "ACH",
      "DEBIT_CARD",
    ]);
  });
});
