import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado, confirmarTraslado, crearSalida, crearAjuste, aprobarAjuste, anularMovimiento } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe, verificarInvariante } from './factories';

// P19: en todo momento, saldo = SUM(kardex) por sede y lote.
describe('P19 — invariante saldo = SUM(kardex)', () => {
  it('se mantiene tras una secuencia mixta de movimientos', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const admin = await crearUsuario('ADMIN', [origen.id, destino.id]);
    const lote = await crearLote();

    await darSaldoInicial(origen.id, lote.id, 20, admin.id);
    await verificarInvariante();

    const traslado = await crearTraslado(authDe(admin, [origen.id, destino.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 8 }],
    } as never);
    await verificarInvariante();

    await confirmarTraslado(authDe(admin, [origen.id, destino.id]), traslado.id);
    await verificarInvariante();

    const salida = await crearSalida(authDe(admin, [destino.id]), {
      sedeOrigenId: destino.id,
      motivo: 'VENTA',
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);
    await verificarInvariante();

    const ajuste = await crearAjuste(authDe(admin, [destino.id]), {
      sedeId: destino.id,
      lineas: [{ loteId: lote.id, conteo: 6 }], // sistema=5, conteo=6, diferencia +1
    } as never);
    await verificarInvariante(); // el ajuste PENDIENTE no toca saldo ni kardex

    const otroAdmin = await crearUsuario('ADMIN', [destino.id]);
    await aprobarAjuste(authDe(otroAdmin, [destino.id]), ajuste.id);
    await verificarInvariante();

    await anularMovimiento(authDe(admin, [destino.id]), salida.id, 'Prueba de invariante');
    await verificarInvariante();

    const saldoFinal = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: destino.id, loteId: lote.id } } });
    expect(saldoFinal?.cantidad).toBe(9); // 8 recibidos - 3 vendidos + 1 ajuste + 3 por anulación de la venta
  });
});
