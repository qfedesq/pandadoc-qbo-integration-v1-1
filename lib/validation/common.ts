import { z } from "zod";

export const internalIdSchema = z.string().trim().min(1).max(64);

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional();

export const pageSearchParamSchema = z.coerce.number().int().min(1).max(500).catch(1);

export const booleanSearchParamSchema = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");
