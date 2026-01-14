import { z } from "zod";

export const appCreateInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const appCreateOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
});
