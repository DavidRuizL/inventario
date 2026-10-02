import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P3: Dos usuarios envían 2 cada uno de un saldo de 3, al mismo tiempo →
// Uno pasa y el otro es rechazado; el saldo queda en 1.
describe('P3 — concurrencia en el mismo lote', () => {
  it('solo un traslado pasa; el saldo queda en 1', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 3, usuario.id);

    const auth = authDe(usuario, [origen.id, destino.id]);
    const input = {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 2 }],
    } as never;

    const resultados = await Promise.allSettled([crearTraslado(auth, input), crearTraslado(auth, input)]);

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    const fallidos = resultados.filter((r) => r.status === 'rejected');
    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);

    const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: origen.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(1);
  });
});
