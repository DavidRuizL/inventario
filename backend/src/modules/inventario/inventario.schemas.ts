import { z } from 'zod';

export const disponibleSchema = z.object({
  sedeId: z.coerce.number().int().positive(),
  q: z.string().trim().default(''),
});

export const inventarioSchema = z.object({
  sedeId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().optional(),
  marca: z.string().trim().optional(),
  lote: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});

export const porVencerSchema = z.object({
  dias: z.coerce.number().int().positive().default(90),
  sedeId: z.coerce.number().int().positive().optional(),
});
