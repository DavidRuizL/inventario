import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().optional(),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('12h'),
  PORT: z.coerce.number().default(3001),
  ERP_DB: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/, 'ERP_DB solo admite letras, números y guion bajo')
    .optional(),
  SYNC_INTERVAL_MIN: z.coerce.number().default(15),
  SEED_SUPERADMIN_EMAIL: z.string().email().default('admin@rpdental.local'),
  SEED_SUPERADMIN_CLAVE: z.string().min(6).default('cambiar'),
  NODE_ENV: z.string().default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Configuración inválida. Revisa el archivo .env');
}

export const config = parsed.data;
