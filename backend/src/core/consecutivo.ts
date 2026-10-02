import { Prisma } from '@prisma/client';

const PREFIJOS = { TRASLADO: 'TR', SALIDA: 'SA', AJUSTE: 'AJ', ANULACION: 'AN' } as const;

export type TipoMovimiento = keyof typeof PREFIJOS;

/** Genera el siguiente consecutivo sin huecos. Debe correr dentro de la transacción del movimiento. */
export async function siguienteConsecutivo(tx: Prisma.TransactionClient, tipo: TipoMovimiento): Promise<string> {
  const prefijo = PREFIJOS[tipo];
  const rows = await tx.$queryRaw<{ ultimo: number }[]>`
    UPDATE consecutivo SET ultimo = ultimo + 1
    OUTPUT inserted.ultimo
    WHERE prefijo = ${prefijo}
  `;
  const ultimo = rows[0]?.ultimo;
  if (ultimo === undefined) {
    throw new Error(`No existe el consecutivo para el prefijo ${prefijo}`);
  }
  return `${prefijo}-${String(ultimo).padStart(6, '0')}`;
}
