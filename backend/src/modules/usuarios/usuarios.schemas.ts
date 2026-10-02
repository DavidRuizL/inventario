import { z } from 'zod';

export const rolSchema = z.enum(['SUPERADMIN', 'ADMIN', 'BASE']);

export const crearUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  nombre: z.string().trim().min(1).max(120),
  rol: rolSchema,
  clave: z.string().min(6).max(100),
  sedeIds: z.array(z.number().int().positive()).default([]),
});

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    rol: rolSchema.optional(),
    activo: z.boolean().optional(),
    motivo: z.string().trim().min(3).max(500).optional(),
  })
  .refine((d) => !d.rol || d.motivo, { message: 'El motivo es obligatorio al cambiar el rol.', path: ['motivo'] });

export const asignarSedesSchema = z.object({
  sedeIds: z.array(z.number().int().positive()),
});
