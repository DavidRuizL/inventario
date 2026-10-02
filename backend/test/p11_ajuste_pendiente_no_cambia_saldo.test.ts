import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearAjuste } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearLote, crearUsuario, darSaldoInicial, authDe } from './factories';

// P11: Usuario base crea un ajuste −1 → El saldo no cambia hasta que un admin lo aprueba.
describe('P11 — el ajuste no cambia el saldo hasta aprobarse', () => {
  it('queda PENDIENTE y el saldo no se mueve', async () => {
    const sede = await crearSede();
    const usuario = await crearUsuario('BASE', [sede.id]);
    const lote = await crearLote();
    await darSaldoInicial(sede.id, lote.id, 3, usuario.id);

    const ajuste = await crearAjuste(authDe(usuario, [sede.id]), {
      sedeId: sede.id,
      lineas: [{ loteId: lote.id, conteo: 2 }],
    } as never);

    expect(ajuste.estado).toBe('PENDIENTE');

    const saldo = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: sede.id, loteId: lote.id } } });
    expect(saldo?.cantidad).toBe(3);
  });
});
