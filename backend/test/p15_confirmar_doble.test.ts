import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado, confirmarTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P15: Confirmar dos veces el mismo traslado (doble clic o dos personas) → Solo cuenta una vez.
describe('P15 — doble confirmación del mismo traslado', () => {
  it('una confirmación pasa, la otra responde 409, y el destino suma una sola vez', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 5, usuario.id);

    const traslado = await crearTraslado(authDe(usuario, [origen.id, destino.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);

    const auth = authDe(usuario, [origen.id, destino.id]);
    const resultados = await Promise.allSettled([confirmarTraslado(auth, traslado.id), confirmarTraslado(auth, traslado.id)]);

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    const fallidos = resultados.filter((r) => r.status === 'rejected');
    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);
    expect((fallidos[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    const saldoDestino = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: destino.id, loteId: lote.id } } });
    expect(saldoDestino?.cantidad).toBe(3);
  });
});
