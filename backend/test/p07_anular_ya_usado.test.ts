import { describe, it, expect } from 'vitest';
import { crearTraslado, confirmarTraslado, crearSalida, anularMovimiento } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P7: Anular un traslado cuando Medellín ya usó las unidades → Rechazado con mensaje.
describe('P7 — anular cuando el destino ya usó las unidades', () => {
  it('rechaza la anulación con un mensaje claro', async () => {
    const origen = await crearSede();
    const destino = await crearSede();
    const admin = await crearUsuario('ADMIN', [origen.id, destino.id]);
    const lote = await crearLote();
    await darSaldoInicial(origen.id, lote.id, 5, admin.id);

    const traslado = await crearTraslado(authDe(admin, [origen.id, destino.id]), {
      sedeOrigenId: origen.id,
      sedeDestinoId: destino.id,
      lineas: [{ loteId: lote.id, cantidad: 3 }],
    } as never);
    await confirmarTraslado(authDe(admin, [origen.id, destino.id]), traslado.id);

    // Medellín ya usó 2 de las 3 unidades recibidas.
    await crearSalida(authDe(admin, [destino.id]), {
      sedeOrigenId: destino.id,
      motivo: 'VENTA',
      lineas: [{ loteId: lote.id, cantidad: 2 }],
    } as never);

    await expect(anularMovimiento(authDe(admin, [origen.id, destino.id]), traslado.id, 'Error al registrar')).rejects.toMatchObject({
      status: 422,
    });
  });
});
