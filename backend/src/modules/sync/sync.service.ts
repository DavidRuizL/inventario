import { Prisma } from '@prisma/client';
import { prisma, conUsuario } from '../../db';
import { config } from '../../config';
import { ReglaError } from '../../shared/errors';

let corriendo = false;

type ContadorAccion = { nuevos: number | null; actualizados: number | null };

async function sincronizarProductos(tx: Prisma.TransactionClient, erpDb: string): Promise<{ nuevos: number; actualizados: number }> {
  const sql = `
    DECLARE @acc TABLE (accion NVARCHAR(10));

    MERGE producto WITH (HOLDLOCK) AS t
    USING (
      SELECT LTRIM(RTRIM(p.CodProd)) COLLATE DATABASE_DEFAULT AS codigo,
             COALESCE(NULLIF(LTRIM(RTRIM(p.Descrip)), ''), LTRIM(RTRIM(p.CodProd))) COLLATE DATABASE_DEFAULT AS descripcion,
             NULLIF(LTRIM(RTRIM(p.Refere)), '') COLLATE DATABASE_DEFAULT AS referencia,
             NULLIF(LTRIM(RTRIM(m.DescripcionMarca)), '') COLLATE DATABASE_DEFAULT AS marca
      FROM [${erpDb}].dbo.SAPROD p
      OUTER APPLY (SELECT TOP 1 mc.DescripcionMarca FROM [${erpDb}].dbo.MarcasCopia mc WHERE mc.CodInst = p.CodInst) m
    ) AS s ON t.codigo = s.codigo
    WHEN MATCHED AND (t.descripcion <> s.descripcion
                   OR ISNULL(t.referencia, '') <> ISNULL(s.referencia, '')
                   OR ISNULL(t.marca, '') <> ISNULL(s.marca, '')
                   OR t.origen <> 'ERP')
      THEN UPDATE SET descripcion = s.descripcion, referencia = s.referencia, marca = s.marca,
                      origen = 'ERP', sincronizado_en = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET
      THEN INSERT (codigo, descripcion, referencia, marca, origen, creado_en, sincronizado_en)
           VALUES (s.codigo, s.descripcion, s.referencia, s.marca, 'ERP', SYSUTCDATETIME(), SYSUTCDATETIME())
    OUTPUT $action INTO @acc;

    SELECT SUM(CASE WHEN accion = 'INSERT' THEN 1 ELSE 0 END) AS nuevos,
           SUM(CASE WHEN accion = 'UPDATE' THEN 1 ELSE 0 END) AS actualizados
    FROM @acc;
  `;
  const filas = await tx.$queryRawUnsafe<ContadorAccion[]>(sql);
  return { nuevos: filas[0]?.nuevos ?? 0, actualizados: filas[0]?.actualizados ?? 0 };
}

async function sincronizarLotes(tx: Prisma.TransactionClient, erpDb: string): Promise<{ nuevos: number; actualizados: number }> {
  const sql = `
    DECLARE @acc TABLE (accion NVARCHAR(10));

    MERGE lote WITH (HOLDLOCK) AS t
    USING (
      SELECT pr.id AS producto_id, LTRIM(RTRIM(sl.NroLote)) COLLATE DATABASE_DEFAULT AS nro_lote,
             MAX(CAST(sl.FechaV AS DATE)) AS fecha_vencimiento
      FROM [${erpDb}].dbo.SALOTE sl
      JOIN producto pr ON pr.codigo = LTRIM(RTRIM(sl.CodProd)) COLLATE DATABASE_DEFAULT
      WHERE NULLIF(LTRIM(RTRIM(sl.NroLote)), '') IS NOT NULL
      GROUP BY pr.id, LTRIM(RTRIM(sl.NroLote)) COLLATE DATABASE_DEFAULT
    ) AS s ON t.producto_id = s.producto_id AND t.nro_lote = s.nro_lote
    WHEN MATCHED AND (ISNULL(t.fecha_vencimiento, '1900-01-01') <> ISNULL(s.fecha_vencimiento, '1900-01-01')
                   OR t.origen <> 'ERP')
      THEN UPDATE SET fecha_vencimiento = s.fecha_vencimiento, origen = 'ERP', sincronizado_en = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET
      THEN INSERT (producto_id, nro_lote, fecha_vencimiento, origen, creado_en, sincronizado_en)
           VALUES (s.producto_id, s.nro_lote, s.fecha_vencimiento, 'ERP', SYSUTCDATETIME(), SYSUTCDATETIME())
    OUTPUT $action INTO @acc;

    SELECT SUM(CASE WHEN accion = 'INSERT' THEN 1 ELSE 0 END) AS nuevos,
           SUM(CASE WHEN accion = 'UPDATE' THEN 1 ELSE 0 END) AS actualizados
    FROM @acc;
  `;
  const filas = await tx.$queryRawUnsafe<ContadorAccion[]>(sql);
  return { nuevos: filas[0]?.nuevos ?? 0, actualizados: filas[0]?.actualizados ?? 0 };
}

export async function sincronizar(usuarioId: number | null): Promise<{ id: number }> {
  if (!config.ERP_DB) {
    throw new ReglaError('La sincronización no está configurada: falta la variable ERP_DB.');
  }
  if (corriendo) {
    throw new ReglaError('Ya hay una sincronización en curso. Espera a que termine.');
  }

  corriendo = true;
  const inicio = new Date();
  const log = await prisma.syncLog.create({ data: { inicio, usuarioId } });

  try {
    const resultado = await conUsuario(usuarioId, 'Sincronización con el ERP', async (tx) => {
      const productos = await sincronizarProductos(tx, config.ERP_DB!);
      const lotes = await sincronizarLotes(tx, config.ERP_DB!);
      return { productos, lotes };
    });

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        fin: new Date(),
        productosNuevos: resultado.productos.nuevos,
        productosActualizados: resultado.productos.actualizados,
        lotesNuevos: resultado.lotes.nuevos,
        lotesActualizados: resultado.lotes.actualizados,
      },
    });
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { fin: new Date(), error: err instanceof Error ? err.message : 'Error desconocido' },
    });
    throw err;
  } finally {
    corriendo = false;
  }

  return { id: log.id };
}

export async function ultimasCorridas() {
  return prisma.syncLog.findMany({
    orderBy: { inicio: 'desc' },
    take: 20,
    include: { usuario: { select: { id: true, nombre: true } } },
  });
}

export function iniciarTareaPeriodica(): void {
  if (!config.ERP_DB || config.SYNC_INTERVAL_MIN <= 0) {
    console.log('Sincronización automática deshabilitada (falta ERP_DB o SYNC_INTERVAL_MIN = 0).');
    return;
  }
  const ms = config.SYNC_INTERVAL_MIN * 60 * 1000;
  setInterval(() => {
    sincronizar(null).catch((err) => console.error('Error en sincronización automática:', err));
  }, ms);
  console.log(`Sincronización automática cada ${config.SYNC_INTERVAL_MIN} minutos.`);
}
