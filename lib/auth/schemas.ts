import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().trim().max(200).optional(),
}).strict();
