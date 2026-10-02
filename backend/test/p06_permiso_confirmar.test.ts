import { describe, it, expect } from 'vitest';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';
import { agenteAutenticado } from './httpClient';

// P6: Usuario de Bogotá intenta confirmar un traslado a Medellín → Rechazado.
describe('P6 — permiso para confirmar (HTTP)', () => {
  it('403 si el usuario no opera la sede destino', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuarioOrigen = await crearUsuario('BASE', [origen.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 5, usuarioOrigen.id);

    const movimiento = await crearTraslado(authDe(usuarioOrigen, [origen.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);

    // El mismo usuario de origen (no opera destino) intenta confirmar por HTTP.
    const agente = await agenteAutenticado(usuarioOrigen.email);
    const respuesta = await agente.post(`/api/movimientos/${movimiento.id}/confirmar`);

    expect(respuesta.status).toBe(403);
  });
});
