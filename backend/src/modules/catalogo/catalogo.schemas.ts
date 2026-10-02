import { z } from 'zod';

export const buscarProductosSchema = z.object({
  q: z.string().trim().default(''),
});

export const buscarLotesSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  q: z.string().trim().default(''),
});

export const resolverFilaSchema = z.object({
  codigo: z.string().trim().min(1),
  nroLote: z.string().trim().min(1),
  cantidad: z.coerce.number().int().optional(),
  fechaVencimiento: z.string().optional(),
});

export const resolverSchema = z.object({
  filas: z.array(resolverFilaSchema).min(1),
});
