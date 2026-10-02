import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearSede, crearLote, crearUsuario, darSaldoInicial } from './factories';

// P9: UPDATE directo en `saldo` a −1 → la base lo rechaza (CHECK).
describe('P9 — el CHECK de la base impide saldos negativos', () => {
  it('rechaza un UPDATE crudo que deje el saldo en -1', async () => {
    const sede = await crearSede();
    const usuario = await crearUsuario('ADMIN', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 2, usuario.id);

    await expect(
      prisma.$executeRaw`UPDATE saldo SET cantidad = -1 WHERE sede_id = ${sede.id} AND lote_id = ${lote.id}`,
    ).rejects.toThrow();

    const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: sede.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(2);
  });
});
