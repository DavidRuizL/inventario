import { z } from 'zod';

export const kardexSchema = z.object({
  loteId: z.coerce.number().int().positive().optional(),
  sedeId: z.coerce.number().int().positive().optional(),
  productoId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(100),
});
