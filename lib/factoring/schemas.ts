import { SettlementMethod } from "@prisma/client";
import { z } from "zod";

import { internalIdSchema, pageSearchParamSchema } from "@/lib/validation/common";

export const transactionRouteParamsSchema = z
  .object({
    transactionId: internalIdSchema,
  })
  .strict();

export const createFactoringTransactionSchema = z
  .object({
    importedInvoiceId: internalIdSchema,
    settlementMethod: z.nativeEnum(SettlementMethod),
    acceptTerms: z.boolean(),
    walletAddress: z.string().trim().max(120).optional(),
    bankAccountLabel: z.string().trim().max(80).optional(),
    debitCardLabel: z.string().trim().max(20).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.settlementMethod === SettlementMethod.USDC_WALLET &&
      !value.walletAddress
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["walletAddress"],
        message: "Wallet address is required for USDC settlement.",
      });
    }

    if (
      value.settlementMethod === SettlementMethod.ACH &&
      !value.bankAccountLabel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankAccountLabel"],
        message: "Bank account label is required for ACH settlement.",
      });
    }

    if (
      value.settlementMethod === SettlementMethod.DEBIT_CARD &&
      !value.debitCardLabel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debitCardLabel"],
        message: "Debit card last four digits are required.",
      });
    }
  });

export const transactionListSearchParamsSchema = z
  .object({
    page: pageSearchParamSchema,
  })
  .strict();
