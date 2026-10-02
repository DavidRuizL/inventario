import { z } from 'zod';

export const crearSedeSchema = z.object({
  codigo: z.string().trim().toUpperCase().min(1).max(10),
  nombre: z.string().trim().min(1).max(80),
  controlaSaldo: z.boolean().default(true),
});

export const actualizarSedeSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  activo: z.boolean().optional(),
});

export const listarSedesSchema = z.object({
  incluirInactivas: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});
