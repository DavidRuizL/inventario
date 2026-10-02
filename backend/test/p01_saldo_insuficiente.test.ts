import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P1: Bogotá tiene 2 unidades del lote y envía 3 → Rechazado; el saldo sigue en 2.
describe('P1 — saldo insuficiente (R2)', () => {
  it('rechaza el traslado y no toca el saldo', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 2, usuario.id);

    await expect(
      crearTraslado(authDe(usuario, [origen.id, destino.id]), {
        sedeOrigenId: origen.id,
        sedeDestinoId: destino.id,
        lineas: [{ loteId: lote.id, cantidad: 3 }],
      } as never),
    ).rejects.toMatchObject({ status: 422 });

    const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: origen.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(2);
  });
});
