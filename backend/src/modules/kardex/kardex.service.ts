import ExcelJS from 'exceljs';
import { prisma } from '../../db';
import { SinPermisoError } from '../../shared/errors';
import { UsuarioAuth } from '../../shared/types';
import { esAdmin, puedeVerSede } from '../../core/permisos';

type Filtros = { loteId?: number; sedeId?: number; productoId?: number };

function whereKardex(usuario: UsuarioAuth, filtros: Filtros) {
  let sedeIds: number[] | undefined;
  if (filtros.sedeId !== undefined) {
    if (!puedeVerSede(usuario, filtros.sedeId)) throw new SinPermisoError('No puedes ver esta sede.');
    sedeIds = [filtros.sedeId];
  } else if (!esAdmin(usuario)) {
    sedeIds = usuario.sedeIds;
  }

  return {
    ...(sedeIds ? { sedeId: { in: sedeIds } } : {}),
    ...(filtros.loteId ? { loteId: filtros.loteId } : {}),
    ...(filtros.productoId ? { lote: { productoId: filtros.productoId } } : {}),
  };
}

export async function listar(usuario: UsuarioAuth, filtros: Filtros & { page: number; pageSize: number }) {
  const where = whereKardex(usuario, filtros);
  const [items, total] = await Promise.all([
    prisma.kardex.findMany({
      where,
      include: {
        sede: true,
        lote: { include: { producto: true } },
        movimiento: { select: { id: true, consecutivo: true, tipo: true, motivo: true } },
      },
      orderBy: { id: 'desc' },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.kardex.count({ where }),
  ]);
  return { items, total, page: filtros.page, pageSize: filtros.pageSize };
}

export async function exportarExcel(usuario: UsuarioAuth, filtros: Filtros): Promise<ExcelJS.Buffer> {
  const where = whereKardex(usuario, filtros);
  const filas = await prisma.kardex.findMany({
    where,
    include: {
      sede: true,
      lote: { include: { producto: true } },
      movimiento: { select: { consecutivo: true, tipo: true, motivo: true } },
    },
    orderBy: { id: 'asc' },
  });

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Kardex');
  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Sede', key: 'sede', width: 18 },
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Lote', key: 'lote', width: 16 },
    { header: 'Documento', key: 'documento', width: 14 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Motivo', key: 'motivo', width: 14 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Saldo resultante', key: 'saldo', width: 16 },
  ];
  for (const f of filas) {
    hoja.addRow({
      fecha: f.fecha,
      sede: f.sede.nombre,
      codigo: f.lote.producto.codigo,
      descripcion: f.lote.producto.descripcion,
      lote: f.lote.nroLote,
      documento: f.movimiento.consecutivo,
      tipo: f.movimiento.tipo,
      motivo: f.movimiento.motivo ?? '',
      cantidad: f.cantidad,
      saldo: f.saldoResultante,
    });
  }
  hoja.getRow(1).font = { bold: true };
  hoja.getColumn('fecha').numFmt = 'yyyy-mm-dd hh:mm';
  return libro.xlsx.writeBuffer();
}
