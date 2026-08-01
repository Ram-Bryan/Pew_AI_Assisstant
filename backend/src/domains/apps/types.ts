import { z } from 'zod';

export const verifyRequestSchema = z.object({
  id_app: z.number().int().positive(),
  api_key: z.string().min(1),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const verifyResultSchema = z.object({
  ok: z.boolean(),
  note: z.string().optional(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;
