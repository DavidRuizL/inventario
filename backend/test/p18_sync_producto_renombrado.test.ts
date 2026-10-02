import { execSync } from 'node:child_process';
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { sincronizar } from '../src/modules/sync/sync.service';

// P18: Producto renombrado en SAPROD → tras sincronizar, la app muestra el nombre nuevo.
describe('P18 — sincronización recoge el nombre actual del ERP', () => {
  beforeAll(() => {
    // Garantiza que la base SaintDemo (fixture de ERP) exista, igual que `npm run erp:demo`.
    execSync('npx tsx scripts/erp-demo.ts', { cwd: process.cwd(), stdio: 'ignore' });
  });

  it('actualiza la descripción y el origen a ERP', async () => {
    const [fila] = await prisma.$queryRawUnsafe<{ Descrip: string }[]>(
      `SELECT Descrip FROM [SaintDemo].dbo.SAPROD WHERE CodProd = '136022'`,
    );
    expect(fila?.Descrip).toBeTruthy();
    const nombreActualEnErp = fila.Descrip;

    await prisma.producto.upsert({
      where: { codigo: '136022' },
      update: { descripcion: 'Nombre viejo de prueba', origen: 'MANUAL' },
      create: { codigo: '136022', descripcion: 'Nombre viejo de prueba', origen: 'MANUAL', creadoEn: new Date() },
    });

    await sincronizar(null);

    const producto = await prisma.producto.findUniqueOrThrow({ where: { codigo: '136022' } });
    expect(producto.descripcion).toBe(nombreActualEnErp);
    expect(producto.origen).toBe('ERP');
  });
});
