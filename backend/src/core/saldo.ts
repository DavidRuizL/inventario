import { Prisma } from '@prisma/client';
import { DetalleError, ReglaError } from '../shared/errors';

export type Efecto = { sedeId: number; loteId: number; cantidad: number }; // + entra, − sale
export type ContextoEfecto = 'MOVER' | 'ANULAR';

/**
 * Único lugar que escribe en `saldo` y `kardex`. Debe llamarse dentro de conUsuario().
 * Bloquea cada fila (sede, lote) con UPDLOCK/HOLDLOCK antes de validar, en un orden fijo
 * (sedeId, loteId) para no entrar en interbloqueo con otra llamada concurrente.
 * Si alguna línea falla, no aplica ninguna y junta todos los errores (R9).
 */
export async function aplicarEfectos(
  tx: Prisma.TransactionClient,
  movimientoId: number,
  efectos: Efecto[],
  contexto: ContextoEfecto,
): Promise<void> {
  if (efectos.length === 0) return;

  const sedeIds = [...new Set(efectos.map((e) => e.sedeId))];
  const sedes = await tx.sede.findMany({
    where: { id: { in: sedeIds } },
    select: { id: true, controlaSaldo: true, nombre: true },
  });
  const sedeMap = new Map(sedes.map((s) => [s.id, s]));

  // R12: la Bodega ERP (controla_saldo = 0) nunca tiene filas en saldo.
  const aplicables = efectos.filter((e) => sedeMap.get(e.sedeId)?.controlaSaldo);
  if (aplicables.length === 0) return;

  const ordenados = [...aplicables].sort((a, b) => a.sedeId - b.sedeId || a.loteId - b.loteId);

  const loteIds = [...new Set(ordenados.map((e) => e.loteId))];
  const lotes = await tx.lote.findMany({
    where: { id: { in: loteIds } },
    select: { id: true, nroLote: true, producto: { select: { codigo: true } } },
  });
  const loteMap = new Map(lotes.map((l) => [l.id, l]));

  const errores: DetalleError[] = [];
  const resultados: { sedeId: number; loteId: number; nuevo: number; existe: boolean }[] = [];

  for (const efecto of ordenados) {
    const filas = await tx.$queryRaw<{ cantidad: number }[]>`
      SELECT cantidad FROM saldo WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
      WHERE sede_id = ${efecto.sedeId} AND lote_id = ${efecto.loteId}
    `;
    const existe = filas.length > 0;
    const actual = filas[0]?.cantidad ?? 0;
    const sede = sedeMap.get(efecto.sedeId)!;
    const lote = loteMap.get(efecto.loteId);
    const nombreLote = lote ? `${lote.producto.codigo} / ${lote.nroLote}` : `lote ${efecto.loteId}`;

    if (efecto.cantidad < 0) {
      const solicitado = -efecto.cantidad;

      if (!existe) {
        errores.push({ loteId: efecto.loteId, mensaje: `${sede.nombre} no tiene el lote ${nombreLote}` }); // R3
        continue;
      }
      if (actual < solicitado) {
        if (contexto === 'ANULAR') {
          const usadas = solicitado - actual;
          errores.push({
            loteId: efecto.loteId,
            mensaje: `No se puede anular: ${sede.nombre} ya usó ${usadas} de las ${solicitado} unidades de ${nombreLote}`,
          });
        } else {
          errores.push({
            loteId: efecto.loteId,
            mensaje: `Disponible en ${sede.nombre}: ${actual}, solicitado: ${solicitado}`, // R2
          });
        }
        continue;
      }
      resultados.push({ sedeId: efecto.sedeId, loteId: efecto.loteId, nuevo: actual - solicitado, existe });
    } else {
      resultados.push({ sedeId: efecto.sedeId, loteId: efecto.loteId, nuevo: actual + efecto.cantidad, existe });
    }
  }

  if (errores.length > 0) {
    throw new ReglaError('No se pudo aplicar el movimiento.', errores);
  }

  const ahora = new Date();
  for (const r of resultados) {
    if (r.existe) {
      await tx.saldo.update({
        where: { sedeId_loteId: { sedeId: r.sedeId, loteId: r.loteId } },
        data: { cantidad: r.nuevo, actualizadoEn: ahora },
      });
    } else {
      await tx.saldo.create({
        data: { sedeId: r.sedeId, loteId: r.loteId, cantidad: r.nuevo, actualizadoEn: ahora },
      });
    }
    const efecto = ordenados.find((e) => e.sedeId === r.sedeId && e.loteId === r.loteId)!;
    await tx.kardex.create({
      data: {
        fecha: ahora,
        sedeId: r.sedeId,
        loteId: r.loteId,
        movimientoId,
        cantidad: efecto.cantidad,
        saldoResultante: r.nuevo,
      },
    });
  }
}
