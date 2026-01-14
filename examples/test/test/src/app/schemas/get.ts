import { z } from "zod";

export const appGetInput = z.object({
  id: z.string().uuid(),
});

export const appGetOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});
