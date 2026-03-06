import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

import {
  booleanSearchParamSchema,
  internalIdSchema,
  pageSearchParamSchema,
  searchQuerySchema,
} from "@/lib/validation/common";

export const invoiceListSearchParamsSchema = z
  .object({
    q: searchQuerySchema,
    status: z
      .nativeEnum(InvoiceStatus)
      .or(z.literal("ALL"))
      .optional()
      .catch("ALL"),
    overdue: booleanSearchParamSchema,
    page: pageSearchParamSchema,
  })
  .strict();

export const syncRequestSchema = z
  .object({
    connectionId: internalIdSchema.optional(),
    userId: internalIdSchema.optional(),
    force: z.boolean().optional(),
  })
  .strict();

export const cronSyncQuerySchema = z
  .object({
    connectionId: internalIdSchema.optional(),
    force: booleanSearchParamSchema,
    userId: internalIdSchema.optional(),
  })
  .strict();
