import ExcelJS from 'exceljs';
import { prisma } from '../../db';
import { SinPermisoError } from '../../shared/errors';
import { UsuarioAuth } from '../../shared/types';
import { esAdmin, puedeOperarSede, puedeVerSede } from '../../core/permisos';

function sedesVisibles(usuario: UsuarioAuth, sedeId?: number): number[] | undefined {
  if (sedeId !== undefined) {
    if (!puedeVerSede(usuario, sedeId)) throw new SinPermisoError('No puedes ver esta sede.');
    return [sedeId];
  }
  return esAdmin(usuario) ? undefined : usuario.sedeIds;
}

export async function disponible(usuario: UsuarioAuth, sedeId: number, q: string) {
  if (!puedeOperarSede(usuario, sedeId)) throw new SinPermisoError('No operas esta sede.');

  return prisma.saldo.findMany({
    where: {
      sedeId,
      cantidad: { gt: 0 },
      ...(q
        ? {
            lote: {
              OR: [
                { nroLote: { contains: q } },
                { producto: { codigo: { contains: q } } },
                { producto: { descripcion: { contains: q } } },
                { producto: { referencia: { contains: q } } },
              ],
            },
          }
        : {}),
    },
    include: { lote: { include: { producto: true } } },
    orderBy: [{ lote: { producto: { descripcion: 'asc' as const } } }],
    take: 50,
  });
}

type FiltrosInventario = { sedeId?: number; q?: string; marca?: string; lote?: string };

function whereInventario(usuario: UsuarioAuth, filtros: FiltrosInventario) {
  const sedeIds = sedesVisibles(usuario, filtros.sedeId);
  return {
    cantidad: { gt: 0 },
    ...(sedeIds ? { sedeId: { in: sedeIds } } : {}),
    lote: {
      ...(filtros.lote ? { nroLote: { contains: filtros.lote } } : {}),
      producto: {
        ...(filtros.marca ? { marca: filtros.marca } : {}),
        ...(filtros.q
          ? {
              OR: [
                { codigo: { contains: filtros.q } },
                { descripcion: { contains: filtros.q } },
                { referencia: { contains: filtros.q } },
              ],
            }
          : {}),
      },
    },
  };
}

export async function listar(usuario: UsuarioAuth, filtros: FiltrosInventario & { page: number; pageSize: number }) {
  const where = whereInventario(usuario, filtros);
  const [items, total] = await Promise.all([
    prisma.saldo.findMany({
      where,
      include: { sede: true, lote: { include: { producto: true } } },
      orderBy: [{ sede: { nombre: 'asc' as const } }, { lote: { producto: { descripcion: 'asc' as const } } }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.saldo.count({ where }),
  ]);
  return { items, total, page: filtros.page, pageSize: filtros.pageSize };
}

export async function porVencer(usuario: UsuarioAuth, dias: number, sedeId?: number) {
  const sedeIds = sedesVisibles(usuario, sedeId);
  const limite = new Date();
  limite.setUTCDate(limite.getUTCDate() + dias);

  return prisma.saldo.findMany({
    where: {
      cantidad: { gt: 0 },
      ...(sedeIds ? { sedeId: { in: sedeIds } } : {}),
      lote: { fechaVencimiento: { not: null, lte: limite } },
    },
    include: { sede: true, lote: { include: { producto: true } } },
    orderBy: { lote: { fechaVencimiento: 'asc' as const } },
  });
}

export async function exportarExcel(usuario: UsuarioAuth, filtros: FiltrosInventario): Promise<ExcelJS.Buffer> {
  const where = whereInventario(usuario, filtros);
  const filas = await prisma.saldo.findMany({
    where,
    include: { sede: true, lote: { include: { producto: true } } },
    orderBy: [{ sede: { nombre: 'asc' as const } }, { lote: { producto: { descripcion: 'asc' as const } } }],
  });

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Inventario');
  hoja.columns = [
    { header: 'Sede', key: 'sede', width: 18 },
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Referencia', key: 'referencia', width: 16 },
    { header: 'Marca', key: 'marca', width: 16 },
    { header: 'Lote', key: 'lote', width: 16 },
    { header: 'Vencimiento', key: 'vencimiento', width: 14 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
  ];
  for (const f of filas) {
    hoja.addRow({
      sede: f.sede.nombre,
      codigo: f.lote.producto.codigo,
      descripcion: f.lote.producto.descripcion,
      referencia: f.lote.producto.referencia ?? '',
      marca: f.lote.producto.marca ?? '',
      lote: f.lote.nroLote,
      vencimiento: f.lote.fechaVencimiento ? f.lote.fechaVencimiento.toISOString().slice(0, 10) : '',
      cantidad: f.cantidad,
    });
  }
  hoja.getRow(1).font = { bold: true };
  return libro.xlsx.writeBuffer();
}
