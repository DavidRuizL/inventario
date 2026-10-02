import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearSalida, anularMovimiento } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P16: Anular una salida → La sede recupera las unidades; queda ANULADO y un movimiento ANULACION.
describe('P16 — anular una salida', () => {
  it('devuelve las unidades y crea el movimiento de anulación', async () => {
    const sede = await crearSede();
    const admin = await crearUsuario('ADMIN', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 5, admin.id);

    const salida = await crearSalida(authDe(admin, [sede.id]), {
      sedeOrigenId: sede.id,
      motivo: 'VENTA',
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);

    let saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: sede.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(2);

    const anulacion = await anularMovimiento(authDe(admin, [sede.id]), salida.id, 'Se registró por error');

    expect(anulacion.tipo).toBe('ANULACION');
    expect(anulacion.anulaAId).toBe(salida.id);

    saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: sede.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(5);

    const salidaFinal = await prisma.movimiento.findUniqueOrThrow({ where: { id: salida.id } });
    expect(salidaFinal.estado).toBe('ANULADO');
  });
});
