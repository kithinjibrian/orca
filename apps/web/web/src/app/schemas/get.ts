import { z } from "zod";

const linkSchema = z.object({
  id: z.number(),
  label: z.string(),
});

export const blogGetOutput = z.object({
  id: z.number(),
  content: z.string(),
  next: linkSchema.optional(),
  prev: linkSchema.optional(),
});
