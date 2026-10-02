import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearAjuste, crearSalida, aprobarAjuste } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P13: Aprobar un ajuste −5 cuando la sede ya solo tiene 3 → Rechazado (R1).
describe('P13 — aprobar un ajuste que dejaría el saldo negativo', () => {
  it('rechaza la aprobación y no cambia el saldo', async () => {
    const sede = await crearSede();
    const creador = await crearUsuario('ADMIN', [sede.id]);
    const aprobador = await crearUsuario('ADMIN', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 8, creador.id);

    // Se cuenta 3 cuando el sistema decía 8 → diferencia -5, PENDIENTE.
    const ajuste = await crearAjuste(authDe(creador, [sede.id]), {
      sedeId: sede.id,
      lineas: [{ loteId: lote.id, conteo: 3 }],
    } as never);

    // Entre el conteo y la aprobación, la sede ya consumió y solo le quedan 3.
    await crearSalida(authDe(creador, [sede.id]), {
      sedeOrigenId: sede.id,
      motivo: 'VENTA',
      lineas: [{ loteId: lote.id, cantidad: 5 }],
    } as never);

    await expect(aprobarAjuste(authDe(aprobador, [sede.id]), ajuste.id)).rejects.toMatchObject({ status: 422 });

    const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: sede.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(3);

    const ajusteFinal = await prisma.movimiento.findUniqueOrThrow({ where: { id: ajuste.id } });
    expect(ajusteFinal.estado).toBe('PENDIENTE'); // la transacción se revirtió completa
  });
});
