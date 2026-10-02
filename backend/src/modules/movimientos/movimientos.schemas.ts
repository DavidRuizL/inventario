import { z } from 'zod';

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, usa AAAA-MM-DD');

const productoRefSchema = z.union([
  z.object({ id: z.number().int().positive() }),
  z.object({
    codigo: z.string().trim().min(1).max(40),
    descripcion: z.string().trim().min(1).max(250),
    referencia: z.string().trim().max(100).optional(),
    marca: z.string().trim().max(100).optional(),
  }),
]);

const loteExistenteSchema = z.object({
  loteId: z.number().int().positive(),
  cantidad: z.number().int().positive(),
});

const loteNuevoSchema = z.object({
  producto: productoRefSchema,
  nroLote: z.string().trim().min(1).max(60),
  fechaVencimiento: fechaISO.optional(),
  cantidad: z.number().int().positive(),
});

export const lineaTrasladoSchema = z.union([loteExistenteSchema, loteNuevoSchema]);

export const crearTrasladoSchema = z.object({
  sedeOrigenId: z.number().int().positive(),
  sedeDestinoId: z.number().int().positive(),
  motivo: z.enum(['CARGA_INICIAL']).optional(),
  documentoSoporte: z.string().trim().max(60).optional(),
  observacion: z.string().trim().max(500).optional(),
  lineas: z.array(lineaTrasladoSchema).min(1, 'Agrega al menos una línea.'),
});

export const crearSalidaSchema = z.object({
  sedeOrigenId: z.number().int().positive(),
  motivo: z.enum(['CIRUGIA', 'VENTA', 'VENCIDO', 'AVERIA']),
  documentoSoporte: z.string().trim().max(60).optional(),
  observacion: z.string().trim().max(500).optional(),
  lineas: z.array(loteExistenteSchema).min(1, 'Agrega al menos una línea.'),
});

const lineaAjusteExistenteSchema = z.object({
  loteId: z.number().int().positive(),
  conteo: z.number().int().min(0),
});

const lineaAjusteNuevaSchema = z.object({
  producto: productoRefSchema,
  nroLote: z.string().trim().min(1).max(60),
  fechaVencimiento: fechaISO.optional(),
  conteo: z.number().int().min(0),
});

export const lineaAjusteSchema = z.union([lineaAjusteExistenteSchema, lineaAjusteNuevaSchema]);

export const crearAjusteSchema = z.object({
  sedeId: z.number().int().positive(),
  observacion: z.string().trim().max(500).optional(),
  lineas: z.array(lineaAjusteSchema).min(1, 'Agrega al menos una línea.'),
});

export const rechazarSchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo es obligatorio.').max(500),
});

export const anularSchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo es obligatorio.').max(500),
});

export const listarMovimientosSchema = z.object({
  tipo: z.enum(['TRASLADO', 'SALIDA', 'AJUSTE', 'ANULACION']).optional(),
  estado: z.string().optional(),
  sedeId: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export type LineaTrasladoEntrada = z.infer<typeof lineaTrasladoSchema>;
export type LineaAjusteEntrada = z.infer<typeof lineaAjusteSchema>;
export type CrearTrasladoInput = z.infer<typeof crearTrasladoSchema>;
export type CrearSalidaInput = z.infer<typeof crearSalidaSchema>;
export type CrearAjusteInput = z.infer<typeof crearAjusteSchema>;
