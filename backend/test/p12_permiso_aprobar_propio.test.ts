import { describe, it, expect } from 'vitest';
import { crearAjuste } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';
import { agenteAutenticado } from './httpClient';

// P12: Quien creó el ajuste intenta aprobarlo → Rechazado (R11).
describe('P12 — no se puede aprobar el propio ajuste (HTTP)', () => {
  it('403 cuando el admin que creó el ajuste intenta aprobarlo', async () => {
    const sede = await crearSede();
    const admin = await crearUsuario('ADMIN', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 3, admin.id);

    const ajuste = await crearAjuste(authDe(admin, [sede.id]), {
      sedeId: sede.id,
      lineas: [{ loteId: lote.id, conteo: 2 }],
    } as never);

    const agente = await agenteAutenticado(admin.email);
    const respuesta = await agente.post(`/api/movimientos/${ajuste.id}/aprobar`);

    expect(respuesta.status).toBe(403);
  });
});
