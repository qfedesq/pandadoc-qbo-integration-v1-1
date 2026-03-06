import {
  InvoiceStatus,
  Provider,
  SettlementMethod,
} from "@prisma/client";

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "invoice_1",
    userId: "user_1",
    connectionId: "connection_1",
    quickBooksCompanyId: "company_1",
    provider: Provider.QUICKBOOKS,
    providerInvoiceId: "9001",
    docNumber: "INV-9001",
    totalAmount: "1250.00" as never,
    balanceAmount: "1250.00" as never,
    currency: "USD",
    dueDate: new Date("2026-03-20T00:00:00.000Z"),
    issueDate: new Date("2026-03-01T00:00:00.000Z"),
    txnDate: new Date("2026-03-01T00:00:00.000Z"),
    createdTime: new Date("2026-03-01T10:00:00.000Z"),
    updatedTime: new Date("2026-03-01T11:00:00.000Z"),
    counterpartyName: "Acme Holdings",
    counterpartyEmail: "billing@acme.example",
    normalizedStatus: InvoiceStatus.OPEN,
    rawPayload: {},
    lastSyncedAt: new Date("2026-03-06T12:00:00.000Z"),
    createdAt: new Date("2026-03-06T12:00:00.000Z"),
    updatedAt: new Date("2026-03-06T12:00:00.000Z"),
    documentLinks: [],
    factoringTransactions: [],
    factoringOffer: null,
    ...overrides,
  };
}

describe("factoring transaction orchestration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates a funded factoring transaction and emits audit events", async () => {
    const topLevelEventCreate = vi.fn().mockResolvedValue(undefined);
    const txEventCreate = vi.fn().mockResolvedValue(undefined);
    const txEventCreateMany = vi.fn().mockResolvedValue(undefined);
    const finalTransaction = {
      id: "transaction_1",
      transactionReference: "FACT-20260306-ABC123",
      status: "FUNDED",
      settlementMethod: SettlementMethod.USDC_WALLET,
      settlementDestinationMasked: "Wallet 0x1234...abcd",
      settlementCurrency: "USDC",
      netProceeds: "1044.53",
    };
    const tx = {
      factoringTransaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "transaction_1" }),
        update: vi.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: vi.fn().mockResolvedValue(finalTransaction),
      },
      factoringEventLog: {
        create: txEventCreate,
        createMany: txEventCreateMany,
      },
      importedInvoice: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      capitalSource: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "capital_source_1",
          availableLiquidity: "500000.00",
          deployedLiquidity: "0.00",
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      poolTransaction: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      walletLedger: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const prismaMock = {
      factoringEventLog: {
        create: topLevelEventCreate,
      },
      importedInvoice: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: prismaMock,
    }));

    const { createFactoringTransaction } = await import("@/lib/factoring/transactions");

    const deps = {
      getInvoice: vi.fn().mockResolvedValue(buildInvoice()),
      getCapitalSource: vi.fn().mockResolvedValue({
        id: "capital_source_1",
        key: "arena-stafi-managed-pool",
        name: "Protofire Arena StaFi Managed Pool",
        network: "Arena StaFi",
        currency: "USDC",
        operatorWallet: "0xProtofireOperatorWalletDemo",
        availableLiquidity: "500000.00",
        targetAdvanceRateBps: 9000,
        operatorFeeBps: 50,
      }),
      upsertOffer: vi.fn().mockResolvedValue({
        id: "offer_1",
      }),
      prepareSettlement: vi.fn().mockReturnValue({
        capitalSourceKey: "arena-stafi-managed-pool",
        capitalSourceType: "ARENA_STAFI_MANAGED_POOL",
        network: "Arena StaFi",
        operatorWallet: "0xProtofireOperatorWalletDemo",
        settlementReference: "arena_sim_123",
        onChainExecutionStatus: "SIMULATED",
        message: "Prepared settlement.",
      }),
    };

    const result = await createFactoringTransaction(deps, {
      userId: "user_1",
      importedInvoiceId: "invoice_1",
      settlementMethod: SettlementMethod.USDC_WALLET,
      acceptTerms: true,
      walletAddress: "0x1234567890abcd",
    });

    expect(deps.prepareSettlement).toHaveBeenCalled();
    expect(prismaMock.factoringEventLog.create).toHaveBeenCalledTimes(1);
    expect(tx.factoringTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          importedInvoiceId: "invoice_1",
          status: "PENDING",
          settlementMethod: SettlementMethod.USDC_WALLET,
          settlementDestinationMasked: "Wallet 0x1234...abcd",
        }),
      }),
    );
    expect(txEventCreateMany).toHaveBeenCalledTimes(1);
    expect(txEventCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      created: true,
      transaction: finalTransaction,
    });
  });

  it("returns an existing active transaction instead of duplicating the invoice financing", async () => {
    const tx = {
      factoringTransaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: "transaction_existing",
          transactionReference: "FACT-EXISTING-9001",
          status: "PENDING",
        }),
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      factoringEventLog: {
        create: vi.fn(),
      },
    };
    const prismaMock = {
      factoringEventLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      importedInvoice: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: prismaMock,
    }));

    const { createFactoringTransaction } = await import("@/lib/factoring/transactions");

    const deps = {
      getInvoice: vi.fn().mockResolvedValue(buildInvoice()),
      getCapitalSource: vi.fn().mockResolvedValue({
        id: "capital_source_1",
        key: "arena-stafi-managed-pool",
        name: "Protofire Arena StaFi Managed Pool",
        network: "Arena StaFi",
        currency: "USDC",
        operatorWallet: "0xProtofireOperatorWalletDemo",
        availableLiquidity: "500000.00",
        targetAdvanceRateBps: 9000,
        operatorFeeBps: 50,
      }),
      upsertOffer: vi.fn().mockResolvedValue({
        id: "offer_1",
      }),
      prepareSettlement: vi.fn().mockReturnValue({
        capitalSourceKey: "arena-stafi-managed-pool",
        capitalSourceType: "ARENA_STAFI_MANAGED_POOL",
        network: "Arena StaFi",
        operatorWallet: "0xProtofireOperatorWalletDemo",
        settlementReference: "arena_sim_123",
        onChainExecutionStatus: "SIMULATED",
        message: "Prepared settlement.",
      }),
    };

    const result = await createFactoringTransaction(deps, {
      userId: "user_1",
      importedInvoiceId: "invoice_1",
      settlementMethod: SettlementMethod.ACH,
      acceptTerms: true,
      bankAccountLabel: "Operating 4821",
    });

    expect(tx.factoringTransaction.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      transaction: {
        id: "transaction_existing",
        transactionReference: "FACT-EXISTING-9001",
        status: "PENDING",
      },
    });
  });
});
