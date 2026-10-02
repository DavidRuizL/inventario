import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P8: Envío con 5 líneas donde la 4.ª no tiene saldo → Se rechaza todo (R9).
describe('P8 — una línea inválida rechaza el movimiento completo', () => {
  it('no aplica ninguna línea si una falla', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);

    const lotes = await Promise.all(Array.from({ length: 5 }, () => crearLote()));
    for (const lote of lotes) {
      await darSaldoInicial(origen.id, lote.id, 10, usuario.id);
    }
    // La 4.ª línea pide más de lo disponible.
    const cantidades = [2, 2, 2, 20, 2];

    await expect(
      crearTraslado(authDe(usuario, [origen.id, destino.id]), {
        sedeOrigenId: origen.id,
        sedeDestinoId: destino.id,
        lineas: lotes.map((lote, i) => ({ loteId: lote.id, cantidad: cantidades[i] })),
      } as never),
    ).rejects.toMatchObject({ status: 422 });

    for (const lote of lotes) {
      const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: origen.id, loteId: lote.id } } });
      expect(saldo?.cantidad).toBe(10); // ninguna línea se aplicó
    }
  });
});
