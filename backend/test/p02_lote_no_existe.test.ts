import { describe, it, expect } from 'vitest';
import { crearTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, authDe } from './factories';

// P2: Enviar un lote que Bogotá no tiene → Rechazado.
describe('P2 — mover un lote que la sede no tiene (R3)', () => {
  it('rechaza el traslado', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const usuario = await crearUsuario('BASE', [origen.id, destino.id]);
    const lote = await crearLote(); // nunca se le dio saldo a `origen`

    await expect(
      crearTraslado(authDe(usuario, [origen.id, destino.id]), {
        sedeOrigenId: origen.id,
        sedeDestinoId: destino.id,
        lineas: [{ loteId: lote.id, cantidad: 1 }],
      } as never),
    ).rejects.toMatchObject({ status: 422 });
  });
});
