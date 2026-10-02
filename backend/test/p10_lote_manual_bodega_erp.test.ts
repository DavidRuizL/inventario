import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { crearTraslado, confirmarTraslado } from '../src/modules/movimientos/movimientos.service';
import { crearSede, crearUsuario, authDe } from './factories';

// P10: La Bodega ERP envía un lote que no existe en el ERP →
// Se crea el lote MANUAL; al confirmar, Bogotá suma.
describe('P10 — lote nuevo enviado desde la Bodega ERP', () => {
  it('crea el producto/lote MANUAL y suma al confirmar', async () => {
    const erp = await crearSede({ controlaSaldo: false });
    const bogota = await crearSede();
    const usuario = await crearUsuario('ADMIN', [erp.id, bogota.id]);

    const traslado = await crearTraslado(authDe(usuario, [erp.id, bogota.id]), {
      sedeOrigenId: erp.id,
      sedeDestinoId: bogota.id,
      motivo: 'CARGA_INICIAL',
      lineas: [
        {
          producto: { codigo: 'P-NUEVO-01', descripcion: 'Producto nuevo de prueba' },
          nroLote: '24084133',
          cantidad: 10,
        },
      ],
    } as never);

    const linea = await prisma.movimientoLinea.findFirstOrThrow({ where: { movimientoId: traslado.id }, include: { lote: { include: { producto: true } } } });
    expect(linea.lote.origen).toBe('MANUAL');
    expect(linea.lote.producto.origen).toBe('MANUAL');
    expect(linea.lote.nroLote).toBe('24084133');

    await confirmarTraslado(authDe(usuario, [erp.id, bogota.id]), traslado.id);

    const saldoBogota = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: bogota.id, loteId: linea.loteId } } });
    expect(saldoBogota?.cantidad).toBe(10);

    const saldoErp = await prisma.saldo.findUnique({ where: { sedeId_loteId: { sedeId: erp.id, loteId: linea.loteId } } });
    expect(saldoErp).toBeNull(); // R12: la Bodega ERP nunca tiene filas en saldo
  });
});
