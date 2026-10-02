-- ============================================================
-- Reglas de negocio que Prisma no expresa: CHECK, triggers de
-- auditoría, bloqueo de auditoria/kardex, vistas de reporte y
-- consecutivos iniciales. Ver sección 4 del diseño técnico.
--
-- CREATE TRIGGER/VIEW deben ser el único comando de su batch, y
-- Prisma no separa el archivo por "GO" (eso es una convención de
-- sqlcmd/SSMS, no T-SQL). Se usa EXEC(N'...') para que cada uno
-- corra en su propio batch dentro del mismo script.
-- ============================================================

-- 4.1 CHECK ----------------------------------------------------

ALTER TABLE usuario ADD CONSTRAINT CK_usuario_rol CHECK (rol IN ('SUPERADMIN','ADMIN','BASE'));
ALTER TABLE producto ADD CONSTRAINT CK_producto_origen CHECK (origen IN ('ERP','MANUAL'));
ALTER TABLE lote ADD CONSTRAINT CK_lote_origen CHECK (origen IN ('ERP','MANUAL'));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_tipo_estado CHECK (
     (tipo = 'TRASLADO'  AND estado IN ('NO_CONFIRMADO','RECIBIDO','RECHAZADO','ANULADO'))
  OR (tipo = 'SALIDA'    AND estado IN ('APLICADO','ANULADO'))
  OR (tipo = 'AJUSTE'    AND estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO'))
  OR (tipo = 'ANULACION' AND estado = 'APLICADO'));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_sedes CHECK (
     (tipo = 'TRASLADO'  AND sede_origen_id IS NOT NULL AND sede_destino_id IS NOT NULL AND sede_origen_id <> sede_destino_id)
  OR (tipo = 'SALIDA'    AND sede_origen_id IS NOT NULL AND sede_destino_id IS NULL)
  OR (tipo = 'AJUSTE'    AND sede_origen_id IS NULL     AND sede_destino_id IS NOT NULL)
  OR (tipo = 'ANULACION' AND (sede_origen_id IS NOT NULL OR sede_destino_id IS NOT NULL)));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_anula CHECK (
     (tipo = 'ANULACION' AND anula_a_id IS NOT NULL)
  OR (tipo <> 'ANULACION' AND anula_a_id IS NULL));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_motivo CHECK (
     motivo IS NULL
  OR (tipo = 'SALIDA'   AND motivo IN ('CIRUGIA','VENTA','VENCIDO','AVERIA'))
  OR (tipo = 'AJUSTE'   AND motivo = 'CONTEO_FISICO')
  OR (tipo = 'TRASLADO' AND motivo = 'CARGA_INICIAL'));

ALTER TABLE movimiento_linea ADD CONSTRAINT CK_linea_cantidad CHECK (cantidad <> 0);
ALTER TABLE saldo  ADD CONSTRAINT CK_saldo_no_negativo CHECK (cantidad >= 0);
ALTER TABLE kardex ADD CONSTRAINT CK_kardex CHECK (cantidad <> 0 AND saldo_resultante >= 0);

CREATE UNIQUE INDEX UX_movimiento_anula_a ON movimiento(anula_a_id) WHERE anula_a_id IS NOT NULL;

INSERT INTO consecutivo (prefijo, ultimo) VALUES ('TR',0),('SA',0),('AJ',0),('AN',0);

-- 4.2 Triggers de auditoría ------------------------------------

EXEC(N'
CREATE TRIGGER trg_aud_usuario ON usuario AFTER INSERT, UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N''usuario_id'') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N''motivo'') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, ''usuario'', CAST(COALESCE(i.id, d.id) AS VARCHAR(40)),
         CASE WHEN d.id IS NULL THEN ''CREAR'' WHEN i.id IS NULL THEN ''BORRAR'' ELSE ''MODIFICAR'' END,
         (SELECT d2.id, d2.email, d2.nombre, d2.rol, d2.activo, d2.creado_en FROM deleted  d2 WHERE d2.id = COALESCE(d.id, i.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.id, i2.email, i2.nombre, i2.rol, i2.activo, i2.creado_en FROM inserted i2 WHERE i2.id = COALESCE(i.id, d.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.id = i.id;
END
');

EXEC(N'
CREATE TRIGGER trg_aud_usuario_sede ON usuario_sede AFTER INSERT, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N''usuario_id'') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N''motivo'') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, ''usuario_sede'',
         CONCAT(COALESCE(i.usuario_id, d.usuario_id), ''-'', COALESCE(i.sede_id, d.sede_id)),
         CASE WHEN d.usuario_id IS NULL THEN ''CREAR'' ELSE ''BORRAR'' END,
         (SELECT d2.usuario_id, d2.sede_id FROM deleted  d2 WHERE d2.usuario_id = d.usuario_id AND d2.sede_id = d.sede_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.usuario_id, i2.sede_id FROM inserted i2 WHERE i2.usuario_id = i.usuario_id AND i2.sede_id = i.sede_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.usuario_id = i.usuario_id AND d.sede_id = i.sede_id;
END
');

EXEC(N'
CREATE TRIGGER trg_aud_sede ON sede AFTER INSERT, UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N''usuario_id'') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N''motivo'') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, ''sede'', CAST(COALESCE(i.id, d.id) AS VARCHAR(40)),
         CASE WHEN d.id IS NULL THEN ''CREAR'' WHEN i.id IS NULL THEN ''BORRAR'' ELSE ''MODIFICAR'' END,
         (SELECT d2.* FROM deleted  d2 WHERE d2.id = COALESCE(d.id, i.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.* FROM inserted i2 WHERE i2.id = COALESCE(i.id, d.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.id = i.id;
END
');

EXEC(N'
CREATE TRIGGER trg_aud_movimiento ON movimiento AFTER INSERT, UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N''usuario_id'') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N''motivo'') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, ''movimiento'', CAST(COALESCE(i.id, d.id) AS VARCHAR(40)),
         CASE WHEN d.id IS NULL THEN ''CREAR'' WHEN i.id IS NULL THEN ''BORRAR'' ELSE ''MODIFICAR'' END,
         (SELECT d2.* FROM deleted  d2 WHERE d2.id = COALESCE(d.id, i.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.* FROM inserted i2 WHERE i2.id = COALESCE(i.id, d.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.id = i.id;
END
');

EXEC(N'
CREATE TRIGGER trg_aud_movimiento_linea ON movimiento_linea AFTER INSERT, UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N''usuario_id'') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N''motivo'') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, ''movimiento_linea'', CAST(COALESCE(i.id, d.id) AS VARCHAR(40)),
         CASE WHEN d.id IS NULL THEN ''CREAR'' WHEN i.id IS NULL THEN ''BORRAR'' ELSE ''MODIFICAR'' END,
         (SELECT d2.* FROM deleted  d2 WHERE d2.id = COALESCE(d.id, i.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.* FROM inserted i2 WHERE i2.id = COALESCE(i.id, d.id) FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.id = i.id;
END
');

-- Bloqueo de auditoria y kardex: nunca se modifican ni se borran.

EXEC(N'
CREATE TRIGGER trg_bloqueo_auditoria ON auditoria INSTEAD OF UPDATE, DELETE AS
BEGIN
  THROW 50001, ''La auditoria no se modifica ni se borra.'', 1;
END
');

EXEC(N'
CREATE TRIGGER trg_bloqueo_kardex ON kardex INSTEAD OF UPDATE, DELETE AS
BEGIN
  THROW 50002, ''El kardex no se modifica ni se borra.'', 1;
END
');

-- 4.3 Vistas para reportes (Power BI) ----------------------------

EXEC(N'
CREATE VIEW v_inventario_sede AS
SELECT s.codigo AS sede_codigo, s.nombre AS sede, p.codigo AS cod_prod, p.descripcion, p.referencia, p.marca,
       l.nro_lote, l.fecha_vencimiento, sa.cantidad, sa.actualizado_en
FROM saldo sa
JOIN sede s     ON s.id = sa.sede_id
JOIN lote l     ON l.id = sa.lote_id
JOIN producto p ON p.id = l.producto_id
WHERE sa.cantidad > 0
');

EXEC(N'
CREATE VIEW v_kardex AS
SELECT k.id, k.fecha, s.nombre AS sede, p.codigo AS cod_prod, p.descripcion, l.nro_lote,
       m.consecutivo, m.tipo, m.motivo, k.cantidad, k.saldo_resultante
FROM kardex k
JOIN sede s       ON s.id = k.sede_id
JOIN lote l       ON l.id = k.lote_id
JOIN producto p   ON p.id = l.producto_id
JOIN movimiento m ON m.id = k.movimiento_id
');

EXEC(N'
CREATE VIEW v_por_recibir AS
SELECT m.id, m.consecutivo, m.creado_en, so.nombre AS origen, sd.nombre AS destino,
       COUNT(*) AS lineas, SUM(ml.cantidad) AS unidades
FROM movimiento m
JOIN sede so ON so.id = m.sede_origen_id
JOIN sede sd ON sd.id = m.sede_destino_id
JOIN movimiento_linea ml ON ml.movimiento_id = m.id
WHERE m.tipo = ''TRASLADO'' AND m.estado = ''NO_CONFIRMADO''
GROUP BY m.id, m.consecutivo, m.creado_en, so.nombre, sd.nombre
');
