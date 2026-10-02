import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P4: Bogotá envía 3 a Medellín sin que Medellín confirme →
// Bogotá −3; Medellín sin cambio; NO_CONFIRMADO.
describe('P4 — traslado enviado y no confirmado', () => {
  it('resta en origen, no cambia el destino, queda NO_CONFIRMADO', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 5, usuario.id);

    const movimiento = await crearTraslado(authDe(usuario, [origen.id, destino.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);

    expect(movimiento.estado).toBe('NO_CONFIRMADO');

    const saldoOrigen = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: origen.id, loteId: lote.id } } });
    expect(saldoOrigen?.cantidad).toBe(2);

    const saldoDestino = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: destino.id, loteId: lote.id } } });
    expect(saldoDestino).toBeNull();
  });
});
