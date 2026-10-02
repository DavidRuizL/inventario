import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido.'),
  clave: z.string().min(1, 'La clave es obligatoria.'),
});

export const cambiarClaveSchema = z.object({
  actual: z.string().min(1, 'Escribe tu clave actual.'),
  nueva: z.string().min(6, 'La clave nueva debe tener al menos 6 caracteres.'),
});
