import { prisma } from '../../db';

export async function buscarProductos(q: string) {
  if (!q) {
    return prisma.producto.findMany({ take: 20, orderBy: { descripcion: 'asc' } });
  }
  return prisma.producto.findMany({
    where: {
      OR: [
        { codigo: { contains: q } },
        { descripcion: { contains: q } },
        { referencia: { contains: q } },
      ],
    },
    take: 20,
    orderBy: { descripcion: 'asc' },
  });
}

export async function buscarLotes(productoId: number, q: string) {
  return prisma.lote.findMany({
    where: {
      productoId,
      ...(q ? { nroLote: { contains: q } } : {}),
    },
    take: 30,
    orderBy: { nroLote: 'asc' },
  });
}

export async function marcas() {
  const filas = await prisma.producto.findMany({
    where: { marca: { not: null } },
    select: { marca: true },
    distinct: ['marca'],
    orderBy: { marca: 'asc' },
  });
  return filas.map((f) => f.marca).filter((m): m is string => !!m);
}

export type FilaResuelta = {
  codigo: string;
  nroLote: string;
  cantidad?: number;
  estado: 'ok' | 'lote_nuevo' | 'producto_desconocido';
  productoId?: number;
  descripcion?: string;
  loteId?: number;
  fechaVencimiento?: string | null;
};

export async function resolver(filas: { codigo: string; nroLote: string; cantidad?: number; fechaVencimiento?: string }[]): Promise<FilaResuelta[]> {
  const resultado: FilaResuelta[] = [];

  for (const fila of filas) {
    const producto = await prisma.producto.findUnique({ where: { codigo: fila.codigo } });
    if (!producto) {
      resultado.push({ codigo: fila.codigo, nroLote: fila.nroLote, cantidad: fila.cantidad, estado: 'producto_desconocido' });
      continue;
    }

    const lote = await prisma.lote.findUnique({
      where: { productoId_nroLote: { productoId: producto.id, nroLote: fila.nroLote } },
    });

    if (!lote) {
      resultado.push({
        codigo: fila.codigo,
        nroLote: fila.nroLote,
        cantidad: fila.cantidad,
        estado: 'lote_nuevo',
        productoId: producto.id,
        descripcion: producto.descripcion,
        fechaVencimiento: fila.fechaVencimiento ?? null,
      });
      continue;
    }

    resultado.push({
      codigo: fila.codigo,
      nroLote: fila.nroLote,
      cantidad: fila.cantidad,
      estado: 'ok',
      productoId: producto.id,
      descripcion: producto.descripcion,
      loteId: lote.id,
      fechaVencimiento: lote.fechaVencimiento ? lote.fechaVencimiento.toISOString().slice(0, 10) : null,
    });
  }

  return resultado;
}
