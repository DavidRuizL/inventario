import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, conUsuario } from '../src/db';
import { aplicarEfectos } from '../src/core/saldo';
import { siguienteConsecutivo } from '../src/core/consecutivo';

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@rpdental.local';
  const clave = process.env.SEED_SUPERADMIN_CLAVE ?? 'cambiar';
  const claveHash = await bcrypt.hash(clave, 10);

  const superadmin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { email, nombre: 'Superadministrador', claveHash, rol: 'SUPERADMIN', creadoEn: new Date() },
  });

  const erp = await prisma.sede.upsert({
    where: { codigo: 'ERP' },
    update: {},
    create: { codigo: 'ERP', nombre: 'Bodega ERP', controlaSaldo: false },
  });
  const bog = await prisma.sede.upsert({
    where: { codigo: 'BOG' },
    update: {},
    create: { codigo: 'BOG', nombre: 'Bogotá', controlaSaldo: true },
  });
  const med = await prisma.sede.upsert({
    where: { codigo: 'MED' },
    update: {},
    create: { codigo: 'MED', nombre: 'Medellín', controlaSaldo: true },
  });

  console.log(`Sedes listas: ${erp.codigo}, ${bog.codigo}, ${med.codigo}`);

  if (process.env.NODE_ENV !== 'production') {
    for (const sede of [bog, med]) {
      const adminEmail = `admin.${sede.codigo.toLowerCase()}@rpdental.local`;
      const baseEmail = `base.${sede.codigo.toLowerCase()}@rpdental.local`;

      const admin = await prisma.usuario.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
          email: adminEmail,
          nombre: `Admin ${sede.nombre}`,
          claveHash: await bcrypt.hash('Admin123!', 10),
          rol: 'ADMIN',
          creadoEn: new Date(),
        },
      });
      const base = await prisma.usuario.upsert({
        where: { email: baseEmail },
        update: {},
        create: {
          email: baseEmail,
          nombre: `Usuario ${sede.nombre}`,
          claveHash: await bcrypt.hash('Base123!', 10),
          rol: 'BASE',
          creadoEn: new Date(),
        },
      });

      await prisma.usuarioSede.upsert({
        where: { usuarioId_sedeId: { usuarioId: admin.id, sedeId: sede.id } },
        update: {},
        create: { usuarioId: admin.id, sedeId: sede.id },
      });
      await prisma.usuarioSede.upsert({
        where: { usuarioId_sedeId: { usuarioId: base.id, sedeId: sede.id } },
        update: {},
        create: { usuarioId: base.id, sedeId: sede.id },
      });
    }

    const yaHayMovimientos = await prisma.movimiento.count();
    if (yaHayMovimientos === 0) {
      const producto = await prisma.producto.upsert({
        where: { codigo: '136022' },
        update: {},
        create: {
          codigo: '136022',
          descripcion: 'Tornillo de titanio 2.0x10mm',
          referencia: 'TI-2010',
          marca: 'Osteosíntesis RP',
          origen: 'MANUAL',
          creadoEn: new Date(),
        },
      });
      const lote = await prisma.lote.upsert({
        where: { productoId_nroLote: { productoId: producto.id, nroLote: '01599-9' } },
        update: {},
        create: {
          productoId: producto.id,
          nroLote: '01599-9',
          fechaVencimiento: new Date('2027-06-30T00:00:00.000Z'),
          origen: 'MANUAL',
          creadoEn: new Date(),
        },
      });

      await conUsuario(superadmin.id, 'Carga inicial de datos de ejemplo', async (tx) => {
        const consecutivo = await siguienteConsecutivo(tx, 'TRASLADO');
        const ahora = new Date();
        const movimiento = await tx.movimiento.create({
          data: {
            consecutivo,
            tipo: 'TRASLADO',
            motivo: 'CARGA_INICIAL',
            sedeOrigenId: erp.id,
            sedeDestinoId: bog.id,
            estado: 'RECIBIDO',
            creadoPorId: superadmin.id,
            creadoEn: ahora,
            resueltoPorId: superadmin.id,
            resueltoEn: ahora,
            lineas: { create: [{ loteId: lote.id, cantidad: 20 }] },
          },
        });
        await aplicarEfectos(tx, movimiento.id, [{ sedeId: bog.id, loteId: lote.id, cantidad: 20 }], 'MOVER');
      });

      console.log('Traslado de carga inicial creado (20 unidades en Bogotá).');
    }

    console.log('Usuarios de desarrollo: admin.bog@/base.bog@/admin.med@/base.med@rpdental.local');
    console.log('Claves: Admin123! / Base123!');
  }

  console.log(`Superadmin: ${email} / ${clave}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
