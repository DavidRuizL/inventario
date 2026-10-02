import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado, rechazarMovimiento } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P5: Medellín rechaza ese traslado con motivo →
// Bogotá recupera 3; Medellín sin cambio; RECHAZADO con motivo.
describe('P5 — rechazo de traslado', () => {
  it('devuelve las unidades al origen y registra el motivo', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuarioOrigen = await crearUsuario('BASE', [origen.id]);
    const usuarioDestino = await crearUsuario('BASE', [destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 5, usuarioOrigen.id);

    const movimiento = await crearTraslado(authDe(usuarioOrigen, [origen.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);

    const resultado = await rechazarMovimiento(authDe(usuarioDestino, [destino.id]), movimiento.id, 'En la caja llegaron 2, no 3');

    expect(resultado.estado).toBe('RECHAZADO');
    expect(resultado.motivoResolucion).toBe('En la caja llegaron 2, no 3');

    const saldoOrigen = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: origen.id, loteId: lote.id } } });
    expect(saldoOrigen?.cantidad).toBe(5);

    const saldoDestino = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: destino.id, loteId: lote.id } } });
    expect(saldoDestino).toBeNull();
  });
});
