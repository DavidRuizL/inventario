BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] VARCHAR(120) NOT NULL,
    [nombre] NVARCHAR(120) NOT NULL,
    [clave_hash] VARCHAR(100) NOT NULL,
    [rol] VARCHAR(12) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [usuario_activo_df] DEFAULT 1,
    [creado_en] DATETIME2 NOT NULL,
    CONSTRAINT [usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [usuario_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[usuario_sede] (
    [usuario_id] INT NOT NULL,
    [sede_id] INT NOT NULL,
    CONSTRAINT [usuario_sede_pkey] PRIMARY KEY CLUSTERED ([usuario_id],[sede_id])
);

-- CreateTable
CREATE TABLE [dbo].[sede] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] VARCHAR(10) NOT NULL,
    [nombre] NVARCHAR(80) NOT NULL,
    [controla_saldo] BIT NOT NULL CONSTRAINT [sede_controla_saldo_df] DEFAULT 1,
    [activo] BIT NOT NULL CONSTRAINT [sede_activo_df] DEFAULT 1,
    CONSTRAINT [sede_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sede_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

-- CreateTable
CREATE TABLE [dbo].[producto] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(40) NOT NULL,
    [descripcion] NVARCHAR(250) NOT NULL,
    [referencia] NVARCHAR(100),
    [marca] NVARCHAR(100),
    [origen] VARCHAR(6) NOT NULL,
    [creado_por] INT,
    [creado_en] DATETIME2 NOT NULL,
    [sincronizado_en] DATETIME2,
    CONSTRAINT [producto_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [producto_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

-- CreateTable
CREATE TABLE [dbo].[lote] (
    [id] INT NOT NULL IDENTITY(1,1),
    [producto_id] INT NOT NULL,
    [nro_lote] NVARCHAR(60) NOT NULL,
    [fecha_vencimiento] DATE,
    [origen] VARCHAR(6) NOT NULL,
    [creado_por] INT,
    [creado_en] DATETIME2 NOT NULL,
    [sincronizado_en] DATETIME2,
    CONSTRAINT [lote_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [lote_producto_id_nro_lote_key] UNIQUE NONCLUSTERED ([producto_id],[nro_lote])
);

-- CreateTable
CREATE TABLE [dbo].[movimiento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [consecutivo] VARCHAR(12) NOT NULL,
    [tipo] VARCHAR(10) NOT NULL,
    [motivo] VARCHAR(15),
    [sede_origen_id] INT,
    [sede_destino_id] INT,
    [estado] VARCHAR(13) NOT NULL,
    [documento_soporte] NVARCHAR(60),
    [observacion] NVARCHAR(500),
    [anula_a_id] INT,
    [creado_por] INT NOT NULL,
    [creado_en] DATETIME2 NOT NULL,
    [resuelto_por] INT,
    [resuelto_en] DATETIME2,
    [motivo_resolucion] NVARCHAR(500),
    CONSTRAINT [movimiento_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [movimiento_consecutivo_key] UNIQUE NONCLUSTERED ([consecutivo])
);

-- CreateTable
CREATE TABLE [dbo].[movimiento_linea] (
    [id] INT NOT NULL IDENTITY(1,1),
    [movimiento_id] INT NOT NULL,
    [lote_id] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [saldo_sistema] INT,
    [conteo] INT,
    CONSTRAINT [movimiento_linea_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [movimiento_linea_movimiento_id_lote_id_key] UNIQUE NONCLUSTERED ([movimiento_id],[lote_id])
);

-- CreateTable
CREATE TABLE [dbo].[saldo] (
    [sede_id] INT NOT NULL,
    [lote_id] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [actualizado_en] DATETIME2 NOT NULL,
    CONSTRAINT [saldo_pkey] PRIMARY KEY CLUSTERED ([sede_id],[lote_id])
);

-- CreateTable
CREATE TABLE [dbo].[kardex] (
    [id] INT NOT NULL IDENTITY(1,1),
    [fecha] DATETIME2 NOT NULL,
    [sede_id] INT NOT NULL,
    [lote_id] INT NOT NULL,
    [movimiento_id] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [saldo_resultante] INT NOT NULL,
    CONSTRAINT [kardex_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[auditoria] (
    [id] INT NOT NULL IDENTITY(1,1),
    [fecha_hora] DATETIME2 NOT NULL,
    [usuario_id] INT,
    [tabla] VARCHAR(30) NOT NULL,
    [registro_id] VARCHAR(40) NOT NULL,
    [accion] VARCHAR(13) NOT NULL,
    [antes] NVARCHAR(max),
    [despues] NVARCHAR(max),
    [motivo] NVARCHAR(500),
    CONSTRAINT [auditoria_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[sync_log] (
    [id] INT NOT NULL IDENTITY(1,1),
    [inicio] DATETIME2 NOT NULL,
    [fin] DATETIME2,
    [productos_nuevos] INT NOT NULL CONSTRAINT [sync_log_productos_nuevos_df] DEFAULT 0,
    [productos_actualizados] INT NOT NULL CONSTRAINT [sync_log_productos_actualizados_df] DEFAULT 0,
    [lotes_nuevos] INT NOT NULL CONSTRAINT [sync_log_lotes_nuevos_df] DEFAULT 0,
    [lotes_actualizados] INT NOT NULL CONSTRAINT [sync_log_lotes_actualizados_df] DEFAULT 0,
    [error] NVARCHAR(max),
    [usuario_id] INT,
    CONSTRAINT [sync_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[consecutivo] (
    [prefijo] VARCHAR(2) NOT NULL,
    [ultimo] INT NOT NULL CONSTRAINT [consecutivo_ultimo_df] DEFAULT 0,
    CONSTRAINT [consecutivo_pkey] PRIMARY KEY CLUSTERED ([prefijo])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [producto_referencia_idx] ON [dbo].[producto]([referencia]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [producto_descripcion_idx] ON [dbo].[producto]([descripcion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [lote_fecha_vencimiento_idx] ON [dbo].[lote]([fecha_vencimiento]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [movimiento_tipo_estado_idx] ON [dbo].[movimiento]([tipo], [estado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [movimiento_sede_origen_id_idx] ON [dbo].[movimiento]([sede_origen_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [movimiento_sede_destino_id_idx] ON [dbo].[movimiento]([sede_destino_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [movimiento_creado_en_idx] ON [dbo].[movimiento]([creado_en]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [movimiento_linea_lote_id_idx] ON [dbo].[movimiento_linea]([lote_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [saldo_lote_id_idx] ON [dbo].[saldo]([lote_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [kardex_sede_id_lote_id_id_idx] ON [dbo].[kardex]([sede_id], [lote_id], [id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [kardex_lote_id_idx] ON [dbo].[kardex]([lote_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [kardex_movimiento_id_idx] ON [dbo].[kardex]([movimiento_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auditoria_fecha_hora_idx] ON [dbo].[auditoria]([fecha_hora]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [auditoria_tabla_registro_id_idx] ON [dbo].[auditoria]([tabla], [registro_id]);

-- AddForeignKey
ALTER TABLE [dbo].[usuario_sede] ADD CONSTRAINT [usuario_sede_usuario_id_fkey] FOREIGN KEY ([usuario_id]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usuario_sede] ADD CONSTRAINT [usuario_sede_sede_id_fkey] FOREIGN KEY ([sede_id]) REFERENCES [dbo].[sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[producto] ADD CONSTRAINT [producto_creado_por_fkey] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[lote] ADD CONSTRAINT [lote_producto_id_fkey] FOREIGN KEY ([producto_id]) REFERENCES [dbo].[producto]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[lote] ADD CONSTRAINT [lote_creado_por_fkey] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento] ADD CONSTRAINT [movimiento_sede_origen_id_fkey] FOREIGN KEY ([sede_origen_id]) REFERENCES [dbo].[sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento] ADD CONSTRAINT [movimiento_sede_destino_id_fkey] FOREIGN KEY ([sede_destino_id]) REFERENCES [dbo].[sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento] ADD CONSTRAINT [movimiento_creado_por_fkey] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento] ADD CONSTRAINT [movimiento_resuelto_por_fkey] FOREIGN KEY ([resuelto_por]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento] ADD CONSTRAINT [movimiento_anula_a_id_fkey] FOREIGN KEY ([anula_a_id]) REFERENCES [dbo].[movimiento]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento_linea] ADD CONSTRAINT [movimiento_linea_movimiento_id_fkey] FOREIGN KEY ([movimiento_id]) REFERENCES [dbo].[movimiento]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[movimiento_linea] ADD CONSTRAINT [movimiento_linea_lote_id_fkey] FOREIGN KEY ([lote_id]) REFERENCES [dbo].[lote]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[saldo] ADD CONSTRAINT [saldo_sede_id_fkey] FOREIGN KEY ([sede_id]) REFERENCES [dbo].[sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[saldo] ADD CONSTRAINT [saldo_lote_id_fkey] FOREIGN KEY ([lote_id]) REFERENCES [dbo].[lote]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[kardex] ADD CONSTRAINT [kardex_sede_id_fkey] FOREIGN KEY ([sede_id]) REFERENCES [dbo].[sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[kardex] ADD CONSTRAINT [kardex_lote_id_fkey] FOREIGN KEY ([lote_id]) REFERENCES [dbo].[lote]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[kardex] ADD CONSTRAINT [kardex_movimiento_id_fkey] FOREIGN KEY ([movimiento_id]) REFERENCES [dbo].[movimiento]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[auditoria] ADD CONSTRAINT [auditoria_usuario_id_fkey] FOREIGN KEY ([usuario_id]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sync_log] ADD CONSTRAINT [sync_log_usuario_id_fkey] FOREIGN KEY ([usuario_id]) REFERENCES [dbo].[usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
