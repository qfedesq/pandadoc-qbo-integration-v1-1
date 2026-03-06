import {
  FactoringEventType,
  FactoringLifecycleStatus,
  FactoringTransactionStatus,
  LedgerDirection,
  LedgerOwnerType,
  OnChainExecutionStatus,
  PoolTransactionType,
  SettlementMethod,
  type Prisma,
} from "@prisma/client";

import { arenaStafiGateway } from "@/lib/arena-stafi/gateway";
import {
  getFactoringInvoiceForUser,
  getFactoringTransactionForUser,
  getOrCreateManagedCapitalSource,
  upsertFactoringOffer,
} from "@/lib/db/factoring";
import { prisma } from "@/lib/db/prisma";
import { evaluateFactoringEligibility } from "@/lib/factoring/eligibility";
import {
  calculateFactoringOffer,
  getSettlementMethodDetail,
} from "@/lib/factoring/offers";
import {
  DEFAULT_MARKETPLACE_NODE,
  getAccountingSystemForProvider,
} from "@/lib/factoring/marketplace";
import { logger } from "@/lib/logging/logger";
import { createOpaqueToken } from "@/lib/security/hash";
import { AppError } from "@/lib/utils/errors";

type DestinationInput = {
  walletAddress?: string;
  bankAccountLabel?: string;
  debitCardLabel?: string;
};

type CreateFactoringTransactionInput = DestinationInput & {
  userId: string;
  importedInvoiceId: string;
  settlementMethod: SettlementMethod;
  acceptTerms: boolean;
};

type TransitionFactoringTransactionInput = {
  userId: string;
  transactionId: string;
  targetStatus: "FUNDED" | "REPAID";
};

type TransactionDeps = {
  getInvoice: typeof getFactoringInvoiceForUser;
  getCapitalSource: typeof getOrCreateManagedCapitalSource;
  upsertOffer: typeof upsertFactoringOffer;
  prepareSettlement: typeof arenaStafiGateway.prepareSettlement;
};

type TransactionClient = Prisma.TransactionClient;

const createTransactionDeps: TransactionDeps = {
  getInvoice: getFactoringInvoiceForUser,
  getCapitalSource: getOrCreateManagedCapitalSource,
  upsertOffer: upsertFactoringOffer,
  prepareSettlement: arenaStafiGateway.prepareSettlement,
};

const transactionDetailInclude = {
  importedInvoice: {
    include: {
      documentLinks: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  },
  factoringOffer: true,
  capitalSource: true,
  poolTransactions: {
    orderBy: {
      createdAt: "asc",
    },
  },
  walletLedgers: {
    orderBy: {
      createdAt: "asc",
    },
  },
  events: {
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.FactoringTransactionInclude;

function sanitizeDestinationLabel(value: string | undefined) {
  return value?.trim() ?? "";
}

function maskWalletAddress(value: string) {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeLastFour(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 4) {
    throw new AppError(
      "Provide at least the last four digits for the selected settlement method.",
      400,
      "INVALID_SETTLEMENT_DESTINATION",
    );
  }

  return digits.slice(-4);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: number | string | { toString(): string } | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
}

function toMoney(value: number) {
  return roundCurrency(value).toFixed(2);
}

function buildSettlementDestination(
  method: SettlementMethod,
  input: DestinationInput,
) {
  if (method === SettlementMethod.USDC_WALLET) {
    const walletAddress = sanitizeDestinationLabel(input.walletAddress);

    if (walletAddress.length < 10) {
      throw new AppError(
        "A wallet address is required for USDC settlement.",
        400,
        "INVALID_SETTLEMENT_DESTINATION",
      );
    }

    return {
      settlementDestinationMasked: `Wallet ${maskWalletAddress(walletAddress)}`,
      sellerWalletAddress: walletAddress,
      metadata: {
        destinationType: "wallet",
      } satisfies Prisma.InputJsonObject,
    };
  }

  if (method === SettlementMethod.ACH) {
    const lastFour = normalizeLastFour(
      sanitizeDestinationLabel(input.bankAccountLabel),
    );

    return {
      settlementDestinationMasked: `ACH ••${lastFour}`,
      sellerWalletAddress: null,
      metadata: {
        destinationType: "ach",
        bankAccountLast4: lastFour,
      } satisfies Prisma.InputJsonObject,
    };
  }

  const lastFour = normalizeLastFour(sanitizeDestinationLabel(input.debitCardLabel));

  return {
    settlementDestinationMasked: `Debit card ••${lastFour}`,
    sellerWalletAddress: null,
    metadata: {
      destinationType: "debit-card",
      debitCardLast4: lastFour,
    } satisfies Prisma.InputJsonObject,
  };
}

function buildTransactionReference() {
  return `FACT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${createOpaqueToken(6).toUpperCase()}`;
}

function offerChanged(
  existing: {
    eligibilityStatus: string;
    ineligibilityReason: string | null;
    grossAmount: { toString(): string };
    advanceRateBps: number;
    advanceAmount: { toString(): string };
    discountRateBps: number;
    discountAmount: { toString(): string };
    operatorFeeBps: number;
    operatorFeeAmount: { toString(): string };
    netProceeds: { toString(): string };
    expectedRepaymentAmount: { toString(): string };
    riskTier: string;
  } | null,
  calculated: ReturnType<typeof calculateFactoringOffer>,
) {
  if (!existing) {
    return true;
  }

  return (
    existing.eligibilityStatus !== calculated.eligibility.status ||
    existing.ineligibilityReason !== calculated.eligibility.reason ||
    existing.grossAmount.toString() !== toMoney(calculated.grossAmount) ||
    existing.advanceRateBps !== calculated.advanceRateBps ||
    existing.advanceAmount.toString() !== toMoney(calculated.advanceAmount) ||
    existing.discountRateBps !== calculated.discountRateBps ||
    existing.discountAmount.toString() !== toMoney(calculated.discountAmount) ||
    existing.operatorFeeBps !== calculated.operatorFeeBps ||
    existing.operatorFeeAmount.toString() !== toMoney(calculated.operatorFeeAmount) ||
    existing.netProceeds.toString() !== toMoney(calculated.netProceeds) ||
    existing.expectedRepaymentAmount.toString() !==
      toMoney(calculated.expectedRepaymentAmount) ||
    existing.riskTier !== calculated.riskTier
  );
}

async function hydrateTransaction(tx: TransactionClient, transactionId: string) {
  return tx.factoringTransaction.findUniqueOrThrow({
    where: {
      id: transactionId,
    },
    include: transactionDetailInclude,
  });
}

async function createWalletLedgerEntry(
  tx: TransactionClient,
  input: {
    organizationId?: string | null;
    capitalSourceId?: string | null;
    factoringTransactionId?: string | null;
    ownerType: LedgerOwnerType;
    ownerId: string;
    entryType: string;
    direction: LedgerDirection;
    currency: string;
    amount: number;
    description: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  const latest = await tx.walletLedger.findFirst({
    where: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      currency: input.currency,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const currentBalance = toNumber(latest?.balanceAfter);
  const nextBalance =
    input.direction === LedgerDirection.CREDIT
      ? currentBalance + input.amount
      : currentBalance - input.amount;

  return tx.walletLedger.create({
    data: {
      organizationId: input.organizationId,
      capitalSourceId: input.capitalSourceId,
      factoringTransactionId: input.factoringTransactionId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      entryType: input.entryType,
      direction: input.direction,
      currency: input.currency,
      amount: toMoney(input.amount),
      balanceAfter: toMoney(nextBalance),
      description: input.description,
      metadata: input.metadata,
    },
  });
}

async function setInvoiceLifecycleStatus(
  tx: TransactionClient,
  input: {
    invoiceId: string;
    status: FactoringLifecycleStatus;
    fundedAt?: Date | null;
    repaidAt?: Date | null;
  },
) {
  return tx.importedInvoice.update({
    where: {
      id: input.invoiceId,
    },
    data: {
      factoringLifecycleStatus: input.status,
      fundedAt: input.fundedAt,
      repaidAt: input.repaidAt,
    },
  });
}

async function bookFunding(
  tx: TransactionClient,
  input: {
    organizationId?: string | null;
    userId: string;
    importedInvoiceId: string;
    transactionId: string;
    capitalSourceId: string;
    operatorWallet: string | null;
    settlementReference: string | null;
    onChainExecutionStatus: OnChainExecutionStatus;
    settlementCurrency: string;
    netProceeds: number;
  },
) {
  const capitalSource = await tx.capitalSource.findUniqueOrThrow({
    where: {
      id: input.capitalSourceId,
    },
  });

  const availableLiquidity = toNumber(capitalSource.availableLiquidity);
  const deployedLiquidity = toNumber(capitalSource.deployedLiquidity);

  if (availableLiquidity < input.netProceeds) {
    throw new AppError(
      "The pool does not have enough available liquidity to fund this invoice.",
      409,
      "INSUFFICIENT_POOL_LIQUIDITY",
    );
  }

  const fundedAt = new Date();
  const nextAvailable = roundCurrency(availableLiquidity - input.netProceeds);
  const nextDeployed = roundCurrency(deployedLiquidity + input.netProceeds);

  await tx.capitalSource.update({
    where: {
      id: input.capitalSourceId,
    },
    data: {
      availableLiquidity: toMoney(nextAvailable),
      deployedLiquidity: toMoney(nextDeployed),
    },
  });

  await tx.poolTransaction.create({
    data: {
      organizationId: input.organizationId,
      capitalSourceId: input.capitalSourceId,
      factoringTransactionId: input.transactionId,
      transactionType: PoolTransactionType.FUNDING_DISBURSED,
      currency: input.settlementCurrency,
      amount: toMoney(input.netProceeds),
      principalAmount: toMoney(input.netProceeds),
      yieldAmount: "0.00",
      feeAmount: "0.00",
      metadata: {
        settlementReference: input.settlementReference,
      },
    },
  });

  await createWalletLedgerEntry(tx, {
    organizationId: input.organizationId,
    capitalSourceId: input.capitalSourceId,
    factoringTransactionId: input.transactionId,
    ownerType: LedgerOwnerType.POOL,
    ownerId: input.capitalSourceId,
    entryType: "funding_disbursement",
    direction: LedgerDirection.DEBIT,
    currency: input.settlementCurrency,
    amount: input.netProceeds,
    description: "Pool capital reserved and disbursed to the seller.",
    metadata: {
      settlementReference: input.settlementReference,
    },
  });

  await createWalletLedgerEntry(tx, {
    organizationId: input.organizationId,
    capitalSourceId: input.capitalSourceId,
    factoringTransactionId: input.transactionId,
    ownerType: LedgerOwnerType.SELLER,
    ownerId: input.userId,
    entryType: "seller_usdc_disbursement",
    direction: LedgerDirection.CREDIT,
    currency: input.settlementCurrency,
    amount: input.netProceeds,
    description: "Seller received capital in the demo USDC wallet.",
  });

  await tx.factoringTransaction.update({
    where: {
      id: input.transactionId,
    },
    data: {
      status: FactoringTransactionStatus.FUNDED,
      fundedAt,
      onChainExecutionStatus: input.onChainExecutionStatus,
      operatorWallet: input.operatorWallet ?? undefined,
    },
  });

  await setInvoiceLifecycleStatus(tx, {
    invoiceId: input.importedInvoiceId,
    status: FactoringLifecycleStatus.FUNDED,
    fundedAt,
  });

  await tx.factoringEventLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      importedInvoiceId: input.importedInvoiceId,
      factoringTransactionId: input.transactionId,
      eventType: FactoringEventType.CAPITAL_DISBURSED,
      statusFrom: FactoringTransactionStatus.PENDING,
      statusTo: FactoringTransactionStatus.FUNDED,
      message: "Capital disbursed and the invoice is now funded.",
      metadata: {
        netProceeds: input.netProceeds,
        settlementReference: input.settlementReference,
      },
    },
  });
}

async function bookRepayment(
  tx: TransactionClient,
  input: {
    organizationId?: string | null;
    userId: string;
    transaction: Awaited<ReturnType<typeof getFactoringTransactionForUser>>;
  },
) {
  if (!input.transaction) {
    throw new AppError(
      "Factoring transaction not found.",
      404,
      "FACTORING_TRANSACTION_NOT_FOUND",
    );
  }

  const capitalSource = await tx.capitalSource.findUniqueOrThrow({
    where: {
      id: input.transaction.capitalSourceId,
    },
  });

  const principalAmount = toNumber(input.transaction.principalAmount);
  const poolYieldAmount = toNumber(input.transaction.poolYieldAmount);
  const operatorFeeAmount = toNumber(input.transaction.operatorFeeAmount);
  const expectedRepaymentAmount = toNumber(input.transaction.expectedRepaymentAmount);
  const availableLiquidity = toNumber(capitalSource.availableLiquidity);
  const deployedLiquidity = toNumber(capitalSource.deployedLiquidity);
  const accruedYield = toNumber(capitalSource.accruedYield);
  const protocolFeesCollected = toNumber(capitalSource.protocolFeesCollected);
  const totalLiquidity = toNumber(capitalSource.totalLiquidity);

  await tx.factoringEventLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      importedInvoiceId: input.transaction.importedInvoiceId,
      factoringTransactionId: input.transaction.id,
      eventType: FactoringEventType.REPAYMENT_PENDING,
      statusFrom: input.transaction.status,
      statusTo: input.transaction.status,
      message: "Repayment simulation started for the funded invoice.",
      metadata: {
        expectedRepaymentAmount,
      },
    },
  });

  const repaidAt = new Date();
  const nextAvailable = roundCurrency(
    availableLiquidity + principalAmount + poolYieldAmount,
  );
  const nextDeployed = roundCurrency(Math.max(deployedLiquidity - principalAmount, 0));
  const nextAccruedYield = roundCurrency(accruedYield + poolYieldAmount);
  const nextProtocolFees = roundCurrency(protocolFeesCollected + operatorFeeAmount);
  const nextTotalLiquidity = roundCurrency(totalLiquidity + poolYieldAmount);

  await tx.capitalSource.update({
    where: {
      id: input.transaction.capitalSourceId,
    },
    data: {
      availableLiquidity: toMoney(nextAvailable),
      deployedLiquidity: toMoney(nextDeployed),
      accruedYield: toMoney(nextAccruedYield),
      protocolFeesCollected: toMoney(nextProtocolFees),
      totalLiquidity: toMoney(nextTotalLiquidity),
    },
  });

  await tx.poolTransaction.createMany({
    data: [
      {
        organizationId: input.organizationId,
        capitalSourceId: input.transaction.capitalSourceId,
        factoringTransactionId: input.transaction.id,
        transactionType: PoolTransactionType.REPAYMENT_RECEIVED,
        currency: input.transaction.settlementCurrency,
        amount: toMoney(expectedRepaymentAmount),
        principalAmount: toMoney(principalAmount),
        yieldAmount: toMoney(poolYieldAmount),
        feeAmount: toMoney(operatorFeeAmount),
        metadata: {
          source: "repayment-simulation",
        },
      },
      {
        organizationId: input.organizationId,
        capitalSourceId: input.transaction.capitalSourceId,
        factoringTransactionId: input.transaction.id,
        transactionType: PoolTransactionType.YIELD_BOOKED,
        currency: input.transaction.settlementCurrency,
        amount: toMoney(poolYieldAmount),
        principalAmount: "0.00",
        yieldAmount: toMoney(poolYieldAmount),
        feeAmount: "0.00",
        metadata: {
          source: "repayment-simulation",
        },
      },
      {
        organizationId: input.organizationId,
        capitalSourceId: input.transaction.capitalSourceId,
        factoringTransactionId: input.transaction.id,
        transactionType: PoolTransactionType.PROTOCOL_FEE_BOOKED,
        currency: input.transaction.settlementCurrency,
        amount: toMoney(operatorFeeAmount),
        principalAmount: "0.00",
        yieldAmount: "0.00",
        feeAmount: toMoney(operatorFeeAmount),
        metadata: {
          source: "repayment-simulation",
        },
      },
    ],
  });

  await createWalletLedgerEntry(tx, {
    organizationId: input.organizationId,
    capitalSourceId: input.transaction.capitalSourceId,
    factoringTransactionId: input.transaction.id,
    ownerType: LedgerOwnerType.POOL,
    ownerId: input.transaction.capitalSourceId,
    entryType: "repayment_received",
    direction: LedgerDirection.CREDIT,
    currency: input.transaction.settlementCurrency,
    amount: principalAmount + poolYieldAmount,
    description: "Pool principal returned and yield accrued.",
  });

  await createWalletLedgerEntry(tx, {
    organizationId: input.organizationId,
    capitalSourceId: input.transaction.capitalSourceId,
    factoringTransactionId: input.transaction.id,
    ownerType: LedgerOwnerType.OPERATOR,
    ownerId: input.transaction.operatorWallet ?? "protofire-operator",
    entryType: "protocol_fee_credit",
    direction: LedgerDirection.CREDIT,
    currency: input.transaction.settlementCurrency,
    amount: operatorFeeAmount,
    description: "Operator fee recorded from invoice repayment.",
  });

  await tx.factoringTransaction.update({
    where: {
      id: input.transaction.id,
    },
    data: {
      status: FactoringTransactionStatus.REPAID,
      repaidAt,
    },
  });

  await setInvoiceLifecycleStatus(tx, {
    invoiceId: input.transaction.importedInvoiceId,
    status: FactoringLifecycleStatus.REPAID,
    fundedAt: input.transaction.fundedAt,
    repaidAt,
  });

  await tx.factoringEventLog.createMany({
    data: [
      {
        organizationId: input.organizationId,
        userId: input.userId,
        importedInvoiceId: input.transaction.importedInvoiceId,
        factoringTransactionId: input.transaction.id,
        eventType: FactoringEventType.REPAYMENT_RECORDED,
        statusFrom: input.transaction.status,
        statusTo: FactoringTransactionStatus.REPAID,
        message: "Repayment recorded and the factoring position is now closed.",
        metadata: {
          expectedRepaymentAmount,
          principalAmount,
        },
      },
      {
        organizationId: input.organizationId,
        userId: input.userId,
        importedInvoiceId: input.transaction.importedInvoiceId,
        factoringTransactionId: input.transaction.id,
        eventType: FactoringEventType.POOL_DISTRIBUTION_BOOKED,
        message: "Pool principal, yield, and operator fees booked to the ledger.",
        metadata: {
          poolYieldAmount,
          operatorFeeAmount,
        },
      },
    ],
  });
}

export async function ensureFactoringOffer(
  deps: Pick<TransactionDeps, "getInvoice" | "getCapitalSource" | "upsertOffer">,
  input: {
    userId: string;
    importedInvoiceId: string;
  },
) {
  const [invoice, capitalSource] = await Promise.all([
    deps.getInvoice(input),
    deps.getCapitalSource(),
  ]);

  if (!invoice) {
    throw new AppError("Imported invoice not found.", 404, "INVOICE_NOT_FOUND");
  }

  const organizationId =
    invoice.organizationId ?? invoice.user?.organizationId ?? null;
  const calculated = calculateFactoringOffer(
    {
      importedInvoiceId: invoice.id,
      providerInvoiceId: invoice.providerInvoiceId,
      docNumber: invoice.docNumber,
      counterpartyName: invoice.counterpartyName,
      normalizedStatus: invoice.normalizedStatus,
      balanceAmount: invoice.balanceAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      transactions: invoice.factoringTransactions,
    },
    capitalSource,
  );

  const offer = await deps.upsertOffer({
    userId: input.userId,
    organizationId,
    importedInvoiceId: invoice.id,
    capitalSourceId: capitalSource.id,
    marketplaceNode: DEFAULT_MARKETPLACE_NODE,
    accountingSystem: getAccountingSystemForProvider(invoice.provider),
    eligibilityStatus: calculated.eligibility.status,
    ineligibilityReason: calculated.eligibility.reason,
    grossAmount: toMoney(calculated.grossAmount),
    advanceRateBps: calculated.advanceRateBps,
    advanceAmount: toMoney(calculated.advanceAmount),
    discountRateBps: calculated.discountRateBps,
    discountAmount: toMoney(calculated.discountAmount),
    operatorFeeBps: calculated.operatorFeeBps,
    operatorFeeAmount: toMoney(calculated.operatorFeeAmount),
    netProceeds: toMoney(calculated.netProceeds),
    expectedRepaymentAmount: toMoney(calculated.expectedRepaymentAmount),
    expectedMaturityDate: calculated.expectedMaturityDate,
    riskTier: calculated.riskTier,
    settlementCurrency: calculated.settlementCurrency,
    settlementTimeSummary: calculated.settlementTimeSummary,
    termsSnapshot: calculated.termsSnapshot,
    generatedAt: new Date(),
  });

  const terminalStates = new Set<FactoringLifecycleStatus>([
    FactoringLifecycleStatus.FUNDED,
    FactoringLifecycleStatus.REPAYMENT_PENDING,
    FactoringLifecycleStatus.REPAID,
    FactoringLifecycleStatus.DEFAULTED,
  ]);

  const nextLifecycleStatus = terminalStates.has(invoice.factoringLifecycleStatus)
    ? invoice.factoringLifecycleStatus
    : calculated.eligibility.eligible
      ? FactoringLifecycleStatus.ELIGIBLE
      : FactoringLifecycleStatus.IMPORTED;

  if (invoice.factoringLifecycleStatus !== nextLifecycleStatus) {
    await prisma.importedInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        factoringLifecycleStatus: nextLifecycleStatus,
      },
    });
    invoice.factoringLifecycleStatus = nextLifecycleStatus;
  }

  if (offerChanged(invoice.factoringOffer, calculated)) {
    await prisma.factoringEventLog.create({
      data: {
        organizationId,
        userId: input.userId,
        importedInvoiceId: invoice.id,
        eventType: FactoringEventType.OFFER_GENERATED,
        message: calculated.eligibility.eligible
          ? "Factoring terms refreshed for the invoice."
          : `Offer refreshed but the invoice remains ineligible: ${calculated.eligibility.reason}`,
        metadata: {
          advanceRateBps: calculated.advanceRateBps,
          discountRateBps: calculated.discountRateBps,
          netProceeds: calculated.netProceeds,
          expectedRepaymentAmount: calculated.expectedRepaymentAmount,
          riskTier: calculated.riskTier,
          eligibilityStatus: calculated.eligibility.status,
        },
      },
    });
  }

  return {
    invoice,
    capitalSource,
    offer,
    calculated,
  };
}

export async function ensureFactoringOfferForUser(input: {
  userId: string;
  importedInvoiceId: string;
}) {
  return ensureFactoringOffer(createTransactionDeps, input);
}

export async function createFactoringTransaction(
  deps: TransactionDeps,
  input: CreateFactoringTransactionInput,
) {
  if (!input.acceptTerms) {
    throw new AppError(
      "You must accept the factoring terms before continuing.",
      400,
      "TERMS_NOT_ACCEPTED",
    );
  }

  const { invoice, capitalSource, offer, calculated } =
    await ensureFactoringOffer(deps, {
      userId: input.userId,
      importedInvoiceId: input.importedInvoiceId,
    });

  const organizationId =
    invoice.organizationId ?? invoice.user?.organizationId ?? null;
  const eligibility = evaluateFactoringEligibility({
    balanceAmount: invoice.balanceAmount,
    dueDate: invoice.dueDate,
    normalizedStatus: invoice.normalizedStatus,
    transactions: invoice.factoringTransactions,
  });

  if (!eligibility.eligible || !calculated.eligibility.eligible) {
    throw new AppError(
      calculated.eligibility.reason ??
        eligibility.reason ??
        "This invoice is not eligible for factoring.",
      409,
      "INVOICE_NOT_ELIGIBLE",
    );
  }

  const settlement = buildSettlementDestination(input.settlementMethod, input);
  const transactionReference = buildTransactionReference();
  const settlementMethod = getSettlementMethodDetail(input.settlementMethod);
  const preparedSettlement = deps.prepareSettlement({
    importedInvoiceId: invoice.id,
    transactionReference,
    settlementMethod: input.settlementMethod,
    netProceeds: calculated.netProceeds,
    destinationMasked: settlement.settlementDestinationMasked,
  });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.factoringTransaction.findFirst({
      where: {
        userId: input.userId,
        importedInvoiceId: invoice.id,
        status: {
          in: [FactoringTransactionStatus.PENDING, FactoringTransactionStatus.FUNDED],
        },
      },
      include: transactionDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existing) {
      return {
        created: false,
        transaction: existing,
      };
    }

    const reservedAt = new Date();
    const transaction = await tx.factoringTransaction.create({
      data: {
        transactionReference,
        userId: input.userId,
        organizationId,
        importedInvoiceId: invoice.id,
        factoringOfferId: offer.id,
        capitalSourceId: capitalSource.id,
        marketplaceNode: DEFAULT_MARKETPLACE_NODE,
        accountingSystem: getAccountingSystemForProvider(invoice.provider),
        status: FactoringTransactionStatus.PENDING,
        settlementMethod: input.settlementMethod,
        settlementDestinationMasked: settlement.settlementDestinationMasked,
        sellerWalletAddress: settlement.sellerWalletAddress,
        invoiceCurrency: invoice.currency,
        settlementCurrency: calculated.settlementCurrency,
        grossAmount: toMoney(calculated.grossAmount),
        advanceRateBps: calculated.advanceRateBps,
        advanceAmount: toMoney(calculated.advanceAmount),
        principalAmount: toMoney(calculated.netProceeds),
        discountRateBps: calculated.discountRateBps,
        discountAmount: toMoney(calculated.discountAmount),
        operatorFeeBps: calculated.operatorFeeBps,
        operatorFeeAmount: toMoney(calculated.operatorFeeAmount),
        poolYieldAmount: toMoney(calculated.poolYieldAmount),
        netProceeds: toMoney(calculated.netProceeds),
        expectedRepaymentAmount: toMoney(calculated.expectedRepaymentAmount),
        maturityDate: calculated.expectedMaturityDate,
        riskTier: calculated.riskTier,
        settlementTimeLabel: settlementMethod.settlementTimeLabel,
        termsAcceptedAt: reservedAt,
        reservedAt,
        operatorWallet: preparedSettlement.operatorWallet,
        arenaSettlementReference: preparedSettlement.settlementReference,
        onChainExecutionStatus: preparedSettlement.onChainExecutionStatus,
        metadata: {
          ...settlement.metadata,
          capitalSourceKey: preparedSettlement.capitalSourceKey,
          network: preparedSettlement.network,
          simulation: true,
        },
      },
    });

    await tx.factoringEventLog.createMany({
      data: [
        {
          organizationId,
          userId: input.userId,
          importedInvoiceId: invoice.id,
          factoringTransactionId: transaction.id,
          eventType: FactoringEventType.TERMS_ACCEPTED,
          message: `Terms accepted for ${settlementMethod.label.toLowerCase()} settlement.`,
          metadata: {
            settlementMethod: input.settlementMethod,
            settlementDestinationMasked: settlement.settlementDestinationMasked,
            advanceRateBps: calculated.advanceRateBps,
            discountRateBps: calculated.discountRateBps,
          },
        },
        {
          organizationId,
          userId: input.userId,
          importedInvoiceId: invoice.id,
          factoringTransactionId: transaction.id,
          eventType: FactoringEventType.TRANSACTION_CREATED,
          statusTo: FactoringTransactionStatus.PENDING,
          message: "Factoring position created and submitted for funding.",
          metadata: {
            transactionReference,
            netProceeds: calculated.netProceeds,
            settlementCurrency: calculated.settlementCurrency,
          },
        },
        {
          organizationId,
          userId: input.userId,
          importedInvoiceId: invoice.id,
          factoringTransactionId: transaction.id,
          eventType: FactoringEventType.FUNDS_RESERVED,
          statusTo: FactoringTransactionStatus.PENDING,
          message: "Pool funds reserved for the seller withdrawal.",
          metadata: {
            reservedAt: reservedAt.toISOString(),
          },
        },
        {
          organizationId,
          userId: input.userId,
          importedInvoiceId: invoice.id,
          factoringTransactionId: transaction.id,
          eventType: FactoringEventType.ARENA_SETTLEMENT_PREPARED,
          statusTo: FactoringTransactionStatus.PENDING,
          message: preparedSettlement.message,
          metadata: {
            capitalSourceKey: preparedSettlement.capitalSourceKey,
            settlementReference: preparedSettlement.settlementReference,
            network: preparedSettlement.network,
            onChainExecutionStatus: preparedSettlement.onChainExecutionStatus,
          },
        },
      ],
    });

    await bookFunding(tx, {
      organizationId,
      userId: input.userId,
      importedInvoiceId: invoice.id,
      transactionId: transaction.id,
      capitalSourceId: capitalSource.id,
      operatorWallet: preparedSettlement.operatorWallet ?? null,
      settlementReference: preparedSettlement.settlementReference ?? null,
      onChainExecutionStatus: preparedSettlement.onChainExecutionStatus,
      settlementCurrency: calculated.settlementCurrency,
      netProceeds: calculated.netProceeds,
    });

    return {
      created: true,
      transaction: await hydrateTransaction(tx, transaction.id),
    };
  });

  logger.info("factoring.transaction_created", {
    created: result.created,
    transactionId: result.transaction.id,
    importedInvoiceId: invoice.id,
    settlementMethod: input.settlementMethod,
  });

  return result;
}

export async function createFactoringTransactionForUser(
  input: CreateFactoringTransactionInput,
) {
  return createFactoringTransaction(createTransactionDeps, input);
}

export async function transitionFactoringTransactionForUser(
  input: TransitionFactoringTransactionInput,
) {
  const transaction = await getFactoringTransactionForUser({
    userId: input.userId,
    transactionId: input.transactionId,
  });

  if (!transaction) {
    throw new AppError(
      "Factoring transaction not found.",
      404,
      "FACTORING_TRANSACTION_NOT_FOUND",
    );
  }

  if (
    input.targetStatus === FactoringTransactionStatus.FUNDED &&
    transaction.status !== FactoringTransactionStatus.PENDING
  ) {
    throw new AppError(
      "Only pending transactions can be marked as funded.",
      409,
      "INVALID_TRANSACTION_TRANSITION",
    );
  }

  if (
    input.targetStatus === FactoringTransactionStatus.REPAID &&
    transaction.status !== FactoringTransactionStatus.FUNDED
  ) {
    throw new AppError(
      "Only funded transactions can be marked as repaid.",
      409,
      "INVALID_TRANSACTION_TRANSITION",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const organizationId =
      transaction.organizationId ?? transaction.importedInvoice.organizationId ?? null;

    if (input.targetStatus === FactoringTransactionStatus.FUNDED) {
      await bookFunding(tx, {
        organizationId,
        userId: input.userId,
        importedInvoiceId: transaction.importedInvoiceId,
        transactionId: transaction.id,
        capitalSourceId: transaction.capitalSourceId,
        operatorWallet: transaction.operatorWallet ?? null,
        settlementReference: transaction.arenaSettlementReference ?? null,
        onChainExecutionStatus:
          transaction.onChainExecutionStatus === OnChainExecutionStatus.NOT_STARTED
            ? OnChainExecutionStatus.SIMULATED
            : transaction.onChainExecutionStatus,
        settlementCurrency: transaction.settlementCurrency,
        netProceeds: toNumber(transaction.netProceeds),
      });
    } else {
      await bookRepayment(tx, {
        organizationId,
        userId: input.userId,
        transaction,
      });
    }

    return hydrateTransaction(tx, transaction.id);
  });

  logger.info("factoring.transaction_transitioned", {
    transactionId: updated.id,
    from: transaction.status,
    to: input.targetStatus,
  });

  return updated;
}
