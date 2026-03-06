import {
  AccountingSystem,
  CapitalSourceType,
  FactoringEligibilityStatus,
  FactoringEventType,
  FactoringLifecycleStatus,
  FactoringTransactionStatus,
  InvoiceStatus,
  LedgerDirection,
  LedgerOwnerType,
  MarketplaceNode,
  OnChainExecutionStatus,
  PoolTransactionType,
  Provider,
  RiskTier,
  SettlementMethod,
  PrismaClient,
} from "@prisma/client";

import { hashPassword } from "../lib/auth/passwords";
import { env } from "../lib/env";
import { encryptSecret } from "../lib/security/encryption";

const prisma = new PrismaClient();

async function seedOrganization() {
  return prisma.organization.upsert({
    where: {
      slug: "protofire-demo-saas",
    },
    update: {
      name: "Protofire Demo SaaS",
    },
    create: {
      slug: "protofire-demo-saas",
      name: "Protofire Demo SaaS",
    },
  });
}

async function seedAdminUser(organizationId: string) {
  const passwordHash = await hashPassword(env.DEFAULT_ADMIN_PASSWORD);

  return prisma.user.upsert({
    where: {
      email: env.DEFAULT_ADMIN_EMAIL.toLowerCase(),
    },
    update: {
      passwordHash,
      name: "Admin User",
      organizationId,
    },
    create: {
      email: env.DEFAULT_ADMIN_EMAIL.toLowerCase(),
      name: "Admin User",
      passwordHash,
      organizationId,
    },
  });
}

async function seedDemoData(userId: string, organizationId: string) {
  const pandaDocConnection = await prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: Provider.PANDADOC,
      },
    },
    update: {
      organizationId,
      status: "CONNECTED",
      displayName: "Morgan Panda",
      externalAccountId: "pd_user_demo",
      externalAccountName: "PandaDoc Demo Workspace",
      scopes: ["read", "write"],
      metadata: {
        email: "morgan@example.com",
        workspaceId: "workspace_demo",
        workspaceName: "PandaDoc Demo Workspace",
      },
    },
    create: {
      userId,
      organizationId,
      provider: Provider.PANDADOC,
      status: "CONNECTED",
      displayName: "Morgan Panda",
      externalAccountId: "pd_user_demo",
      externalAccountName: "PandaDoc Demo Workspace",
      scopes: ["read", "write"],
      metadata: {
        email: "morgan@example.com",
        workspaceId: "workspace_demo",
        workspaceName: "PandaDoc Demo Workspace",
      },
    },
  });

  await prisma.oAuthToken.upsert({
    where: {
      connectionId: pandaDocConnection.id,
    },
    update: {
      accessTokenEncrypted: encryptSecret("pandadoc-demo-access-token"),
      refreshTokenEncrypted: encryptSecret("pandadoc-demo-refresh-token"),
      accessTokenExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      refreshTokenExpiresAt: new Date("2030-06-01T00:00:00.000Z"),
      tokenType: "Bearer",
      scope: "read write",
    },
    create: {
      connectionId: pandaDocConnection.id,
      accessTokenEncrypted: encryptSecret("pandadoc-demo-access-token"),
      refreshTokenEncrypted: encryptSecret("pandadoc-demo-refresh-token"),
      accessTokenExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      refreshTokenExpiresAt: new Date("2030-06-01T00:00:00.000Z"),
      tokenType: "Bearer",
      scope: "read write",
    },
  });

  const quickBooksConnection = await prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: Provider.QUICKBOOKS,
      },
    },
    update: {
      organizationId,
      status: "CONNECTED",
      displayName: "Demo Manufacturing LLC",
      externalAccountId: "9130357992222222",
      externalAccountName: "Demo Manufacturing LLC",
      scopes: ["com.intuit.quickbooks.accounting"],
      lastSyncAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: {
        realmId: "9130357992222222",
        mode: "mock",
      },
    },
    create: {
      userId,
      organizationId,
      provider: Provider.QUICKBOOKS,
      status: "CONNECTED",
      displayName: "Demo Manufacturing LLC",
      externalAccountId: "9130357992222222",
      externalAccountName: "Demo Manufacturing LLC",
      scopes: ["com.intuit.quickbooks.accounting"],
      lastSyncAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: {
        realmId: "9130357992222222",
        mode: "mock",
      },
    },
  });

  await prisma.oAuthToken.upsert({
    where: {
      connectionId: quickBooksConnection.id,
    },
    update: {
      accessTokenEncrypted: encryptSecret("quickbooks-demo-access-token"),
      refreshTokenEncrypted: encryptSecret("quickbooks-demo-refresh-token"),
      accessTokenExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      refreshTokenExpiresAt: new Date("2030-06-01T00:00:00.000Z"),
      tokenType: "Bearer",
      scope: "com.intuit.quickbooks.accounting",
    },
    create: {
      connectionId: quickBooksConnection.id,
      accessTokenEncrypted: encryptSecret("quickbooks-demo-access-token"),
      refreshTokenEncrypted: encryptSecret("quickbooks-demo-refresh-token"),
      accessTokenExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      refreshTokenExpiresAt: new Date("2030-06-01T00:00:00.000Z"),
      tokenType: "Bearer",
      scope: "com.intuit.quickbooks.accounting",
    },
  });

  const existingCompany = await prisma.quickBooksCompany.findFirst({
    where: {
      OR: [
        {
          connectionId: quickBooksConnection.id,
        },
        {
          realmId: "9130357992222222",
        },
      ],
    },
  });

  const company = existingCompany
    ? await prisma.quickBooksCompany.update({
        where: {
          id: existingCompany.id,
        },
        data: {
          connectionId: quickBooksConnection.id,
          realmId: "9130357992222222",
          companyName: "Demo Manufacturing LLC",
          country: "US",
          currency: "USD",
          metadata: {
            source: "seed",
          },
        },
      })
    : await prisma.quickBooksCompany.create({
        data: {
          connectionId: quickBooksConnection.id,
          realmId: "9130357992222222",
          companyName: "Demo Manufacturing LLC",
          country: "US",
          currency: "USD",
          metadata: {
            source: "seed",
          },
        },
      });

  const invoices = [
    {
      providerInvoiceId: "9001",
      docNumber: "INV-9001",
      totalAmount: "1250.00",
      balanceAmount: "1250.00",
      dueDate: new Date("2026-03-20T00:00:00.000Z"),
      issueDate: new Date("2026-03-01T00:00:00.000Z"),
      counterpartyName: "Acme Holdings",
      counterpartyEmail: "billing@acme.example",
      normalizedStatus: InvoiceStatus.OPEN,
      factoringLifecycleStatus: FactoringLifecycleStatus.ELIGIBLE,
      lastSyncedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
    {
      providerInvoiceId: "9002",
      docNumber: "INV-9002",
      totalAmount: "980.00",
      balanceAmount: "980.00",
      dueDate: new Date("2026-02-20T00:00:00.000Z"),
      issueDate: new Date("2026-02-01T00:00:00.000Z"),
      counterpartyName: "Northwind Traders",
      counterpartyEmail: "ap@northwind.example",
      normalizedStatus: InvoiceStatus.OVERDUE,
      factoringLifecycleStatus: FactoringLifecycleStatus.IMPORTED,
      lastSyncedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
    {
      providerInvoiceId: "9003",
      docNumber: "INV-9003",
      totalAmount: "2400.00",
      balanceAmount: "600.00",
      dueDate: new Date("2026-03-15T00:00:00.000Z"),
      issueDate: new Date("2026-02-27T00:00:00.000Z"),
      counterpartyName: "Globex Corporation",
      counterpartyEmail: "finance@globex.example",
      normalizedStatus: InvoiceStatus.PARTIALLY_PAID,
      factoringLifecycleStatus: FactoringLifecycleStatus.FUNDED,
      fundedAt: new Date("2026-03-01T12:20:00.000Z"),
      lastSyncedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
    {
      providerInvoiceId: "9004",
      docNumber: "INV-9004",
      totalAmount: "1800.00",
      balanceAmount: "0.00",
      dueDate: new Date("2026-02-28T00:00:00.000Z"),
      issueDate: new Date("2026-02-05T00:00:00.000Z"),
      counterpartyName: "Pinnacle Analytics",
      counterpartyEmail: "finance@pinnacle.example",
      normalizedStatus: InvoiceStatus.PAID,
      factoringLifecycleStatus: FactoringLifecycleStatus.REPAID,
      fundedAt: new Date("2026-02-18T10:30:00.000Z"),
      repaidAt: new Date("2026-02-28T16:10:00.000Z"),
      lastSyncedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
  ];

  for (const invoice of invoices) {
    await prisma.importedInvoice.upsert({
      where: {
        connectionId_providerInvoiceId: {
          connectionId: quickBooksConnection.id,
          providerInvoiceId: invoice.providerInvoiceId,
        },
      },
      update: {
        organizationId,
        quickBooksCompanyId: company.id,
        provider: Provider.QUICKBOOKS,
        ...invoice,
        currency: "USD",
        rawPayload: {
          seeded: true,
          id: invoice.providerInvoiceId,
        },
      },
      create: {
        userId,
        organizationId,
        connectionId: quickBooksConnection.id,
        quickBooksCompanyId: company.id,
        provider: Provider.QUICKBOOKS,
        ...invoice,
        currency: "USD",
        rawPayload: {
          seeded: true,
          id: invoice.providerInvoiceId,
        },
      },
    });
  }

  const [invoice9001, invoice9002, invoice9003, invoice9004] = await Promise.all([
    prisma.importedInvoice.findUniqueOrThrow({
      where: {
        connectionId_providerInvoiceId: {
          connectionId: quickBooksConnection.id,
          providerInvoiceId: "9001",
        },
      },
    }),
    prisma.importedInvoice.findUniqueOrThrow({
      where: {
        connectionId_providerInvoiceId: {
          connectionId: quickBooksConnection.id,
          providerInvoiceId: "9002",
        },
      },
    }),
    prisma.importedInvoice.findUniqueOrThrow({
      where: {
        connectionId_providerInvoiceId: {
          connectionId: quickBooksConnection.id,
          providerInvoiceId: "9003",
        },
      },
    }),
    prisma.importedInvoice.findUniqueOrThrow({
      where: {
        connectionId_providerInvoiceId: {
          connectionId: quickBooksConnection.id,
          providerInvoiceId: "9004",
        },
      },
    }),
  ]);

  const capitalSource = await prisma.capitalSource.upsert({
    where: {
      key: "arena-stafi-managed-pool",
    },
    update: {
      name: "Protofire Arena StaFi Managed Pool",
      marketplaceNode: MarketplaceNode.PANDADOC,
      type: CapitalSourceType.ARENA_STAFI_MANAGED_POOL,
      network: "Arena StaFi",
      currency: "USDC",
      operatorWallet: "0xProtofireOperatorWalletDemo",
      liquiditySnapshot: "500000.00",
      totalLiquidity: "500064.80",
      availableLiquidity: "499573.93",
      deployedLiquidity: "490.87",
      accruedYield: "64.80",
      protocolFeesCollected: "8.10",
      targetAdvanceRateBps: 9000,
      operatorFeeBps: 50,
      metadata: {
        seeded: true,
      },
    },
    create: {
      key: "arena-stafi-managed-pool",
      name: "Protofire Arena StaFi Managed Pool",
      marketplaceNode: MarketplaceNode.PANDADOC,
      type: CapitalSourceType.ARENA_STAFI_MANAGED_POOL,
      network: "Arena StaFi",
      currency: "USDC",
      operatorWallet: "0xProtofireOperatorWalletDemo",
      liquiditySnapshot: "500000.00",
      totalLiquidity: "500064.80",
      availableLiquidity: "499573.93",
      deployedLiquidity: "490.87",
      accruedYield: "64.80",
      protocolFeesCollected: "8.10",
      targetAdvanceRateBps: 9000,
      operatorFeeBps: 50,
      metadata: {
        seeded: true,
      },
    },
  });

  const offers = [
    {
      invoice: invoice9001,
      eligibilityStatus: FactoringEligibilityStatus.ELIGIBLE,
      ineligibilityReason: null,
      grossAmount: "1250.00",
      advanceRateBps: 9000,
      advanceAmount: "1125.00",
      discountRateBps: 400,
      discountAmount: "45.00",
      operatorFeeBps: 50,
      operatorFeeAmount: "5.63",
      netProceeds: "1074.37",
      expectedRepaymentAmount: "1125.00",
      expectedMaturityDate: new Date("2026-03-20T00:00:00.000Z"),
      riskTier: RiskTier.LOW,
    },
    {
      invoice: invoice9002,
      eligibilityStatus: FactoringEligibilityStatus.INELIGIBLE,
      ineligibilityReason: "Overdue invoices are not eligible for the Tier 1 managed pool.",
      grossAmount: "980.00",
      advanceRateBps: 8500,
      advanceAmount: "833.00",
      discountRateBps: 475,
      discountAmount: "39.57",
      operatorFeeBps: 50,
      operatorFeeAmount: "4.17",
      netProceeds: "789.26",
      expectedRepaymentAmount: "833.00",
      expectedMaturityDate: new Date("2026-02-20T00:00:00.000Z"),
      riskTier: RiskTier.HIGH,
    },
    {
      invoice: invoice9003,
      eligibilityStatus: FactoringEligibilityStatus.INELIGIBLE,
      ineligibilityReason: "An active factoring transaction already exists for this invoice.",
      grossAmount: "600.00",
      advanceRateBps: 8500,
      advanceAmount: "510.00",
      discountRateBps: 325,
      discountAmount: "16.58",
      operatorFeeBps: 50,
      operatorFeeAmount: "2.55",
      netProceeds: "490.87",
      expectedRepaymentAmount: "510.00",
      expectedMaturityDate: new Date("2026-03-15T00:00:00.000Z"),
      riskTier: RiskTier.HIGH,
    },
    {
      invoice: invoice9004,
      eligibilityStatus: FactoringEligibilityStatus.INELIGIBLE,
      ineligibilityReason: "This invoice has already been repaid and closed.",
      grossAmount: "1800.00",
      advanceRateBps: 9000,
      advanceAmount: "1620.00",
      discountRateBps: 400,
      discountAmount: "64.80",
      operatorFeeBps: 50,
      operatorFeeAmount: "8.10",
      netProceeds: "1547.10",
      expectedRepaymentAmount: "1620.00",
      expectedMaturityDate: new Date("2026-02-28T00:00:00.000Z"),
      riskTier: RiskTier.MEDIUM,
    },
  ];

  for (const offer of offers) {
    await prisma.factoringOffer.upsert({
      where: {
        importedInvoiceId: offer.invoice.id,
      },
      update: {
        organizationId,
        capitalSourceId: capitalSource.id,
        marketplaceNode: MarketplaceNode.PANDADOC,
        accountingSystem: AccountingSystem.QUICKBOOKS,
        eligibilityStatus: offer.eligibilityStatus,
        ineligibilityReason: offer.ineligibilityReason,
        grossAmount: offer.grossAmount,
        advanceRateBps: offer.advanceRateBps,
        advanceAmount: offer.advanceAmount,
        discountRateBps: offer.discountRateBps,
        discountAmount: offer.discountAmount,
        operatorFeeBps: offer.operatorFeeBps,
        operatorFeeAmount: offer.operatorFeeAmount,
        netProceeds: offer.netProceeds,
        expectedRepaymentAmount: offer.expectedRepaymentAmount,
        expectedMaturityDate: offer.expectedMaturityDate,
        riskTier: offer.riskTier,
        settlementCurrency: "USDC",
        settlementTimeSummary:
          "USDC wallet: Within minutes / ACH: Same business day / Debit card: Within 30 minutes",
        termsSnapshot: {
          seeded: true,
          invoiceId: offer.invoice.providerInvoiceId,
        },
        generatedAt: new Date("2026-03-06T12:00:00.000Z"),
      },
      create: {
        userId,
        organizationId,
        importedInvoiceId: offer.invoice.id,
        capitalSourceId: capitalSource.id,
        marketplaceNode: MarketplaceNode.PANDADOC,
        accountingSystem: AccountingSystem.QUICKBOOKS,
        eligibilityStatus: offer.eligibilityStatus,
        ineligibilityReason: offer.ineligibilityReason,
        grossAmount: offer.grossAmount,
        advanceRateBps: offer.advanceRateBps,
        advanceAmount: offer.advanceAmount,
        discountRateBps: offer.discountRateBps,
        discountAmount: offer.discountAmount,
        operatorFeeBps: offer.operatorFeeBps,
        operatorFeeAmount: offer.operatorFeeAmount,
        netProceeds: offer.netProceeds,
        expectedRepaymentAmount: offer.expectedRepaymentAmount,
        expectedMaturityDate: offer.expectedMaturityDate,
        riskTier: offer.riskTier,
        settlementCurrency: "USDC",
        settlementTimeSummary:
          "USDC wallet: Within minutes / ACH: Same business day / Debit card: Within 30 minutes",
        termsSnapshot: {
          seeded: true,
          invoiceId: offer.invoice.providerInvoiceId,
        },
        generatedAt: new Date("2026-03-06T12:00:00.000Z"),
      },
    });
  }

  const offer9003 = await prisma.factoringOffer.findUniqueOrThrow({
    where: {
      importedInvoiceId: invoice9003.id,
    },
  });
  const offer9004 = await prisma.factoringOffer.findUniqueOrThrow({
    where: {
      importedInvoiceId: invoice9004.id,
    },
  });

  const fundedTransaction = await prisma.factoringTransaction.upsert({
    where: {
      transactionReference: "FACT-DEMO-9003",
    },
    update: {
      userId,
      organizationId,
      importedInvoiceId: invoice9003.id,
      factoringOfferId: offer9003.id,
      capitalSourceId: capitalSource.id,
      marketplaceNode: MarketplaceNode.PANDADOC,
      accountingSystem: AccountingSystem.QUICKBOOKS,
      status: FactoringTransactionStatus.FUNDED,
      settlementMethod: SettlementMethod.USDC_WALLET,
      settlementDestinationMasked: "Wallet 0x1234...cafe",
      sellerWalletAddress: "0x1234567890abcdefcafe",
      invoiceCurrency: "USD",
      settlementCurrency: "USDC",
      grossAmount: "600.00",
      advanceRateBps: 8500,
      advanceAmount: "510.00",
      principalAmount: "490.87",
      discountRateBps: 325,
      discountAmount: "16.58",
      operatorFeeBps: 50,
      operatorFeeAmount: "2.55",
      poolYieldAmount: "16.58",
      netProceeds: "490.87",
      expectedRepaymentAmount: "510.00",
      maturityDate: new Date("2026-03-15T00:00:00.000Z"),
      riskTier: RiskTier.HIGH,
      settlementTimeLabel: "Within minutes",
      termsAcceptedAt: new Date("2026-03-01T12:15:00.000Z"),
      reservedAt: new Date("2026-03-01T12:16:00.000Z"),
      fundedAt: new Date("2026-03-01T12:20:00.000Z"),
      operatorWallet: "0xProtofireOperatorWalletDemo",
      arenaSettlementReference: "arena_sim_seeded_9003",
      onChainExecutionStatus: OnChainExecutionStatus.SIMULATED,
      metadata: {
        seeded: true,
      },
    },
    create: {
      transactionReference: "FACT-DEMO-9003",
      userId,
      organizationId,
      importedInvoiceId: invoice9003.id,
      factoringOfferId: offer9003.id,
      capitalSourceId: capitalSource.id,
      marketplaceNode: MarketplaceNode.PANDADOC,
      accountingSystem: AccountingSystem.QUICKBOOKS,
      status: FactoringTransactionStatus.FUNDED,
      settlementMethod: SettlementMethod.USDC_WALLET,
      settlementDestinationMasked: "Wallet 0x1234...cafe",
      sellerWalletAddress: "0x1234567890abcdefcafe",
      invoiceCurrency: "USD",
      settlementCurrency: "USDC",
      grossAmount: "600.00",
      advanceRateBps: 8500,
      advanceAmount: "510.00",
      principalAmount: "490.87",
      discountRateBps: 325,
      discountAmount: "16.58",
      operatorFeeBps: 50,
      operatorFeeAmount: "2.55",
      poolYieldAmount: "16.58",
      netProceeds: "490.87",
      expectedRepaymentAmount: "510.00",
      maturityDate: new Date("2026-03-15T00:00:00.000Z"),
      riskTier: RiskTier.HIGH,
      settlementTimeLabel: "Within minutes",
      termsAcceptedAt: new Date("2026-03-01T12:15:00.000Z"),
      reservedAt: new Date("2026-03-01T12:16:00.000Z"),
      fundedAt: new Date("2026-03-01T12:20:00.000Z"),
      operatorWallet: "0xProtofireOperatorWalletDemo",
      arenaSettlementReference: "arena_sim_seeded_9003",
      onChainExecutionStatus: OnChainExecutionStatus.SIMULATED,
      metadata: {
        seeded: true,
      },
    },
  });

  const repaidTransaction = await prisma.factoringTransaction.upsert({
    where: {
      transactionReference: "FACT-DEMO-9004",
    },
    update: {
      userId,
      organizationId,
      importedInvoiceId: invoice9004.id,
      factoringOfferId: offer9004.id,
      capitalSourceId: capitalSource.id,
      marketplaceNode: MarketplaceNode.PANDADOC,
      accountingSystem: AccountingSystem.QUICKBOOKS,
      status: FactoringTransactionStatus.REPAID,
      settlementMethod: SettlementMethod.ACH,
      settlementDestinationMasked: "ACH ••4821",
      sellerWalletAddress: null,
      invoiceCurrency: "USD",
      settlementCurrency: "USDC",
      grossAmount: "1800.00",
      advanceRateBps: 9000,
      advanceAmount: "1620.00",
      principalAmount: "1547.10",
      discountRateBps: 400,
      discountAmount: "64.80",
      operatorFeeBps: 50,
      operatorFeeAmount: "8.10",
      poolYieldAmount: "64.80",
      netProceeds: "1547.10",
      expectedRepaymentAmount: "1620.00",
      maturityDate: new Date("2026-02-28T00:00:00.000Z"),
      riskTier: RiskTier.MEDIUM,
      settlementTimeLabel: "Same business day",
      termsAcceptedAt: new Date("2026-02-18T10:00:00.000Z"),
      reservedAt: new Date("2026-02-18T10:05:00.000Z"),
      fundedAt: new Date("2026-02-18T10:30:00.000Z"),
      repaidAt: new Date("2026-02-28T16:10:00.000Z"),
      operatorWallet: "0xProtofireOperatorWalletDemo",
      arenaSettlementReference: "arena_sim_seeded_9004",
      onChainExecutionStatus: OnChainExecutionStatus.SETTLED,
      metadata: {
        seeded: true,
      },
    },
    create: {
      transactionReference: "FACT-DEMO-9004",
      userId,
      organizationId,
      importedInvoiceId: invoice9004.id,
      factoringOfferId: offer9004.id,
      capitalSourceId: capitalSource.id,
      marketplaceNode: MarketplaceNode.PANDADOC,
      accountingSystem: AccountingSystem.QUICKBOOKS,
      status: FactoringTransactionStatus.REPAID,
      settlementMethod: SettlementMethod.ACH,
      settlementDestinationMasked: "ACH ••4821",
      sellerWalletAddress: null,
      invoiceCurrency: "USD",
      settlementCurrency: "USDC",
      grossAmount: "1800.00",
      advanceRateBps: 9000,
      advanceAmount: "1620.00",
      principalAmount: "1547.10",
      discountRateBps: 400,
      discountAmount: "64.80",
      operatorFeeBps: 50,
      operatorFeeAmount: "8.10",
      poolYieldAmount: "64.80",
      netProceeds: "1547.10",
      expectedRepaymentAmount: "1620.00",
      maturityDate: new Date("2026-02-28T00:00:00.000Z"),
      riskTier: RiskTier.MEDIUM,
      settlementTimeLabel: "Same business day",
      termsAcceptedAt: new Date("2026-02-18T10:00:00.000Z"),
      reservedAt: new Date("2026-02-18T10:05:00.000Z"),
      fundedAt: new Date("2026-02-18T10:30:00.000Z"),
      repaidAt: new Date("2026-02-28T16:10:00.000Z"),
      operatorWallet: "0xProtofireOperatorWalletDemo",
      arenaSettlementReference: "arena_sim_seeded_9004",
      onChainExecutionStatus: OnChainExecutionStatus.SETTLED,
      metadata: {
        seeded: true,
      },
    },
  });

  await prisma.poolTransaction.deleteMany({
    where: {
      factoringTransactionId: {
        in: [fundedTransaction.id, repaidTransaction.id],
      },
    },
  });

  await prisma.poolTransaction.createMany({
    data: [
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: fundedTransaction.id,
        transactionType: PoolTransactionType.FUNDING_DISBURSED,
        currency: "USDC",
        amount: "490.87",
        principalAmount: "490.87",
        yieldAmount: "0.00",
        feeAmount: "0.00",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        transactionType: PoolTransactionType.FUNDING_DISBURSED,
        currency: "USDC",
        amount: "1547.10",
        principalAmount: "1547.10",
        yieldAmount: "0.00",
        feeAmount: "0.00",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        transactionType: PoolTransactionType.REPAYMENT_RECEIVED,
        currency: "USDC",
        amount: "1620.00",
        principalAmount: "1547.10",
        yieldAmount: "64.80",
        feeAmount: "8.10",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        transactionType: PoolTransactionType.YIELD_BOOKED,
        currency: "USDC",
        amount: "64.80",
        principalAmount: "0.00",
        yieldAmount: "64.80",
        feeAmount: "0.00",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        transactionType: PoolTransactionType.PROTOCOL_FEE_BOOKED,
        currency: "USDC",
        amount: "8.10",
        principalAmount: "0.00",
        yieldAmount: "0.00",
        feeAmount: "8.10",
        metadata: {
          seeded: true,
        },
      },
    ],
  });

  await prisma.walletLedger.deleteMany({
    where: {
      factoringTransactionId: {
        in: [fundedTransaction.id, repaidTransaction.id],
      },
    },
  });

  await prisma.walletLedger.createMany({
    data: [
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        ownerType: LedgerOwnerType.POOL,
        ownerId: capitalSource.id,
        entryType: "funding_disbursement",
        direction: LedgerDirection.DEBIT,
        currency: "USDC",
        amount: "1547.10",
        balanceAfter: "498452.90",
        description: "Seeded historical funding disbursement.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        ownerType: LedgerOwnerType.SELLER,
        ownerId: userId,
        entryType: "seller_usdc_disbursement",
        direction: LedgerDirection.CREDIT,
        currency: "USDC",
        amount: "1547.10",
        balanceAfter: "1547.10",
        description: "Seeded historical seller disbursement.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        ownerType: LedgerOwnerType.POOL,
        ownerId: capitalSource.id,
        entryType: "repayment_received",
        direction: LedgerDirection.CREDIT,
        currency: "USDC",
        amount: "1611.90",
        balanceAfter: "500064.80",
        description: "Seeded historical repayment return to pool.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: repaidTransaction.id,
        ownerType: LedgerOwnerType.OPERATOR,
        ownerId: "0xProtofireOperatorWalletDemo",
        entryType: "protocol_fee_credit",
        direction: LedgerDirection.CREDIT,
        currency: "USDC",
        amount: "8.10",
        balanceAfter: "8.10",
        description: "Seeded protocol fee credit.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: fundedTransaction.id,
        ownerType: LedgerOwnerType.POOL,
        ownerId: capitalSource.id,
        entryType: "funding_disbursement",
        direction: LedgerDirection.DEBIT,
        currency: "USDC",
        amount: "490.87",
        balanceAfter: "499573.93",
        description: "Seeded active funding disbursement.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        capitalSourceId: capitalSource.id,
        factoringTransactionId: fundedTransaction.id,
        ownerType: LedgerOwnerType.SELLER,
        ownerId: userId,
        entryType: "seller_usdc_disbursement",
        direction: LedgerDirection.CREDIT,
        currency: "USDC",
        amount: "490.87",
        balanceAfter: "2037.97",
        description: "Seeded active seller disbursement.",
        metadata: {
          seeded: true,
        },
      },
    ],
  });

  await prisma.factoringEventLog.deleteMany({
    where: {
      factoringTransactionId: {
        in: [fundedTransaction.id, repaidTransaction.id],
      },
    },
  });

  await prisma.factoringEventLog.createMany({
    data: [
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9003.id,
        factoringTransactionId: fundedTransaction.id,
        eventType: FactoringEventType.OFFER_GENERATED,
        message: "Seeded terms generated for the partial-payment invoice.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9003.id,
        factoringTransactionId: fundedTransaction.id,
        eventType: FactoringEventType.TRANSACTION_CREATED,
        statusTo: FactoringTransactionStatus.PENDING,
        message: "Seeded factoring position created.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9003.id,
        factoringTransactionId: fundedTransaction.id,
        eventType: FactoringEventType.CAPITAL_DISBURSED,
        statusFrom: FactoringTransactionStatus.PENDING,
        statusTo: FactoringTransactionStatus.FUNDED,
        message: "Seeded capital disbursement confirmed.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9004.id,
        factoringTransactionId: repaidTransaction.id,
        eventType: FactoringEventType.OFFER_GENERATED,
        message: "Seeded historical terms generated for a closed invoice.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9004.id,
        factoringTransactionId: repaidTransaction.id,
        eventType: FactoringEventType.REPAYMENT_RECORDED,
        statusFrom: FactoringTransactionStatus.FUNDED,
        statusTo: FactoringTransactionStatus.REPAID,
        message: "Seeded repayment recorded and distributed.",
        metadata: {
          seeded: true,
        },
      },
      {
        organizationId,
        userId,
        importedInvoiceId: invoice9004.id,
        factoringTransactionId: repaidTransaction.id,
        eventType: FactoringEventType.POOL_DISTRIBUTION_BOOKED,
        message: "Seeded pool principal, yield, and fees booked.",
        metadata: {
          seeded: true,
        },
      },
    ],
  });
}

async function main() {
  const organization = await seedOrganization();
  const user = await seedAdminUser(organization.id);

  if (env.SEED_DEMO_DATA) {
    await seedDemoData(user.id, organization.id);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
