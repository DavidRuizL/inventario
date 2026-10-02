import { describe, it, expect } from 'vitest';
import { crearAjuste, crearSalida } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';
import { agenteAutenticado } from './httpClient';

// P14: Usuario base intenta aprobar un ajuste o anular → Rechazado.
describe('P14 — un usuario BASE no puede aprobar ni anular (HTTP)', () => {
  it('403 al intentar aprobar un ajuste', async () => {
    const sede = await crearSede();
    const admin = await crearUsuario('ADMIN', [sede.id]);
    const base = await crearUsuario('BASE', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 3, admin.id);

    const ajuste = await crearAjuste(authDe(admin, [sede.id]), {
      sedeId: sede.id,
      lineas: [{ loteId: lote.id, conteo: 2 }],
    } as never);

    const agenteBase = await agenteAutenticado(base.email);
    const respuestaAprobar = await agenteBase.post(`/api/movimientos/${ajuste.id}/aprobar`);
    expect(respuestaAprobar.status).toBe(403);
  });

  it('403 al intentar anular una salida', async () => {
    const sede = await crearSede();
    const admin = await crearUsuario('ADMIN', [sede.id]);
    const base = await crearUsuario('BASE', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 5, admin.id);

    const salida = await crearSalida(authDe(admin, [sede.id]), {
      sedeOrigenId: sede.id,
      motivo: 'VENTA',
      lineas: [{ loteId: lote.id, cantidad: 2 }],
    } as never);

    const agenteBase = await agenteAutenticado(base.email);
    const respuestaAnular = await agenteBase.post(`/api/movimientos/${salida.id}/anular`).send({ motivo: 'prueba' });
    expect(respuestaAnular.status).toBe(403);
  });
});
