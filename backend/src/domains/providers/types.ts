import { z } from 'zod';

export const modelListRequestSchema = z.object({
  id_app: z.number().int().positive(),
  api_key: z.string().min(1),
});
export type ModelListRequest = z.infer<typeof modelListRequestSchema>;

export const modelInfoSchema = z.object({
  raw_name: z.string(),
  display_name: z.string(),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;
